// Orchestrates a full render:
//   1. render intro card (optional)
//   2. render one motion clip per photo
//   3. render outro / branding card (optional)
//   4. crossfade everything together and mux background music
//
// Clips are rendered to a temp work dir first (robust + debuggable) and stitched
// in a second pass. All clips share resolution / fps / pix_fmt / SAR so xfade
// concatenation is clean.

import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { runFfmpeg, probeDuration } from './ffmpeg.js';
import { renderClip, renderFromVideo } from './clip.js';
import { renderCard, introElements, outroElements } from './cards.js';
import { buildXfadeChain } from './transitions.js';
import { musicInput } from './music.js';
import { getProvider } from '../ai/provider.js';
import { renderParallaxClip, assertParallaxAvailable } from './parallax.js';
import { log, progress, color } from '../util/log.js';

export async function assemble(project, { keepTemp = false } = {}) {
  const { format, fps } = project;
  const W = format.width;
  const H = format.height;
  const theme = project.theme;
  const scale = W / 1080;

  const work = mkdtempSync(path.join(tmpdir(), 'listing-reel-'));
  mkdirSync(path.dirname(project.outputFile), { recursive: true });

  const provider = getProvider(project.ai);
  if (provider) log.detail(`AI motion via "${provider.name}" provider`);

  // Card backgrounds must be stills — pick the first/last image (skip videos).
  const imageEntries = project.photos.filter((p) => p.type === 'image');
  const firstPhoto = imageEntries[0]?.file || null;
  const lastPhoto = imageEntries[imageEntries.length - 1]?.file || null;

  // If any photo uses the parallax engine, make sure Python is ready up front.
  const usesParallax = project.photos.some((p) => p.type === 'image' && p.engine === 'parallax');
  if (usesParallax && !provider) {
    await assertParallaxAvailable();
    log.detail('2.5D parallax engine (depth-based)');
  }

  const clips = []; // { file, duration }
  try {
    let stepN = 0;
    const totalSteps =
      project.photos.length + (project.intro ? 1 : 0) + (project.outro ? 1 : 0) + 1;

    // 1. Intro card ---------------------------------------------------------
    if (project.intro) {
      const out = path.join(work, 'intro.mp4');
      log.step(`Rendering intro card ${color.gray(`(${++stepN}/${totalSteps})`)}`);
      await renderCard({
        dir: work,
        out,
        W, H, fps,
        duration: project.introDuration,
        theme,
        elements: introElements(project.listing, theme, scale),
        bgPhoto: firstPhoto,
        logo: project.agent.logo || null,
        logoTopPct: 0.1,
        onProgress: (f, tot) => progress('intro card', f, tot),
      });
      clips.push({ file: out, duration: project.introDuration });
    }

    // 2. Photo / footage motion clips --------------------------------------
    for (let i = 0; i < project.photos.length; i++) {
      const p = project.photos[i];
      const out = path.join(work, `clip_${String(i).padStart(3, '0')}.mp4`);

      // Resolve the effective clip duration (videos may be trimmed / "full").
      let dur = p.duration;
      if (p.type === 'video') {
        const avail = Math.max(0.1, (await probeDuration(p.file).catch(() => 0)) - (p.start || 0));
        dur = p.duration === 'full' ? avail : Math.min(Number(p.duration), avail);
      }

      const kind =
        p.type === 'video' ? 'video' : provider ? 'ai' : p.engine === 'parallax' ? 'parallax' : p.motion;
      log.step(
        `Rendering ${p.type === 'video' ? 'footage' : 'photo'} ${i + 1}/${project.photos.length}: ` +
          `${color.gray(path.basename(p.file))} ${color.accent(kind)} ${color.gray(`(${++stepN}/${totalSteps})`)}`
      );

      if (p.type === 'video') {
        // Your own drone / aerial footage — trim + fit into the timeline.
        await renderFromVideo({
          input: p.file, out, duration: dur, start: p.start || 0, W, H, fps,
          caption: p.caption, theme, dir: work,
          onProgress: (f, tot) => progress('footage', f, tot),
        });
      } else if (provider) {
        // Generative AI motion: external model makes a raw clip, then normalise.
        const raw = path.join(work, `ai_${String(i).padStart(3, '0')}.mp4`);
        await provider.imageToVideo({ image: p.file, out: raw, motion: p.motion, duration: dur, width: W, height: H, fps });
        await renderFromVideo({ input: raw, out, duration: dur, W, H, fps, caption: p.caption, theme, dir: work, onProgress: (f, tot) => progress('ai clip', f, tot) });
      } else if (p.engine === 'parallax') {
        // Local 2.5D depth parallax.
        const raw = p.caption ? path.join(work, `px_${String(i).padStart(3, '0')}.mp4`) : out;
        await renderParallaxClip({
          photo: p.file, out: raw, motion: p.motion, duration: dur, W, H, fps,
          amplitude: project.parallax.amplitude, zoom: project.parallax.zoom,
          depth: p.depth, depthCmd: project.parallax.depthCmd, invertDepth: project.parallax.invertDepth,
        });
        if (p.caption) {
          await renderFromVideo({ input: raw, out, duration: dur, W, H, fps, caption: p.caption, theme, dir: work, onProgress: (f, tot) => progress('parallax', f, tot) });
        }
      } else {
        // Default 2D Ken Burns engine.
        await renderClip({
          photo: p.file, out, motion: p.motion, duration: dur, W, H, fps,
          caption: p.caption, theme, dir: work,
          onProgress: (f, tot) => progress(p.motion, f, tot),
        });
      }
      clips.push({ file: out, duration: dur });
    }

    // 3. Outro / branding card ---------------------------------------------
    if (project.outro) {
      const out = path.join(work, 'outro.mp4');
      log.step(`Rendering branding card ${color.gray(`(${++stepN}/${totalSteps})`)}`);
      await renderCard({
        dir: work,
        out,
        W, H, fps,
        duration: project.outroDuration,
        theme,
        elements: outroElements(project.agent, theme, scale, project.cta),
        bgPhoto: lastPhoto,
        logo: project.agent.logo || null,
        logoTopPct: 0.08,
        onProgress: (f, tot) => progress('branding card', f, tot),
      });
      clips.push({ file: out, duration: project.outroDuration });
    }

    // 4. Stitch + music -----------------------------------------------------
    log.step(`Stitching ${clips.length} clips + music ${color.gray(`(${++stepN}/${totalSteps})`)}`);
    const finalDuration = await stitch({ project, clips, W, H, fps });

    return { output: project.outputFile, duration: finalDuration, clips: clips.length, work };
  } finally {
    if (!keepTemp) {
      try { rmSync(work, { recursive: true, force: true }); } catch {}
    } else {
      log.detail(`Temp clips kept in ${work}`);
    }
  }
}

