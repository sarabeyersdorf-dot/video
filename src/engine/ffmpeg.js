// Thin wrapper around the ffmpeg / ffprobe binaries.
// We shell out rather than depend on a native binding so the tool works with
// whatever system ffmpeg the user already has (>= 4.3 for xfade/zoompan smoothness).

import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export async function assertFfmpeg() {
  try {
    const { stdout } = await execFileAsync(FFMPEG, ['-hide_banner', '-version']);
    const line = stdout.split('\n')[0] || '';
    return line.trim();
  } catch {
    throw new Error(
      'ffmpeg was not found on your PATH. Install it first:\n' +
        '  macOS:   brew install ffmpeg\n' +
        '  Ubuntu:  sudo apt-get install ffmpeg\n' +
        '  Windows: https://www.gyan.dev/ffmpeg/builds/\n' +
        'Or set FFMPEG_PATH to the binary location.'
    );
  }
}

// Probe an image or video for its pixel dimensions.
export async function probeSize(file) {
  const { stdout } = await execFileAsync(FFPROBE, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=s=x:p=0',
    file,
  ]);
  const [w, h] = stdout.trim().split('x').map(Number);
  if (!w || !h) throw new Error(`Could not read dimensions of ${file}`);
  return { width: w, height: h };
}

// Probe media duration in seconds (used for music files).
export async function probeDuration(file) {
  const { stdout } = await execFileAsync(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  const d = parseFloat(stdout.trim());
  return Number.isFinite(d) ? d : 0;
}

// Run ffmpeg. Progress frames are parsed from stderr and forwarded to onProgress.
export function runFfmpeg(args, { onProgress, label } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, ['-hide_banner', '-y', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      // Keep only the tail so a failing long render doesn't blow memory.
      if (stderr.length > 16000) stderr = stderr.slice(-16000);
      if (onProgress) {
        const m = text.match(/frame=\s*(\d+)/g);
        if (m) {
          const last = m[m.length - 1];
          const frame = parseInt(last.replace(/\D/g, ''), 10);
          onProgress(frame);
        }
      }
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) return resolve();
      const tail = stderr.split('\n').slice(-12).join('\n');
      reject(new Error(`ffmpeg exited with code ${code}${label ? ` during ${label}` : ''}:\n${tail}`));
    });
  });
}
