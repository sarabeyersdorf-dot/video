// Optional AI image-to-video layer.
//
// The default engine (zoompan/Ken Burns) needs no API keys and runs locally.
// When you want *true generative* motion (parallax, moving water, drifting
// clouds, walk-throughs), point a provider at an external model.
//
// Rather than hard-code one vendor's REST API (they change often), the built-in
// "command" provider runs a shell template you control, with placeholders:
//   {image}    absolute path to the source photo
//   {out}      absolute path the provider must write an .mp4 to
//   {motion}   the motion preset name (push-in, drone-up, ...)
//   {duration} clip length in seconds
//   {width} {height} {fps}
//
// Example config (drives the Higgsfield CLI you referenced):
//   "ai": {
//     "provider": "command",
//     "command": "higgsfield generate create --model kling-v3 --type image-to-video \
//                 --image {image} --prompt 'slow cinematic {motion} real estate' \
//                 --duration {duration} --output {out}"
//   }
//
// The provider must exit 0 and leave a video at {out}. assemble.js then
// normalises that video (scale/crop/fps) into the timeline like any clip.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export function getProvider(ai) {
  if (!ai || !ai.provider || ai.provider === 'none') return null;
  if (ai.provider === 'command') return commandProvider(ai);
  throw new Error(
    `Unknown ai.provider "${ai.provider}". Supported: "none", "command". ` +
      'Use "command" with a "command" template to drive any external model or CLI.'
  );
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}

function commandProvider(ai) {
  if (!ai.command) {
    throw new Error('ai.provider "command" requires an "ai.command" template string.');
  }
  return {
    name: 'command',
    async imageToVideo({ image, out, motion, duration, width, height, fps }) {
      const cmd = fill(ai.command, { image, out, motion, duration, width, height, fps });
      await runShell(cmd, ai.timeoutMs || 10 * 60 * 1000);
      if (!existsSync(out)) {
        throw new Error(`AI provider command finished but produced no file at ${out}`);
      }
      return { out };
    },
  };
}

function runShell(cmd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, { shell: true, stdio: 'inherit' });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`AI provider command timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`AI provider command exited with code ${code}`));
    });
  });
}
