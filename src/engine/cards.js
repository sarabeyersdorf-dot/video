// Branded intro / outro cards, rendered as their own video clips so they can be
// crossfaded into the photo sequence like any other clip.
//
// A card is: an optional darkened, softly-pushing property photo as background
// (falls back to a solid themed color), a vertically-centered stack of copy, a
// themed accent rule, an optional logo, and a gentle whole-card fade in/out.

import { runFfmpeg } from './ffmpeg.js';
import { stackedBlock, accentRule } from './text.js';
import { hexToFf } from '../themes.js';

// Build the background portion of the filtergraph.
// Returns { pre, inputs } where `pre` ends producing [bg] at W x H, r fps.
function backgroundGraph({ W, H, fps, duration, theme, bgPhoto }) {
  if (bgPhoto) {
    // Slow push on a blurred, darkened photo → premium, alive backdrop.
    const frames = Math.round(duration * fps);
    const pre =
      `[0:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
      `zoompan=z='1+0.06*(on/${Math.max(1, frames - 1)})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${fps},` +
      `gblur=sigma=20,eq=brightness=-0.38:saturation=0.55:contrast=1.05,` +
      `drawbox=x=0:y=0:w=${W}:h=${H}:color=${hexToFf(theme.bg)}@0.55:t=fill[bg]`;
    return { pre, inputs: ['-loop', '1', '-framerate', String(fps), '-t', String(duration), '-i', bgPhoto] };
  }
  const pre = `color=c=${hexToFf(theme.bg)}:s=${W}x${H}:d=${duration}:r=${fps}[bg]`;
  return { pre, inputs: ['-f', 'lavfi', '-t', String(duration), '-i', `color=c=${hexToFf(theme.bg)}:s=${W}x${H}:r=${fps}`] };
}

export async function renderCard({
  dir,
  out,
  W,
  H,
  fps,
  duration,
  theme,
  elements,     // stacked block elements (see text.js)
  bgPhoto,
  logo,
  logoWidthPct = 0.3,
  logoTopPct = 0.12,
  fade = 0.6,
  onProgress,
}) {
  const scale = W / 1080;
  const inputs = [];
  const filters = [];

  const bg = backgroundGraph({ W, H, fps, duration, theme, bgPhoto });
  inputs.push(...bg.inputs);
  filters.push(bg.pre);

  // Draw the copy stack + accent rule onto [bg] -> [card]
  const draws = stackedBlock(dir, W, H, elements, {
    anchorY: 'center',
    fontOverride: theme.fontOverride,
  });
  let chain = `[bg]${draws.join(',')}`;

  // Whole-card fade in/out.
  const fadeOutStart = Math.max(0, duration - fade);
  chain += `,fade=t=in:st=0:d=${fade},fade=t=out:st=${fadeOutStart}:d=${fade},format=yuv420p`;

  let lastLabel = 'card';
  if (logo) {
    filters.push(chain + '[card]');
    // Logo as an additional input, scaled and overlaid near the top.
    inputs.push('-i', logo);
    const logoIdx = bgPhoto ? 1 : 1; // logo is always the 2nd real input here
    filters.push(
      `[${logoIdx}:v]scale=${Math.round(W * logoWidthPct)}:-1[logo]`,
      `[card][logo]overlay=x=(W-w)/2:y=${Math.round(H * logoTopPct)}[out]`
    );
    lastLabel = 'out';
  } else {
    filters.push(chain + '[out]');
    lastLabel = 'out';
  }

  const frames = Math.round(duration * fps);
  await runFfmpeg(
    [
      ...inputs,
      '-filter_complex', filters.join(';'),
      '-map', `[${lastLabel}]`,
      '-frames:v', String(frames),
      '-r', String(fps),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-an',
      out,
    ],
    { onProgress: onProgress ? (f) => onProgress(f, frames) : undefined, label: 'card' }
  );
  return { out, duration, frames };
}

// Compose the element stack for an intro card from listing data.
export function introElements(listing, theme, scale = 1) {
  const els = [];
  const up = (s) => (theme.uppercaseTitles ? String(s).toUpperCase() : String(s));
  if (listing.tagline) {
    els.push({ text: String(listing.tagline).toUpperCase(), fontRole: theme.bodyFont, size: 34 * scale, color: theme.accent, gapAfter: 26 * scale });
  }
  if (listing.address) {
    els.push({ text: up(listing.address), fontRole: theme.titleFont, size: 76 * scale, color: theme.text, gapAfter: 8 * scale });
  }
  if (listing.city) {
    els.push({ text: listing.city, fontRole: theme.bodyFont, size: 40 * scale, color: theme.subtext, gapAfter: 30 * scale });
  }
  els.push({ rule: { width: Math.round(150 * scale), thickness: Math.max(2, Math.round(4 * scale)) }, size: 20 * scale, color: theme.accent, gapAfter: 30 * scale });
  const specs = statLine(listing);
  if (specs) els.push({ text: specs, fontRole: theme.bodyFont, size: 38 * scale, color: theme.subtext, gapAfter: 22 * scale });
  if (listing.price) {
    els.push({ text: String(listing.price), fontRole: theme.titleFont, size: 60 * scale, color: theme.accent });
  }
  return els;
}

// Compose the element stack for an outro / call-to-action card from agent data.
export function outroElements(agent, theme, scale = 1, cta) {
  const els = [];
  els.push({ text: String(cta || 'Schedule a Private Showing').toUpperCase(), fontRole: theme.bodyFont, size: 34 * scale, color: theme.accent, gapAfter: 34 * scale });
  if (agent.name) els.push({ text: (theme.uppercaseTitles ? agent.name.toUpperCase() : agent.name), fontRole: theme.titleFont, size: 64 * scale, color: theme.text, gapAfter: 6 * scale });
  const role = [agent.title, agent.brokerage].filter(Boolean).join('  •  ');
  if (role) els.push({ text: role, fontRole: theme.bodyFont, size: 36 * scale, color: theme.subtext, gapAfter: 30 * scale });
  els.push({ rule: { width: Math.round(150 * scale), thickness: Math.max(2, Math.round(4 * scale)) }, size: 20 * scale, color: theme.accent, gapAfter: 30 * scale });
  const contact = [agent.phone, agent.email].filter(Boolean).join('    ');
  if (contact) els.push({ text: contact, fontRole: theme.bodyFont, size: 38 * scale, color: theme.text, gapAfter: 16 * scale });
  if (agent.license) els.push({ text: agent.license, fontRole: theme.bodyFont, size: 26 * scale, color: theme.subtext });
  return els;
}

// "5 Beds  •  6 Baths  •  6,200 Sq Ft" — omit any missing field.
export function statLine(listing) {
  const parts = [];
  if (listing.beds != null) parts.push(`${listing.beds} ${Number(listing.beds) === 1 ? 'Bed' : 'Beds'}`);
  if (listing.baths != null) parts.push(`${listing.baths} ${Number(listing.baths) === 1 ? 'Bath' : 'Baths'}`);
  if (listing.sqft != null) parts.push(`${Number(listing.sqft).toLocaleString('en-US')} Sq Ft`);
  return parts.join('   •   ');
}
