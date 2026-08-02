// Crossfade transitions between clips, expressed as ffmpeg xfade "transition"
// names. We keep a curated, tasteful subset — no gimmicky wipes by default.

export const TRANSITIONS = [
  'fade',
  'fadeblack',
  'fadewhite',
  'dissolve',
  'smoothleft',
  'smoothright',
  'smoothup',
  'smoothdown',
  'slideleft',
  'slideright',
  'circleopen',
  'radial',
];

// A calm default rotation that reads as "cinematic" rather than "slideshow".
const DEFAULT_CYCLE = ['fade', 'smoothleft', 'dissolve', 'smoothright', 'fade', 'smoothup'];

export function pickTransition(type, index) {
  if (!type || type === 'auto') return DEFAULT_CYCLE[index % DEFAULT_CYCLE.length];
  if (type === 'random') return TRANSITIONS[index % TRANSITIONS.length];
  if (TRANSITIONS.includes(type)) return type;
  return 'fade';
}

// Given clip durations and a transition duration, build an xfade filter_complex
// chain that overlaps neighbouring clips. Returns { filter, totalDuration }.
//
// Each clip stream is expected to be labelled [v0], [v1], ... on input.
// With N clips and transition T, the timeline length is:
//   sum(durations) - (N-1) * T   (each transition overlaps by T seconds).
export function buildXfadeChain({ count, durations, transDur, transitionType }) {
  if (count === 1) {
    return { filter: '[v0]null[vout]', totalDuration: durations[0] };
  }

  const parts = [];
  let prevLabel = 'v0';
  let offset = 0; // running start time of the *current* transition
  let acc = durations[0];

  for (let i = 1; i < count; i++) {
    const t = pickTransition(transitionType, i - 1);
    // Transition starts T seconds before the end of the accumulated timeline.
    offset = acc - transDur;
    const outLabel = i === count - 1 ? 'vout' : `x${i}`;
    parts.push(
      `[${prevLabel}][v${i}]xfade=transition=${t}:duration=${transDur}:offset=${offset.toFixed(4)}[${outLabel}]`
    );
    // After the overlap, the timeline grows by the next clip minus the overlap.
    acc = acc + durations[i] - transDur;
    prevLabel = outLabel;
  }

  return { filter: parts.join(';'), totalDuration: acc };
}
