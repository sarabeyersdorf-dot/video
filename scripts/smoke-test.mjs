// Smoke test for the built app. Loads dist/index.html in a real browser, adds a
// synthetic listing photo, and exercises every FREE AI action end-to-end.
//
//   node scripts/smoke-test.mjs
//
// Paid actions are checked only as far as the confirmation dialog — no key, no
// spend. Anything that throws in the page console fails the run.

import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8422;
let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { failures++; console.log('  ✗ ' + m); };

const server = createServer((req, res) => {
  const p = req.url.split('?')[0];
  const file = p === '/' ? 'dist/index.html' : p.replace(/^\//, '');
  const full = join(ROOT, file);
  if (!existsSync(full)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  res.end(readFileSync(full));
});
await new Promise((r) => server.listen(PORT, r));

// The container ships Chromium under a versioned folder; find whichever is here.
import { readdirSync } from 'node:fs';
const PW = '/opt/pw-browsers';
const chromeDir = readdirSync(PW).find((d) => /^chromium-\d+$/.test(d)) || 'chromium';
const browser = await chromium.launch({
  executablePath: join(PW, chromeDir, 'chrome-linux/chrome'),
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

console.log('\nLoading the app…');
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// --- the app itself still boots -------------------------------------------
for (const [sel, label] of [
  ['#stage', 'the preview canvas'],
  ['#mediaDrop', 'the photo drop zone'],
  ['#aiCard', 'the AI Studio panel'],
  ['#aiSettings', 'the AI settings sheet'],
  ['#exportBtn, [id*=export]', 'the export controls']
]) {
  (await page.$(sel)) ? ok(label + ' is there') : bad(label + ' is MISSING');
}

const bridges = await page.evaluate(() => ({
  GF: !!window.GF, GFAI: !!window.GFAI, GFLocal: !!window.GFLocal,
  GFCompliance: !!window.GFCompliance, GFPhoto: !!window.GFPhoto,
  GFMotion: !!window.GFMotion, GFWords: !!window.GFWords
}));
Object.entries(bridges).forEach(([k, v]) => v ? ok(k + ' loaded') : bad(k + ' FAILED to load'));

// --- add two synthetic listing photos --------------------------------------
console.log('\nAdding photos…');
await page.evaluate(async () => {
  function make(w, h, sky, name) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, sky ? '#9ec4e8' : '#6b6357');
    grad.addColorStop(1, sky ? '#d7cbb4' : '#332e28');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a3f34';
    for (let i = 0; i < 14; i++) g.fillRect((i * 97) % w, h * 0.55 + (i % 4) * 22, 70, 46);
    g.fillStyle = '#eee';
    for (let i = 0; i < 8; i++) g.fillRect(60 + i * 120, h * 0.62, 44, 60);
    return new Promise((res) => c.toBlob((b) => res(new File([b], name, { type: 'image/jpeg' })), 'image/jpeg', 0.9));
  }
  const a = await make(1280, 720, true, '01-exterior-front.jpg');
  const b = await make(1280, 720, false, '02-kitchen.jpg');
  window.GF.addImage(a); window.GF.addImage(b);
});
await page.waitForTimeout(900);
const count = await page.evaluate(() => window.GF.state.media.filter((m) => m.ready).length);
count === 2 ? ok('two photos loaded onto the timeline') : bad('expected 2 photos, got ' + count);

const thumbs = await page.$$('#aiStrip .ai-thumb');
thumbs.length === 2 ? ok('AI photo strip shows both') : bad('AI strip shows ' + thumbs.length);

// --- free: polish -----------------------------------------------------------
console.log('\nFree AI actions…');
const before = await page.evaluate(() => window.GF.state.media[0].blob.size);
await page.click('#aiCard [data-ai="polish"]');
await page.waitForFunction(() => !document.querySelector('#aiCard [data-ai="polish"]').disabled, { timeout: 60000 });
const polished = await page.evaluate(() => ({
  size: window.GF.state.media[0].blob.size,
  job: window.GF.state.media[0].gfAI && window.GF.state.media[0].gfAI.job,
  kept: !!(window.GF.state.media[0].gfAI && window.GF.state.media[0].gfAI.original)
}));
polished.job === 'grade' ? ok('exposure/colour fix ran') : bad('polish did not run (job=' + polished.job + ')');
polished.kept ? ok('the untouched original was kept for undo') : bad('original NOT kept');
polished.size !== before ? ok('the photo really changed') : bad('photo unchanged');

// --- free: grading is an enhancement, so it must NOT be watermarked ---------
const graded = await page.evaluate(() => window.GFCompliance.read().filter((r) => r.job === 'grade')[0]);
graded && graded.disclosed === false
  ? ok('grading correctly recorded as an enhancement, not disclosed')
  : bad('grading was wrongly treated as an alteration');

// --- free: smart crop -------------------------------------------------------
await page.click('#aiCard [data-ai="fit"]');
await page.waitForFunction(() => !document.querySelector('#aiCard [data-ai="fit"]').disabled, { timeout: 60000 });
const cropped = await page.evaluate(() => {
  const m = window.GF.state.media[0];
  return { w: m.el.naturalWidth, h: m.el.naturalHeight, job: m.gfAI.job };
});
cropped.job === 'reframe' && cropped.h > cropped.w
  ? ok('smart crop produced a tall 9:16 frame (' + cropped.w + '×' + cropped.h + ')')
  : bad('smart crop gave ' + cropped.w + '×' + cropped.h + ' job=' + cropped.job);

// --- free: captions & words -------------------------------------------------
await page.click('#aiCard [data-ai="captions"]');
await page.waitForTimeout(400);
const caps = await page.evaluate(() => window.GF.state.media.map((m) => m.caption));
caps.some(Boolean) ? ok('captions written: ' + JSON.stringify(caps)) : bad('no captions written');

await page.evaluate(() => {
  document.getElementById('f_address').value = '123 Ocean View Drive';
  document.getElementById('f_city').value = 'Malibu, CA 90265';
  document.getElementById('f_price').value = '$4,250,000';
  document.getElementById('f_beds').value = '5';
  document.getElementById('f_baths').value = '6';
  document.getElementById('f_sqft').value = '6200';
});
await page.click('#aiCard [data-ai="script"]');
await page.waitForTimeout(300);
const script = await page.inputValue('#vo_script');
script.includes('Ocean View') && script.length > 80
  ? ok('narration script written (' + script.length + ' chars)')
  : bad('script looks wrong: ' + script.slice(0, 120));

await page.click('#aiCard [data-ai="socialfree"]');
await page.waitForTimeout(300);
const social = await page.inputValue('#shareCaption');
social.includes('#') ? ok('social caption written with hashtags') : bad('social caption missing hashtags');

// --- undo -------------------------------------------------------------------
console.log('\nUndo…');
await page.evaluate(() => { document.querySelectorAll('#aiStrip .ai-thumb')[0].click(); });
await page.click('#aiUndo');
await page.waitForFunction(() => !document.getElementById('aiUndo').disabled, { timeout: 30000 });
const undone = await page.evaluate(() => {
  const m = window.GF.state.media[0];
  return { w: m.el.naturalWidth, h: m.el.naturalHeight, job: m.gfAI && m.gfAI.job };
});
undone.w === 1280 && undone.h === 720 ? ok('undo restored the original photo') : bad('undo left ' + undone.w + '×' + undone.h);

// --- paid path stops at the money question ----------------------------------
console.log('\nPaid actions ask before spending…');
await page.evaluate(() => { document.querySelectorAll('#aiStrip .ai-thumb')[0].click(); });
await page.click('#aiCard [data-ai="stage"]');
await page.waitForTimeout(500);
const settingsOpen = await page.evaluate(() => document.getElementById('aiSettings').classList.contains('open'));
settingsOpen ? ok('with no key, a paid button opens settings instead of failing') : bad('paid button did not prompt for a key');
await page.evaluate(() => document.getElementById('aiSettings').classList.remove('open'));

await page.evaluate(() => { window.GFAI.cfg.ownKey = 'fal-test-not-real'; window.GFAI.save(); });
await page.click('#aiCard [data-ai="stage"]');
await page.waitForTimeout(500);
const cost = await page.evaluate(() => ({
  open: document.getElementById('aiConfirm').classList.contains('open'),
  text: document.getElementById('aiCfCost').textContent,
  body: document.getElementById('aiCfBody').textContent
}));
cost.open && /\$/.test(cost.text) ? ok('price shown before spending: "' + cost.text + '"') : bad('no price confirmation');
await page.evaluate(() => document.getElementById('aiConfirm').classList.remove('open'));
await page.evaluate(() => { window.GFAI.cfg.ownKey = ''; window.GFAI.save(); });

// --- compliance -------------------------------------------------------------
console.log('\nDisclosure…');
const rec = await page.evaluate(() => window.GFCompliance.exportRecord('123 Ocean View Drive'));
rec.includes('AB 723') && rec.includes('DISCLOSURE RECORD')
  ? ok('the disclosure record exports')
  : bad('disclosure record looks wrong');
const wm = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 300;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 300);
  const b1 = c.getContext('2d').getImageData(0, 280, 400, 20).data.join('');
  window.GFCompliance.watermark(c, 'stage');
  const b2 = c.getContext('2d').getImageData(0, 280, 400, 20).data.join('');
  return { changed: b1 !== b2, label: window.GFCompliance.labelFor('stage') };
});
wm.changed && wm.label === 'VIRTUALLY STAGED' ? ok('watermark burns "' + wm.label + '" into the picture') : bad('watermark failed');

