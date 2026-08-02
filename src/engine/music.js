// Background-music handling: trim/loop a track to the video length and apply
// fade-in / fade-out. Returns the audio-graph fragment + input args, or null
// when no music is supplied (the final mux then produces a silent video).

export function musicInput({ file, videoDuration, volume = 0.7, fadeIn = 1.2, fadeOut = 2.0 }) {
  if (!file) return null;
  const fadeOutStart = Math.max(0, videoDuration - fadeOut);
  // -stream_loop -1 loops a short track to cover longer videos; -t on output trims.
  const inputArgs = ['-stream_loop', '-1', '-i', file];
  const filter =
    `volume=${volume},` +
    `afade=t=in:st=0:d=${fadeIn},` +
    `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut},` +
    `atrim=0:${videoDuration.toFixed(3)},asetpts=N/SR/TB`;
  return { inputArgs, filter };
}
