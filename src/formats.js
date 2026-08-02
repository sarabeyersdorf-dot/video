// Output aspect presets. All use a 1080-based short edge for social-ready quality.

export const FORMATS = {
  reel:   { width: 1080, height: 1920, label: 'Vertical 9:16 (Reels / TikTok / Shorts)' },
  square: { width: 1080, height: 1080, label: 'Square 1:1 (Instagram feed)' },
  wide:   { width: 1920, height: 1080, label: 'Widescreen 16:9 (YouTube / MLS / web)' },
  story:  { width: 1080, height: 1920, label: 'Vertical 9:16 (Stories)' }, // alias of reel
};

export function resolveFormat(name) {
  const key = String(name || 'reel').toLowerCase();
  const fmt = FORMATS[key];
  if (!fmt) {
    throw new Error(
      `Unknown format "${name}". Choose one of: ${Object.keys(FORMATS).join(', ')}`
    );
  }
  return { key, ...fmt };
}