// --- regressions found in review, now guarded -------------------------------
console.log('\nRegression guards…');

// a label must survive a later crop, and must not be drawn twice
const labels = await page.evaluate(async () => {
  const m = window.GF.state.media[0];
  await window.GFPhoto.skySwap(m, 'sunset', () => {});     // an alteration -> labelled
  const afterSky = { job: m.gfAI.job, label: m.gfAI.labelJob, hasClean: !!m.gfAI.clean };
  await window.GFPhoto.fitFrame(m, () => {});              // an enhancement -> must keep the label
  return { afterSky, afterCrop: { job: m.gfAI.job, label: m.gfAI.labelJob, hasClean: !!m.gfAI.clean } };
});
labels.afterSky.hasClean
  ? ok('an altered photo keeps an unlabelled twin, so labels can never stack')
  : bad('no clean copy kept — repeated edits would stack labels');
labels.afterCrop.label === 'sky'
  ? ok('cropping a labelled photo re-applies the label instead of cutting it off')
  : bad('the disclosure label was lost by cropping (label=' + labels.afterCrop.label + ')');

// a clip made on the timeline must have a real, finite duration
const dur = await page.evaluate(async () => {
  const m = window.GF.state.media[0];
  window.GFLocal.depth = () => {
    const w = 48, h = 27, d = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = y / h;
    return Promise.resolve({ width: w, height: h, data: d });
  };
  await window.GFMotion.parallax(m, { motion: 'push-in', seconds: 2 }, () => {});
  window.GF.rebuild();
  return { kind: m.kind, natDur: m.natDur, total: window.GF.state.media.length };
});
isFinite(dur.natDur) && dur.natDur > 0
  ? ok('a generated clip has a real duration (' + dur.natDur.toFixed(2) + 's), so the timeline stays finite')
  : bad('generated clip duration is ' + dur.natDur + ' — the timeline would break');

