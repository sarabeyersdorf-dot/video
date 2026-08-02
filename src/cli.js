// CLI wiring for `reel`.

import { Command } from 'commander';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, statSync } from 'node:fs';
import { assertFfmpeg, probeDuration } from './engine/ffmpeg.js';
import { loadProject, validateProject } from './config.js';
import { assemble } from './engine/assemble.js';
import { MOTIONS } from './engine/motions.js';
import { TRANSITIONS } from './engine/transitions.js';
import { FORMATS } from './formats.js';
import { THEMES } from './themes.js';
import { makeDemoPhotos } from './demo.js';
import { log, color, setQuiet } from './util/log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');

function fmtDuration(s) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m ? `${m}m ${sec}s` : `${sec}s`;
}

async function runRender(project, opts) {
  const version = await assertFfmpeg();
  log.detail(version);

  for (const w of validateProject(project)) log.warn(w);

  log.info('');
  log.info(color.bold('  ListingReel'));
  log.detail(`format   ${project.format.key} — ${project.format.width}x${project.format.height}`);
  log.detail(`theme    ${project.theme.key}  accent ${project.theme.accent}`);
  log.detail(`photos   ${project.photos.length}   clip ${project.clipDuration}s   fps ${project.fps}`);
  log.detail(`music    ${project.music ? path.basename(project.music) : 'none'}`);
  log.detail(`output   ${project.outputFile}`);
  log.info('');

  const t0 = Date.now();
  const result = await assemble(project, { keepTemp: !!opts.keepTemp });
  const dur = await probeDuration(result.output).catch(() => result.duration);
  const size = existsSync(result.output) ? (statSync(result.output).size / 1e6).toFixed(1) : '?';

  log.info('');
  log.done(`Video ready: ${color.bold(result.output)}`);
  log.detail(`length ${fmtDuration(dur)}   size ${size} MB   rendered in ${fmtDuration((Date.now() - t0) / 1000)}`);
  return result;
}

