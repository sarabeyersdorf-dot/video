// Generate placeholder "property" photos with ffmpeg so `reel demo` works with
// zero assets. These are stylised gradient cards, not real photos — they exist
// only to show the motion / transitions / branding pipeline end to end.

import path from 'node:path';
import { runFfmpeg } from './engine/ffmpeg.js';
import { resolveFont, ffFontPath } from './util/fonts.js';

const ROOMS = [
  { label: 'EXTERIOR', top: '0x1B3A4B', bot: '0x2E6E8E' },
  { label: 'LIVING ROOM', top: '0x2B2B2B', bot: '0x6E5A3C' },
  { label: 'KITCHEN', top: '0x3A2E2E', bot: '0x8E6E5A' },
  { label: 'PRIMARY SUITE', top: '0x1E2A22', bot: '0x4C6E58' },
  { label: 'POOL & VIEW', top: '0x14303A', bot: '0x2E8E9E' },
];

export async function makeDemoPhotos(dir) {
  const font = ffFontPath(resolveFont('sans-bold'));
  const W = 1600, H = 1067;
  const files = [];
  for (let i = 0; i < ROOMS.length; i++) {
    const r = ROOMS[i];
    const out = path.join(dir, `${String(i + 1).padStart(2, '0')}-${r.label.toLowerCase().replace(/\W+/g, '-')}.png`);
    // Vertical gradient via gradients source + a soft vignette + label.
    await runFfmpeg([
      '-f', 'lavfi',
      '-i', `gradients=s=${W}x${H}:c0=${r.top}:c1=${r.bot}:x0=0:y0=0:x1=0:y1=${H}`,
      '-vf',
      `drawgrid=w=${Math.round(W / 10)}:h=${Math.round(H / 8)}:t=1:c=0xffffff@0.04,` +
        `vignette=PI/5,` +
        `drawtext=fontfile=${font}:text='${r.label}':x=(w-tw)/2:y=(h-th)/2:fontsize=90:fontcolor=white@0.92:shadowcolor=0x000000AA:shadowx=2:shadowy=3,` +
        `drawtext=fontfile=${font}:text='SAMPLE PHOTO':x=(w-tw)/2:y=(h-th)/2+110:fontsize=34:fontcolor=white@0.5`,
      '-frames:v', '1',
      out,
    ], { label: `demo photo ${r.label}` });
    files.push(out);
  }
  return files;
}
