// Node wrapper around tools/parallax.py — the local 2.5D depth-parallax engine.
// Spawns Python (numpy + Pillow) to warp a photo by its depth map into a clip
// with real dimensional camera motion. Depth is auto-estimated (Depth-Anything),
// read from a sibling `<photo>.depth.png`, or falls back to a heuristic.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', '..', 'tools', 'parallax.py');
const PYTHON = process.env.PYTHON || 'python3';

// Map the standard Ken Burns motion names onto their parallax equivalents so a
// config can just say engine:"parallax" without renaming every motion.
const MOTION_MAP = {
  'push-in': 'parallax-push',
  'pull-out': 'parallax-pull',
  'pan-left': 'parallax-left',
  'pan-right': 'parallax-right',
  'pan-up': 'parallax-up',
  'pan-down': 'parallax-down',
  'drone-up': 'parallax-push',
  'ken-burns': 'parallax',
  still: 'parallax',
};

export function toParallaxMotion(motion) {
  if (String(motion).startsWith('parallax')) return motion;
  return MOTION_MAP[motion] || 'parallax-push';
}

// Look for a depth map sitting next to the photo (as produced by estimate_depth.py).
function siblingDepth(photo) {
  const base = photo.replace(/\.[^.]+$/, '');
  for (const cand of [`${base}.depth.png`, `${base}.depth.jpg`]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

export async function assertParallaxAvailable() {
  await new Promise((resolve, reject) => {
    const p = spawn(PYTHON, ['-c', 'import numpy, PIL'], { stdio: 'ignore' });
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              'The parallax engine needs Python with numpy + Pillow:\n' +
                '    pip install numpy pillow\n' +
                'For realistic depth also: pip install torch transformers'
            )
          )
    );
  });
}

export async function renderParallaxClip({
  photo,
  out,
  motion,
  duration,
  W,
  H,
  fps,
  amplitude,
  zoom,
  depth,
  depthCmd,
  invertDepth,
  onLine,
}) {
  const args = [
    SCRIPT,
    '--image', photo,
    '--out', out,
    '--width', String(W),
    '--height', String(H),
    '--fps', String(fps),
    '--duration', String(duration),
    '--motion', toParallaxMotion(motion),
  ];
  if (amplitude != null) args.push('--amplitude', String(amplitude));
  if (zoom != null) args.push('--zoom', String(zoom));
  const depthFile = depth || siblingDepth(photo);
  if (depthFile) args.push('--depth', depthFile);
  if (depthCmd) args.push('--depth-cmd', depthCmd);
  if (invertDepth) args.push('--invert-depth');

  await new Promise((resolve, reject) => {
    const p = spawn(PYTHON, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => {
      const s = d.toString();
      err += s;
      if (err.length > 8000) err = err.slice(-8000);
      if (onLine) onLine(s.trim());
    });
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`parallax.py failed:\n${err.split('\n').slice(-8).join('\n')}`))
    );
  });
  return { out, duration };
}
