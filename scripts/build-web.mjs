// Build the deployable single-page app from web/_app.html.
//
// web/_app.html is the source of truth (markup + <style> + <script>). This
// wraps it in a full HTML document — title + favicon — and writes it to
// dist/index.html so Netlify (or any static host) can serve it at the root.
//
// No third-party dependencies: Node built-ins only.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const app = readFileSync(resolve(ROOT, 'web/_app.html'), 'utf8');

// The Goldframe mark as an inline SVG favicon (gold brackets + charcoal play).
const FAVICON =
  "data:image/svg+xml," +
  "%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E" +
  "%3Cpath%20d='M8%2034%20L8%208%20L34%208'%20fill='none'%20stroke='%23E0B23C'%20stroke-width='9'/%3E" +
  "%3Cpath%20d='M66%208%20L92%208%20L92%2034'%20fill='none'%20stroke='%23E0B23C'%20stroke-width='9'/%3E" +
  "%3Cpath%20d='M92%2066%20L92%2092%20L66%2092'%20fill='none'%20stroke='%23E0B23C'%20stroke-width='9'/%3E" +
  "%3Cpath%20d='M34%2092%20L8%2092%20L8%2066'%20fill='none'%20stroke='%23E0B23C'%20stroke-width='9'/%3E" +
  "%3Cpolygon%20points='41,32%2073,50%2041,68'%20fill='%231D1F20'/%3E%3C/svg%3E";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Goldframe — turn listing photos and clips into cinematic real-estate reels. Assets in, ads out.">
<title>Goldframe — Assets in, ads out</title>
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
</head>
<body>
${app}
</body>
</html>
`;

const outDir = resolve(ROOT, 'dist');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'index.html'), html);
console.log(`Built dist/index.html (${html.length} bytes) from web/_app.html`);