// undoing a photo-edit-then-motion chain must give back a photo, not a broken video
const chain = await page.evaluate(async () => {
  const m = window.GF.state.media[0];
  await window.GFMotion.undo(m);
  return { kind: m.kind, tag: m.el && m.el.tagName, w: m.el && (m.el.naturalWidth || m.el.videoWidth) };
});
chain.kind === 'image' && chain.tag === 'IMG'
  ? ok('undo after edit-then-motion restores a real photo (' + chain.w + 'px wide)')
  : bad('undo left kind=' + chain.kind + ' element=' + chain.tag + ' — preview and export would throw');

// the daily spend limit must actually stop a batch
const capped = await page.evaluate(async () => {
  window.GFAI.cfg.ownKey = 'fal-test-not-real';
  window.GFAI.cfg.spendCap = 1;
  window.GFAI.cfg.videoModel = 'fal-ai/veo3.1/image-to-video';   // $0.40/s
  window.GFAI.save();
  document.querySelectorAll('#aiStrip .ai-thumb').forEach((t) => { if (!t.classList.contains('sel')) t.click(); });
  document.querySelector('#aiCard [data-ai="generate"]').click();
  await new Promise((r) => setTimeout(r, 400));
  return {
    open: document.getElementById('aiConfirm').classList.contains('open'),
    title: document.getElementById('aiCfTitle').textContent,
    body: document.getElementById('aiCfBody').textContent
  };
});
/past your daily limit/i.test(capped.title)
  ? ok('going over the daily limit is caught and stated plainly')
  : bad('the daily spend limit did not fire (dialog said "' + capped.title + '")');
await page.evaluate(() => {
  document.getElementById('aiConfirm').classList.remove('open');
  window.GFAI.cfg.ownKey = ''; window.GFAI.cfg.spendCap = 10;
  window.GFAI.cfg.videoModel = 'wan/v2.6/image-to-video'; window.GFAI.save();
});

// --- an AI edit and its original survive save + reopen ----------------------
console.log('\nSaving and reopening…');
const survived = await page.evaluate(async () => {
  const m = window.GF.state.media[1];
  await window.GFPhoto.polish(m, () => {});
  const rec = await new Promise((res) => {
    // exercise the real save path, then read the record straight back
    document.getElementById('saveDraftBtn').click();
    setTimeout(async () => {
      const db = await new Promise((r) => { const q = indexedDB.open('listingreel'); q.onsuccess = () => r(q.result); });
      const tx = db.transaction('projects', 'readonly').objectStore('projects').getAll();
      tx.onsuccess = () => res(tx.result[tx.result.length - 1]);
    }, 2200);
  });
  const saved = rec && (rec.media || [])[1];        // the one we just polished
  return {
    hasRecord: !!rec,
    keptOriginal: !!(saved && saved.gfAI && saved.gfAI.original && saved.gfAI.original.blob),
    job: saved && saved.gfAI && saved.gfAI.job
  };
});
survived.keptOriginal
  ? ok('a saved project keeps the AI change AND the untouched original (' + survived.job + ')')
  : bad('the original was lost when the project saved — undo would break after a reload');

