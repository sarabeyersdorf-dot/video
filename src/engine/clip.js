// Render a single photo into a motion clip (temp mp4) using zoompan.

import path from 'node:path';
import { runFfmpeg } from './ffmpeg.js';
import { motionExpr } from './motions.js';
import { drawtext, scrim, fitSize } from './text.js';

// Supersample factor for zoompan smoothness. We render the motion at a higher
// working resolution then downscale with lanczos, which removes the jitter that
// zoompan produces when it rounds sub-pixel coordinates at the target size.
// Working long edge is capped so memory stays reasonable on big batches.
function workingSize(W, H) {
  const SS = 2;
  const cap = 2560; // max working long edge
  const longEdge = Math.max(W, H);
  const factor = Math.min(SS, cap / longEdge);
  const even = (n) => Math.round(n / 2) * 2;
  return { WW: even(W * factor), HH: even(H * factor) };
}

// Build the -vf string for one photo clip.
export function clipFilter({ motion, frames, W, H, fps, zoom, pan, caption, theme, dir, duration }) {
  const { WW, HH } = workingSize(W, H);
  const { z, x, y } = motionExpr(motion, frames, { zoom, pan });

  const chain = [
    // Cover the working frame (crop overflow), never upscale-blur the short edge more than needed.
    `scale=${WW}:${HH}:force_original_aspect_ratio=increase`,
    `crop=${WW}:${HH}`,
    // The motion itself.
    `zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${WW}x${HH}:fps=${fps}`,
    // Down-sample to the real output size — this is where jitter disappears.
    `scale=${W}:${H}:flags=lanczos`,
    `setsar=1`,
  ];

  // Optional lower-third caption, faded in and out within the clip.
  if (caption && theme && dir) {
    const s = W / 1080;
    const bandH = Math.round(200 * s);
    const bandY = Math.round(H - bandH - H * 0.06);
    const fadeIn = { st: 0.4, d: 0.5 };
    const fadeOut = { st: Math.max(fadeIn.st + fadeIn.d, (duration || 4) - 0.9), d: 0.5 };
    const capText = theme.uppercaseTitles ? String(caption).toUpperCase() : String(caption);
    const capSize = fitSize(capText, 46 * s, W * 0.84, theme.titleFont);
    chain.push(scrim({ W, y: bandY, h: bandH, color: '#000000', opacity: 0.42 }));
    chain.push(
      drawtext(dir, {
        text: capText,
        fontRole: theme.titleFont,
        fontOverride: theme.fontOverride,
        size: capSize,
        color: theme.text,
        x: `${Math.round(W * 0.08)}`,
        y: Math.round(bandY + bandH * 0.32),
        fadeIn,
        fadeOut,
      })
    );
    // small accent tick above the caption
    chain.push(
      `drawbox=x=${Math.round(W * 0.08)}:y=${Math.round(bandY + bandH * 0.18)}:w=${Math.round(70 * s)}:h=${Math.max(2, Math.round(4 * s))}:color=${theme.accent.replace('#', '0x')}:t=fill`
    );
  }

  chain.push(`format=yuv420p`);
  return chain.join(',');
}

export async function renderClip({
  photo,
  out,
  motion,
  duration,
  W,
  H,
  fps,
  zoom,
  pan,
  caption,
  theme,
  dir,
  onProgress,
}) {
  const frames = Math.max(1, Math.round(duration * fps));
  const vf = clipFilter({ motion, frames, W, H, fps, zoom, pan, caption, theme, dir, duration });

  await runFfmpeg(
    [
      '-loop', '1',
      '-framerate', String(fps),
      '-t', String(duration),
      '-i', photo,
      '-vf', vf,
      '-frames:v', String(frames),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-an',
      out,
    ],
    { onProgress: onProgress ? (f) => onProgress(f, frames) : undefined, label: `clip ${path.basename(photo)}` }
  );

  return { out, frames, duration };
}

// Normalise an AI-generated (or any) source video into a timeline clip: cover
// the target frame, pin fps/duration, and optionally burn in a caption.
export async function renderFromVideo({ input, out, duration, W, H, fps, caption, theme, dir, onProgress }) {
  const frames = Math.max(1, Math.round(duration * fps));
  const s = W / 1080;
  const chain = [
    `scale=${W}:${H}:force_original_aspect_ratio=increase`,
    `crop=${W}:${H}`,
    `fps=${fps}`,
    `setsar=1`,
  ];
  if (caption && theme && dir) {
    const bandH = Math.round(200 * s);
    const bandY = Math.round(H - bandH - H * 0.06);
    chain.push(scrim({ W, y: bandY, h: bandH, color: '#000000', opacity: 0.42 }));
    chain.push(
      drawtext(dir, {
        text: theme.uppercaseTitles ? String(caption).toUpperCase() : String(caption),
        fontRole: theme.titleFont, fontOverride: theme.fontOverride,
        size: 46 * s, color: theme.text,
        x: `${Math.round(W * 0.08)}`, y: Math.round(bandY + bandH * 0.32),
        fadeIn: { st: 0.4, d: 0.5 },
        fadeOut: { st: Math.max(0.9, duration - 0.9), d: 0.5 },
      })
    );
  }
  chain.push('format=yuv420p');

  await runFfmpeg(
    [
      '-i', input,
      '-vf', chain.join(','),
      '-frames:v', String(frames),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-an',
      out,
    ],
    { onProgress: onProgress ? (f) => onProgress(f, frames) : undefined, label: `normalise ${path.basename(input)}` }
  );
  return { out, frames, duration };
}