export function buildProgram() {
  const program = new Command();
  program
    .name('reel')
    .description('Turn property photos into cinematic real-estate marketing videos.')
    .version('0.1.0');

  // reel create --------------------------------------------------------------
  program
    .command('create', { isDefault: true })
    .argument('[config]', 'path to a listing JSON config (see `reel init`)')
    .description('Render a listing video from a config and/or a folder of photos')
    .option('-p, --photos <dir>', 'folder of property photos (used when config has no photos)')
    .option('-o, --out <file>', 'output video path')
    .option('-f, --format <name>', `output format: ${Object.keys(FORMATS).join(', ')}`)
    .option('-t, --theme <name>', `visual theme: ${Object.keys(THEMES).join(', ')}`)
    .option('--accent <hex>', 'accent color, e.g. #C6A15B')
    .option('-m, --music <file>', 'background music file')
    .option('--motion <name>', 'force one motion for all photos (default: auto-varied)')
    .option('--transition <name>', 'transition style: auto, random, or a specific name')
    .option('--clip-duration <sec>', 'seconds per photo', parseFloat)
    .option('--fps <n>', 'frames per second', parseInt)
    .option('--max <n>', 'use at most N photos', parseInt)
    .option('--no-intro', 'skip the intro card')
    .option('--no-outro', 'skip the outro / branding card')
    .option('--no-ai', 'ignore any ai block in config (force local engine)')
    .option('--keep-temp', 'keep intermediate clips for debugging')
    .option('-q, --quiet', 'suppress progress output')
    .action(async (config, o) => {
      setQuiet(o.quiet);
      const cli = {
        photos: o.photos,
        out: o.out,
        format: o.format,
        theme: o.theme,
        accent: o.accent,
        music: o.music,
        motion: o.motion,
        transition: o.transition,
        clipDuration: o.clipDuration,
        fps: o.fps,
        max: o.max,
        // Only override config when the negatable flag was actually passed
        // (commander leaves these `true` by default, which would otherwise
        // clobber an `intro:false` in the config file).
        intro: o.intro === false ? false : undefined,
        outro: o.outro === false ? false : undefined,
        ai: o.ai === false ? false : undefined,
      };
      const project = loadProject({ configPath: config, cli });
      await runRender(project, o);
    });

  // reel init ----------------------------------------------------------------
  program
    .command('init')
    .argument('[dir]', 'project folder to create', '.')
    .description('Scaffold a listing project (config + photos/ + assets/ folders)')
    .action((dir) => {
      const root = path.resolve(dir);
      mkdirSync(path.join(root, 'photos'), { recursive: true });
      mkdirSync(path.join(root, 'assets'), { recursive: true });
      mkdirSync(path.join(root, 'output'), { recursive: true });
      const dest = path.join(root, 'listing.json');
      if (existsSync(dest)) {
        log.warn(`listing.json already exists in ${root} — not overwriting.`);
      } else {
        copyFileSync(path.join(PKG_ROOT, 'templates', 'listing.example.json'), dest);
        log.done(`Created ${dest}`);
      }
      log.info('');
      log.info('Next steps:');
      log.detail(`1. Drop your listing photos into ${path.join(dir, 'photos')}/`);
      log.detail(`2. (Optional) add ${path.join(dir, 'assets')}/music.mp3 and logo.png`);
      log.detail(`3. Edit ${path.join(dir, 'listing.json')} — address, price, agent details`);
      log.detail(`4. Run:  ${color.accent(`reel create ${path.join(dir, 'listing.json')}`)}`);
    });

  // reel demo ----------------------------------------------------------------
  program
    .command('demo')
    .description('Generate sample photos and render a demo video (no assets needed)')
    .option('-o, --out <file>', 'output path', 'demo/listing-demo.mp4')
    .option('-f, --format <name>', 'output format', 'reel')
    .option('-t, --theme <name>', 'theme', 'luxe')
    .action(async (o) => {
      await assertFfmpeg();
      const demoDir = path.resolve('demo');
      const photosDir = path.join(demoDir, 'photos');
      mkdirSync(photosDir, { recursive: true });
      log.step('Generating sample property photos…');
      await makeDemoPhotos(photosDir);

      const project = loadProject({
        configPath: null,
        cli: { photos: photosDir, out: path.resolve(o.out), format: o.format, theme: o.theme },
      });
      // Fill in demo listing/agent copy since there is no config file.
      Object.assign(project.listing, {
        tagline: 'Modern Coastal Masterpiece',
        address: '123 Ocean View Drive',
        city: 'Malibu, CA 90265',
        price: '$4,250,000', beds: 5, baths: 6, sqft: 6200,
      });
      Object.assign(project.agent, {
        name: 'Your Name Here', title: 'Broker Associate',
        brokerage: 'Your Brokerage', phone: '(555) 123-4567',
        email: 'you@example.com', license: 'DRE #01234567',
      });
      const captions = ['Grand Entrance', 'Open Living', 'Chef\'s Kitchen', 'Primary Suite', 'Infinity Pool'];
      project.photos.forEach((p, i) => (p.caption = captions[i] || null));
      await runRender(project, o);
    });

  // reel motions / themes / formats -----------------------------------------
  program
    .command('motions')
    .description('List available camera motions')
    .action(() => {
      log.info(color.bold('Camera motions:'));
      for (const m of MOTIONS) log.detail(m);
      log.detail('auto  (default — varies motion per photo)');
    });

  program
    .command('themes')
    .description('List available visual themes')
    .action(() => {
      log.info(color.bold('Themes:'));
      for (const [k, v] of Object.entries(THEMES)) log.detail(`${k.padEnd(8)} ${v.label}`);
    });

  program
    .command('formats')
    .description('List available output formats')
    .action(() => {
      log.info(color.bold('Formats:'));
      for (const [k, v] of Object.entries(FORMATS)) log.detail(`${k.padEnd(8)} ${v.label}`);
      log.info(color.bold('\nTransitions:'));
      log.detail(TRANSITIONS.join(', ') + ', auto, random');
    });

  return program;
}

export async function run(argv) {
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
  } catch (err) {
    log.error(err.message || String(err));
    process.exitCode = 1;
  }
}
