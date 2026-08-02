// Camera-motion presets.
//
// Each preset returns the z / x / y expression strings for ffmpeg's `zoompan`
// filter. We render at a supersampled working size and then lanczos-downscale
// (in clip.js) which removes the well-known zoompan pixel jitter and gives a
// smooth "gimbal" feel.
//
// Coordinate model (with zoompan output size s == working input size iw x ih):
//   at zoom z the visible crop consumes iw/z x ih/z source pixels, so the
//   pan headroom is:  roomX = iw - iw/z ,  roomY = ih - ih/z.
//   Centering therefore is:  x = iw/2 - iw/zoom/2 ,  y = ih/2 - ih/zoom/2.

export const MOTIONS = [
  'push-in',
  'pull-out',
  'pan-left',
  'pan-right',
  'pan-up',
  'pan-down',
  'drone-up',
  'ken-burns',
  'still',
];

// Pleasing default rotation used when a photo's motion is "auto".
const AUTO_CYCLE = [
  'push-in',
  'pan-right',
  'pull-out',
  'pan-left',
  'drone-up',
  'push-in',
  'pan-down',
  'ken-burns',
];

export function autoMotion(index) {
  return AUTO_CYCLE[index % AUTO_CYCLE.length];
}

export function isMotion(name) {
  return name === 'auto' || MOTIONS.includes(name);
}

// Build zoompan expressions for a motion.
//   frames  – total frames in the clip (>=1)
//   opts.zoom – max zoom for push/pull (default 1.12)
//   opts.pan  – constant zoom used to create pan headroom (default 1.14)
export function motionExpr(motion, frames, opts = {}) {
  const N = Math.max(1, Math.round(frames));
  const zMax = opts.zoom ?? 1.12;
  const zPan = opts.pan ?? 1.14;

  // Normalised, eased progress 0..1 across the clip. Smoothstep for a gentle
  // ease-in/ease-out so moves start and settle softly instead of snapping.
  // Guard N-1 against divide-by-zero for single-frame clips.
  const denom = N > 1 ? N - 1 : 1;
  const p = `(on/${denom})`;
  const P = `(3*${p}*${p}-2*${p}*${p}*${p})`; // smoothstep(p)

  const cx = "iw/2-(iw/zoom/2)";
  const cy = "ih/2-(ih/zoom/2)";
  const roomX = "(iw-iw/zoom)";
  const roomY = "(ih-ih/zoom)";

  switch (motion) {
    case 'push-in':
      return { z: `1+${(zMax - 1).toFixed(4)}*${P}`, x: cx, y: cy };

    case 'pull-out':
      return { z: `${zMax.toFixed(4)}-${(zMax - 1).toFixed(4)}*${P}`, x: cx, y: cy };

    case 'pan-right':
      return { z: `${zPan.toFixed(4)}`, x: `${roomX}*${P}`, y: cy };

    case 'pan-left':
      return { z: `${zPan.toFixed(4)}`, x: `${roomX}*(1-${P})`, y: cy };

    case 'pan-up':
      return { z: `${zPan.toFixed(4)}`, x: cx, y: `${roomY}*(1-${P})` };

    case 'pan-down':
      return { z: `${zPan.toFixed(4)}`, x: cx, y: `${roomY}*${P}` };

    // Drone reveal: start low & zoomed in, rise up while pulling back.
    case 'drone-up':
      return {
        z: `${zMax.toFixed(4)}-${(zMax - 1).toFixed(4)}*${P}`,
        x: cx,
        y: `${roomY}*(1-${P})`,
      };

    // Diagonal Ken Burns: gentle zoom-in drifting toward the upper right.
    case 'ken-burns':
      return {
        z: `1+${(zMax - 1).toFixed(4)}*${P}`,
        x: `${roomX}*(0.25+0.5*${P})`,
        y: `${roomY}*(0.75-0.5*${P})`,
      };

    case 'still':
    default:
      // A barely-there push keeps a "still" from looking like a frozen JPEG.
      return { z: `1+0.02*${P}`, x: cx, y: cy };
  }
}
