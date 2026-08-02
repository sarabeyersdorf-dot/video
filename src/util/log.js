// Tiny logger with color + step framing. No external deps so the CLI stays light.

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `[${code}m${s}[0m` : s);

export const color = {
  gray: (s) => c('90', s),
  green: (s) => c('32', s),
  cyan: (s) => c('36', s),
  yellow: (s) => c('33', s),
  red: (s) => c('31', s),
  bold: (s) => c('1', s),
  accent: (s) => c('38;5;179', s),
};

let quiet = false;
export function setQuiet(v) {
  quiet = !!v;
}

export const log = {
  info: (...a) => !quiet && console.log(...a),
  step: (msg) => !quiet && console.log(color.accent('▸ ') + msg),
  done: (msg) => !quiet && console.log(color.green('✓ ') + msg),
  warn: (msg) => console.warn(color.yellow('! ') + msg),
  error: (msg) => console.error(color.red('✗ ') + msg),
  detail: (msg) => !quiet && console.log(color.gray('  ' + msg)),
};

// Simple progress line for long renders (overwrites in place on a TTY).
export function progress(label, current, total) {
  if (quiet) return;
  const pct = total ? Math.round((current / total) * 100) : 0;
  const barLen = 24;
  const filled = Math.round((pct / 100) * barLen);
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
  const line = `  ${color.accent(bar)} ${String(pct).padStart(3)}%  ${label}`;
  if (process.stdout.isTTY) {
    process.stdout.write('\r' + line + '[K');
    if (current >= total) process.stdout.write('\n');
  } else if (current >= total) {
    console.log(line);
  }
}
