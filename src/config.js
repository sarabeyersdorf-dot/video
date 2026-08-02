// Load, validate and normalise a listing project.
//
// A project can come from a JSON config file and/or CLI flags. Relative asset
// paths (photos, music, logo) resolve against the config file's directory (or
// the current working directory when no config file is used).

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { collectImages, isImage, isVideo } from './util/images.js';
import { autoMotion, isMotion } from './engine/motions.js';
import { resolveFormat } from './formats.js';
import { resolveTheme } from './themes.js';

export const DEFAULTS = {
  format: 'reel',
  theme: 'luxe',
  fps: 30,
  clipDuration: 4.0,
  transition: { type: 'auto', duration: 0.8 },
  intro: true,
  outro: true,
  introDuration: 3.0,
  outroDuration: 3.5,
  music: null,
  musicVolume: 0.7,
  cta: 'Schedule a Private Showing',
};

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`Could not parse config ${file}: ${e.message}`);
  }
}

function resolveAsset(baseDir, p) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.resolve(baseDir, p);
}

// Merge: DEFAULTS <- config file <- CLI overrides.
export function loadProject({ configPath, cli = {} }) {
  let raw = {};
  let baseDir = process.cwd();
  if (configPath) {
    if (!existsSync(configPath)) throw new Error(`Config file not found: ${configPath}`);
    raw = readJson(configPath);
    baseDir = path.dirname(path.resolve(configPath));
  }

  const listing = raw.listing || {};
  const agent = raw.agent || {};
  const out = raw.output || {};

  const project = {
    baseDir,
    format: resolveFormat(cli.format || out.format || raw.format || DEFAULTS.format),
    fps: Number(cli.fps || out.fps || raw.fps || DEFAULTS.fps),
    clipDuration: Number(cli.clipDuration || raw.clipDuration || DEFAULTS.clipDuration),
    transition: {
      type: cli.transition || raw.transition?.type || DEFAULTS.transition.type,
      duration: Number(raw.transition?.duration ?? DEFAULTS.transition.duration),
    },
    theme: resolveTheme(cli.theme || raw.theme?.name || raw.theme || DEFAULTS.theme, {
      accent: cli.accent || raw.theme?.accent,
      font: raw.theme?.font,
    }),
    intro: cli.intro ?? raw.intro ?? DEFAULTS.intro,
    outro: cli.outro ?? raw.outro ?? DEFAULTS.outro,
    introDuration: Number(raw.introDuration ?? DEFAULTS.introDuration),
    outroDuration: Number(raw.outroDuration ?? DEFAULTS.outroDuration),
    cta: raw.cta || DEFAULTS.cta,
    music: resolveAsset(baseDir, cli.music || raw.music),
    musicVolume: Number(raw.theme?.musicVolume ?? raw.musicVolume ?? DEFAULTS.musicVolume),
    ai: cli.ai === false ? null : raw.ai || null,
    // Motion engine: 'kenburns' (default, 2D) or 'parallax' (local 2.5D depth).
    engine: (cli.engine || raw.engine || 'kenburns').toLowerCase(),
    parallax: {
      amplitude: raw.parallax?.amplitude,
      zoom: raw.parallax?.zoom,
      depthCmd: raw.parallax?.depthCmd || null,
      invertDepth: raw.parallax?.invertDepth || false,
    },
    listing,
    agent: {
      ...agent,
      logo: resolveAsset(baseDir, agent.logo),
      headshot: resolveAsset(baseDir, agent.headshot),
    },
    outputFile: resolveAsset(baseDir, cli.out || out.file) || path.resolve(process.cwd(), 'listing.mp4'),
  };

  // Resolve photos: explicit config list wins; else scan a --photos dir.
  project.photos = resolvePhotos({ raw, baseDir, cli, project });

  if (project.photos.length === 0) {
    throw new Error(
      'No photos found. Provide a "photos" array in your config, or pass --photos <folder>.'
    );
  }
  return project;
}

function resolvePhotos({ raw, baseDir, cli, project }) {
  let list = [];

  const mediaEntry = (entry, i) => {
    const file = resolveAsset(baseDir, entry.file);
    if (!existsSync(file)) throw new Error(`Media not found: ${entry.file}`);
    const video = isVideo(file);
    const motion = entry.motion && isMotion(entry.motion) ? entry.motion : autoMotion(i);
    return {
      file,
      type: video ? 'video' : 'image',
      motion: motion === 'auto' ? autoMotion(i) : motion,
      caption: entry.caption || null,
      // "full" keeps a video clip's entire length (resolved at render time).
      duration: entry.duration === 'full' ? 'full' : entry.duration ? Number(entry.duration) : project.clipDuration,
      start: entry.start != null ? Number(entry.start) : 0,
      engine: (entry.engine || project.engine).toLowerCase(),
      depth: resolveAsset(baseDir, entry.depth),
    };
  };

  if (Array.isArray(raw.photos) && raw.photos.length) {
    list = raw.photos.map((p, i) => mediaEntry(typeof p === 'string' ? { file: p } : { ...p }, i));
  } else if (cli.photos) {
    const dir = path.resolve(cli.photos);
    const files = collectImages(dir);
    const forced = cli.motion && isMotion(cli.motion) && cli.motion !== 'auto' ? cli.motion : null;
    list = files.map((file, i) =>
      mediaEntry({ file, motion: forced || undefined }, i)
    );
  }

  // Optional cap on number of photos.
  if (cli.max && list.length > cli.max) list = list.slice(0, cli.max);
  return list;
}

export function validateProject(project) {
  const warnings = [];
  if (!project.listing.address && !project.listing.tagline) {
    warnings.push('No listing.address or listing.tagline set — the intro card will be sparse.');
  }
  if (!project.agent.name) {
    warnings.push('No agent.name set — the outro/branding card will be sparse.');
  }
  if (project.music && !existsSync(project.music)) {
    warnings.push(`Music file not found (${project.music}); rendering without audio.`);
    project.music = null;
  }
  if (project.agent.logo && !isImage(project.agent.logo)) {
    warnings.push('agent.logo is not an image file; skipping logo overlay.');
    project.agent.logo = null;
  }
  return warnings;
}
