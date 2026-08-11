// Build the Goldframe web app from its parts.
//
// SOURCE OF TRUTH
//   web/_app.html    the editor shell — markup, <style>, and the core <script>
//   web/parts/*.js   the AI layer, in small numbered files (loaded in name order)
//
// OUTPUTS (both generated — never hand-edit them)
//   dist/index.html  what Netlify publishes
//   web/studio.html  the standalone double-click / share-a-link copy
//
// Both outputs are identical apart from the wrapper, so a feature can never be
// live on the website but missing from the file you email a client.
//
// The parts are INLINED rather than linked with <script src>, for two reasons:
// the standalone copy has to work when opened straight off disk (file:// blocks
// module loading), and one file means one thing to upload, back up, or send.
//
// No third-party dependencies: Node built-ins only.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PARTS_DIR = resolve(ROOT, 'web/parts');
const MARKER = '<!--@parts-->';

// The Goldframe mark as an inline SVG favicon (gold brackets + charcoal play).
const FAVICON =
  "data:image/svg+xml," +
  "%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E" +
  "%3Cpath%20d='M8%2034%20L8%208%20L34%208'%20fill='none'%20stroke='%23E0B23C'%20stroke-width='9'/%3E" +
  "%3Cpath%20d='M66%208%20L92%208%20L92%2034'%20fill='none'%20stroke='%23E0B23C'%20stroke-width='9'/%3E" +
  "%3Cpath%20d='M92%2066%20L92%2092%20L66%2092'%20fill='none'%20stroke='%23E0B23C'%20stroke-width='9'/%3E" +
  "%3Cpath%20d='M34%2092%20L8%2092%20L8%2066'%20fill='none'%20stroke='%23E0B23C'%20stroke-width='9'/%3E" +
  "%3Cpolygon%20points='41,32%2073,50%2041,68'%20fill='%231D1F20'/%3E%3C/svg%3E";

function partFiles() {
  if (!existsSync(PARTS_DIR)) return [];
  return readdirSync(PARTS_DIR).filter((f) => f.endsWith('.js')).sort();
}

// Inline each part in its own <script> block, so a syntax error in one file
// cannot take the rest of the app down with it.
function buildParts() {
  const files = partFiles();
  if (!files.length) return { html: '', files };
  const blocks = files.map((f) => {
    const src = readFileSync(join(PARTS_DIR, f), 'utf8');
    if (src.includes('</script')) {
      throw new Error(`web/parts/${f} contains a literal "</script" — split it (e.g. "<\\/script") or it will break the page.`);
    }
    return `<!-- parts/${f} -->\n<script>\n${src.trim()}\n</script>`;
  });
  return { html: '\n' + blocks.join('\n') + '\n', files };
}

const shell = readFileSync(resolve(ROOT, 'web/_app.html'), 'utf8');
if (!shell.includes(MARKER)) {
  throw new Error(`web/_app.html is missing the ${MARKER} marker — the AI layer has nowhere to go.`);
}
const { html: partsHtml, files } = buildParts();
const app = shell.replace(MARKER, partsHtml);

const head = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Goldframe — turn listing photos and clips into cinematic real-estate reels. Assets in, ads out.">
<title>Goldframe — Assets in, ads out</title>
<link rel="icon" type="image/svg+xml" href="${FAVICON}">`;

const banner = `<!--
  Goldframe — generated file. Do not edit by hand.
  Edit web/_app.html (shell) or web/parts/*.js (AI layer), then run: npm run build:web
-->`;

const page = `<!doctype html>
<html lang="en">
<head>
${head}
</head>
<body>
${banner}
${app}
</body>
</html>
`;

mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
writeFileSync(resolve(ROOT, 'dist/index.html'), page);
writeFileSync(resolve(ROOT, 'web/studio.html'), page);

// The shared music library, if one has been built and committed. The app asks
// for music/library.json at runtime and simply shows an empty library when it
// isn't there, so this is optional by design.
let musicNote = '  Music library: none committed (the in-browser one still works)';
const MUSIC_SRC = resolve(ROOT, 'web/music');
if (existsSync(MUSIC_SRC)) {
  const out = resolve(ROOT, 'dist/music');
  mkdirSync(out, { recursive: true });
  const names = readdirSync(MUSIC_SRC).filter((f) => statSync(join(MUSIC_SRC, f)).isFile());
  names.forEach((f) => copyFileSync(join(MUSIC_SRC, f), join(out, f)));
  const audio = names.filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f)).length;
  musicNote = `  Music library: ${audio} track${audio === 1 ? '' : 's'} copied to dist/music`;
}

const kb = (page.length / 1024).toFixed(0);
console.log(`Built dist/index.html and web/studio.html (${kb} KB)`);
console.log(files.length ? `  AI layer: ${files.join(', ')}` : '  AI layer: (no parts found)');
console.log(musicNote);