async function stitch({ project, clips, W, H, fps }) {
  const durations = clips.map((c) => c.duration);
  const minClip = Math.min(...durations);
  // Keep the crossfade shorter than the shortest clip.
  const transDur = Math.min(project.transition.duration, minClip * 0.6);

  const { filter: xfade, totalDuration } = buildXfadeChain({
    count: clips.length,
    durations,
    transDur,
    transitionType: project.transition.type,
  });

  const inputs = [];
  const prep = [];
  clips.forEach((c, i) => {
    inputs.push('-i', c.file);
    // Normalise timebase/fps/format so xfade concatenation is seamless.
    prep.push(`[${i}:v]settb=AVTB,fps=${fps},format=yuv420p,setsar=1,setpts=PTS-STARTPTS[v${i}]`);
  });

  const filterParts = [...prep, xfade];

  // Audio.
  const music = musicInput({
    file: project.music,
    videoDuration: totalDuration,
    volume: project.musicVolume,
  });
  const maps = ['-map', '[vout]'];
  if (music) {
    inputs.push(...music.inputArgs);
    const musicIdx = clips.length; // music is the last input
    filterParts.push(`[${musicIdx}:a]${music.filter}[aout]`);
    maps.push('-map', '[aout]');
  }

  const args = [
    ...inputs,
    '-filter_complex', filterParts.join(';'),
    ...maps,
    '-r', String(fps),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
  ];
  if (music) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-t', totalDuration.toFixed(3), project.outputFile);

  const totalFrames = Math.round(totalDuration * fps);
  await runFfmpeg(args, {
    onProgress: (f) => progress('final encode', f, totalFrames),
    label: 'final stitch',
  });
  progress('final encode', totalFrames, totalFrames);
  return totalDuration;
}