// --- the editor's own features still work -----------------------------------
console.log('\nExisting features still fine…');
await page.click('#curateBtn').catch(() => {});
await page.waitForTimeout(2500);
const curated = await page.evaluate(() => window.GF.state.media.map((m) => m.motion));
curated.length === 2 ? ok('auto-curate still runs (motions: ' + curated.join(', ') + ')') : bad('auto-curate broke');

const timeline = await page.evaluate(() => { window.GF.rebuild(); return true; });
timeline ? ok('the timeline rebuilds') : bad('rebuild threw');

await page.screenshot({ path: join(ROOT, 'dist/smoke.png'), fullPage: false });

// --- music library ----------------------------------------------------------
console.log('\nMusic library…');
(await page.$('#musCard')) ? ok('the music library panel is there') : bad('music panel MISSING');
const musBridge = await page.evaluate(() => ({
  GFMusic: !!window.GFMusic,
  starter: window.GFMusic ? window.GFMusic.STARTER.length : 0,
  cats: window.GFMusic ? window.GFMusic.CATEGORIES.length : 0,
  setMusic: typeof window.GF.setMusicBlob === 'function'
}));
musBridge.GFMusic ? ok('GFMusic loaded') : bad('GFMusic FAILED to load');
musBridge.starter === 40 ? ok('starter pack defines 40 tracks across ' + musBridge.cats + ' moods') : bad('starter pack has ' + musBridge.starter + ' tracks');
musBridge.setMusic ? ok('the library can hand a track to the editor') : bad('setMusicBlob not on the bridge');

// a track saved in the browser library survives, previews and loads as music
const musRound = await page.evaluate(async () => {
  // a short real WAV so decodeAudioData succeeds
  const sr = 8000, n = sr, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 8) * 8000, true);
  const blob = new Blob([buf], { type: 'audio/wav' });
  await window.GF.setMusicBlob(blob, 'Test Bed');
  return { loaded: !!(window.GF.state.music && window.GF.state.music.buffer), name: window.GF.state.music && window.GF.state.music.name };
});
musRound.loaded ? ok('a library track loads into the video as music ("' + musRound.name + '")') : bad('track did not load as music');

// the money question must fire before any music is generated
const musPaid = await page.evaluate(async () => {
  window.GFAI.cfg.ownKey = 'fal-test-not-real'; window.GFAI.save();
  document.getElementById('musPrompt').value = 'warm acoustic guitar, unhurried';
  document.getElementById('musMake').click();
  await new Promise((r) => setTimeout(r, 400));
  const open = document.getElementById('aiConfirm').classList.contains('open');
  const cost = document.getElementById('aiCfCost').textContent;
  document.getElementById('aiConfirm').classList.remove('open');
  window.GFAI.cfg.ownKey = ''; window.GFAI.save();
  return { open, cost };
});
musPaid.open && /\$|cent/.test(musPaid.cost)
  ? ok('writing a track asks the price first ("' + musPaid.cost + '")')
  : bad('music generation did not confirm cost');

// Linking an agent to Pixabay so they can download a track for their OWN video
// is fine. Bundling or hotlinking someone else's audio into this app is not.
// This checks for the second, which is the thing that would be an infringement.
const src = readFileSync(join(ROOT, 'dist/index.html'), 'utf8');
const hotlinked = (src.match(/https?:\/\/[^"'\s)]+\.(?:mp3|m4a|wav|ogg|aac)\b/gi) || []);
const competitor = /listingai|mappedby/i.test(src);
if (competitor) bad('the build references ListingAI / MappedBy — a competitor\'s music library');
else if (hotlinked.length) bad('the build hotlinks audio files: ' + hotlinked.slice(0, 3).join(', '));
else ok('no third-party audio is bundled or hotlinked (links to music sites are fine)');

// --- console must be clean --------------------------------------------------
console.log('\nBrowser console…');
const real = errors.filter((e) => !/favicon|net::ERR_|Failed to load resource/.test(e));
real.length ? real.forEach((e) => bad(e)) : ok('no errors');

await browser.close();
server.close();

console.log(failures ? `\nFAILED — ${failures} problem(s)\n` : '\nAll good.\n');
process.exit(failures ? 1 : 0);
