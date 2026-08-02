// Visual themes control the accent color, fonts and title styling used across
// text overlays and the intro/outro cards. Colors are hex; ffmpeg drawtext
// wants 0xRRGGBB, so helpers convert on demand.

export const THEMES = {
  luxe: {
    label: 'Luxe — dark, gold accent, serif titles (high-end listings)',
    accent: '#C6A15B',
    bg: '#0E0E0F',
    text: '#FFFFFF',
    subtext: '#D8D8D8',
    titleFont: 'serif-bold',
    bodyFont: 'sans',
    uppercaseTitles: true,
  },
  modern: {
    label: 'Modern — clean white cards, blue accent, sans titles',
    accent: '#2E6BE6',
    bg: '#101317',
    text: '#FFFFFF',
    subtext: '#C7CDD6',
    titleFont: 'sans-bold',
    bodyFont: 'sans',
    uppercaseTitles: false,
  },
  minimal: {
    label: 'Minimal — muted, understated, lots of whitespace',
    accent: '#B9B4A9',
    bg: '#161514',
    text: '#F5F3EF',
    subtext: '#BEB9B0',
    titleFont: 'sans',
    bodyFont: 'sans',
    uppercaseTitles: true,
  },
  bold: {
    label: 'Bold — high contrast, warm accent, big type (fast reels)',
    accent: '#F0552B',
    bg: '#0B0B0B',
    text: '#FFFFFF',
    subtext: '#E6E6E6',
    titleFont: 'sans-bold',
    bodyFont: 'sans-bold',
    uppercaseTitles: true,
  },
};

export function resolveTheme(name, overrides = {}) {
  const key = String(name || 'luxe').toLowerCase();
  const base = THEMES[key] || THEMES.luxe;
  const theme = { key: THEMES[key] ? key : 'luxe', ...base };
  if (overrides.accent) theme.accent = overrides.accent;
  if (overrides.font) theme.fontOverride = overrides.font;
  return theme;
}

// #RRGGBB  ->  0xRRGGBB  (ffmpeg drawtext / color source syntax)
export function hexToFf(hex) {
  const h = String(hex || '#FFFFFF').replace('#', '').trim();
  return '0x' + (h.length === 3 ? h.split('').map((x) => x + x).join('') : h).toUpperCase();
}
