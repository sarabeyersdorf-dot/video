// Resolve font-role names to actual font files. drawtext needs a real file path
// (fontconfig lookup is unreliable across platforms), so we probe a list of
// common locations and fall back to bundled DejaVu-style system fonts.

import { existsSync } from 'node:fs';

// Candidate files per role, in preference order. First existing wins.
const CANDIDATES = {
  'sans': [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    'C:/Windows/Fonts/arial.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  ],
  'sans-bold': [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    'C:/Windows/Fonts/arialbd.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  ],
  'serif': [
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
    '/System/Library/Fonts/Supplemental/Georgia.ttf',
    'C:/Windows/Fonts/georgia.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
  ],
  'serif-bold': [
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
    'C:/Windows/Fonts/georgiab.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
  ],
};

const cache = new Map();

export function resolveFont(role, override) {
  if (override && existsSync(override)) return override;
  if (cache.has(role)) return cache.get(role);

  const list = CANDIDATES[role] || CANDIDATES['sans'];
  let found = list.find((p) => existsSync(p));

  // Last-resort fallbacks so we never crash: any role can borrow another.
  if (!found) {
    for (const alt of Object.values(CANDIDATES)) {
      found = alt.find((p) => existsSync(p));
      if (found) break;
    }
  }
  if (!found) {
    throw new Error(
      'No usable system font was found for text overlays. Install a font package ' +
        '(e.g. "sudo apt-get install fonts-dejavu") or set a font path in your config theme.'
    );
  }
  cache.set(role, found);
  return found;
}

// ffmpeg drawtext fontfile needs colons and backslashes escaped on some platforms.
export function ffFontPath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}
