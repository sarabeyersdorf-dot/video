// Text-overlay helpers built on ffmpeg's drawtext filter.
//
// We pass copy through `textfile=` rather than `text=` so we never have to
// escape colons/quotes/percent signs inside listing copy — the file content is
// taken literally. Each text file is written into the render's work dir.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveFont, ffFontPath } from '../util/fonts.js';
import { hexToFf } from '../themes.js';

let counter = 0;

// Persist a line of copy to a temp file and return its path (colon-free).
function textFile(dir, content) {
  const p = path.join(dir, `t_${counter++}.txt`);
  writeFileSync(p, content ?? '', 'utf8');
  return p;
}

// Rough average glyph advance as a fraction of font size, per font role. Used
// to shrink oversized titles so long addresses / names never bleed off-frame.
const CHAR_RATIO = {
  'serif-bold': 0.70,
  'sans-bold': 0.66,
  serif: 0.58,
  sans: 0.56,
};

export function estimateTextWidth(text, size, fontRole = 'sans') {
  const ratio = CHAR_RATIO[fontRole] ?? 0.55;
  return String(text || '').length * size * ratio;
}

// Return a font size that keeps `text` within maxWidth (never larger than the
// requested size).
export function fitSize(text, size, maxWidth, fontRole = 'sans') {
  const est = estimateTextWidth(text, size, fontRole);
  if (est <= maxWidth || est === 0) return size;
  return Math.max(12, Math.floor((size * maxWidth) / est));
}

// One drawtext element. `y` may be a number or an ffmpeg expression string.
// `x` defaults to horizontally centered. Optional fade window via enable/alpha.
export function drawtext(dir, {
  text,
  fontRole = 'sans',
  fontOverride,
  size = 48,
  color = '#FFFFFF',
  x = '(w-text_w)/2',
  y = 0,
  letterSpacing,
  box = false,
  boxColor = '#000000',
  boxOpacity = 0.5,
  boxBorder = 24,
  shadow = true,
  fadeIn,   // { st, d }
  fadeOut,  // { st, d }
  enable,   // ffmpeg enable expr, e.g. between(t,1,4)
}) {
  const file = textFile(dir, text);
  const font = ffFontPath(resolveFont(fontRole, fontOverride));
  const parts = [
    `fontfile=${font}`,
    `textfile=${file}`,
    `fontsize=${Math.round(size)}`,
    `fontcolor=${hexToFf(color)}`,
    `x=${x}`,
    `y=${typeof y === 'number' ? Math.round(y) : y}`,
  ];
  if (letterSpacing != null) parts.push(`tabsize=4`); // reserved; drawtext lacks native tracking
  if (shadow) {
    parts.push('shadowcolor=0x000000AA', 'shadowx=2', 'shadowy=3');
  }
  if (box) {
    parts.push('box=1', `boxcolor=${hexToFf(boxColor)}@${boxOpacity}`, `boxborderw=${boxBorder}`);
  }
  // Fade via alpha expression (works while overlaid on moving video).
  if (fadeIn || fadeOut) {
    const segs = [];
    if (fadeIn) segs.push(`if(lt(t,${fadeIn.st}),0,if(lt(t,${fadeIn.st + fadeIn.d}),(t-${fadeIn.st})/${fadeIn.d},1))`);
    const base = fadeIn ? segs[0] : '1';
    let expr = base;
    if (fadeOut) {
      expr = `min(${base},if(lt(t,${fadeOut.st}),1,if(lt(t,${fadeOut.st + fadeOut.d}),1-(t-${fadeOut.st})/${fadeOut.d},0)))`;
    }
    parts.push(`alpha='${expr}'`);
  }
  if (enable) parts.push(`enable='${enable}'`);

  return 'drawtext=' + parts.join(':');
}

// A themed accent rule (thin horizontal line) drawn with drawbox.
export function accentRule({ W, y, width, thickness = 4, color = '#FFFFFF', opacity = 1 }) {
  const w = width || Math.round(W * 0.14);
  const x = Math.round((W - w) / 2);
  return `drawbox=x=${x}:y=${Math.round(y)}:w=${w}:h=${thickness}:color=${hexToFf(color)}@${opacity}:t=fill`;
}

// A full-width gradient-ish scrim band (solid box with opacity) to seat text on
// busy photos — used for lower-thirds.
export function scrim({ W, y, h, color = '#000000', opacity = 0.45 }) {
  return `drawbox=x=0:y=${Math.round(y)}:w=${W}:h=${Math.round(h)}:color=${hexToFf(color)}@${opacity}:t=fill`;
}

// Vertically stack a list of {text,size,fontRole,color,gapAfter} around a center
// anchor, returning drawtext strings. Heights are estimated from font size.
export function stackedBlock(dir, W, H, elements, { anchorY = 'center', fontOverride, maxWidthPct = 0.86 } = {}) {
  const maxWidth = W * maxWidthPct;
  // Pre-fit every text element so nothing overflows, then lay out using the
  // fitted sizes so vertical spacing stays correct.
  const laid = elements.map((e) => {
    if (e.rule) return { ...e, _size: e.size };
    const role = e.fontRole || 'sans';
    return { ...e, _size: fitSize(e.text, e.size, maxWidth, role) };
  });

  const lh = (e) => Math.round(e._size * 1.28);
  const total =
    laid.reduce((s, e) => s + lh(e) + (e.gapAfter || 0), 0) -
    (laid[laid.length - 1]?.gapAfter || 0);
  let top = anchorY === 'center' ? Math.round((H - total) / 2) : Math.round(anchorY);

  const out = [];
  for (const e of laid) {
    if (e.rule) {
      out.push(accentRule({ W, y: top + lh(e) / 2, width: e.rule.width, thickness: e.rule.thickness, color: e.color, opacity: e.opacity ?? 1 }));
    } else {
      out.push(
        drawtext(dir, {
          text: e.text,
          fontRole: e.fontRole || 'sans',
          fontOverride,
          size: e._size,
          color: e.color,
          y: top,
          box: e.box,
          boxColor: e.boxColor,
          boxOpacity: e.boxOpacity,
          fadeIn: e.fadeIn,
          fadeOut: e.fadeOut,
        })
      );
    }
    top += lh(e) + (e.gapAfter || 0);
  }
  return out;
}
