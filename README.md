# ListingReel 🎬🏡

Turn a folder of **property photos** into a **cinematic listing video** — with camera
motion, crossfades, background music, animated captions, and a branded intro &
call-to-action card for your brokerage — all from one command.

It's built for real-estate agents who want something like
[propertyvideos.ai](https://propertyvideos.ai) but **running on their own
machine, for free, in seconds** — no per-video credits, no uploads, no watermark.

```
reel create listing.json
✓ Video ready: output/123-ocean-view.mp4   length 24s   size 11 MB
```

---

## What it makes

Each photo gets a smooth cinematic camera move — the same moves the paid tools sell:

| Motion | Feel |
| --- | --- |
| `push-in` | slow zoom in — draws the viewer into the room |
| `pull-out` | slow zoom out — reveals the whole space |
| `pan-left` / `pan-right` | glide across wide rooms & views |
| `pan-up` / `pan-down` | tilt up façades / down staircases |
| `drone-up` | rising "drone reveal" (2D; see the parallax engine for a 3D version) |
| `ken-burns` | diagonal zoom + drift |
| `still` | almost no motion |

…then everything is stitched with tasteful **crossfades**, scored with your
**music**, captioned with **lower-thirds**, and topped & tailed with a **branded
intro card** (address, price, beds/baths/sqft) and an **outro card** (your name,
brokerage, phone, email, license, and a call to action).

Export any aspect ratio from the same photos:

- `reel` — vertical **9:16** for Instagram Reels / TikTok / YouTube Shorts
- `square` — **1:1** for the Instagram feed
- `wide` — **16:9** for YouTube / MLS / your website

---

## Two ways to use it

**A. Browser app — no install (`web/studio.html`)**
Open `web/studio.html` in Chrome, Edge, or Safari (double-click it, or host it on
your site). Drag in photos, drone clips, your logo, and music; fill in the listing
and your branding; preview live; and click **Export video** to download a finished
reel. It renders 100% in the browser — nothing is uploaded — so you can also share
the page link with clients and they can make their own. Best for quick, on-the-spot
videos and non-technical use.

The app also includes:

- **Projects (drafts & finals).** Your work — *including the photos and video
  clips* — is auto-saved to the browser and kept in a Projects library. Save a
  **draft** to keep working, or a **final** when it's done; reopen either anytime.
  Nothing is lost when you leave. Use **Projects → Export** to save a portable
  project file (media included) you can move between computers or back up.
- **Brand Kit.** A settings menu that stores your logo, agent headshot, a
  banner/nameplate, a broker icon, and all your contact info **once** — then
  applies them to every new video automatically.
- **Photos + video together.** Drop property photos and drone/walk-through clips
  into the same reel; the clips play inline with the stills, with your music and
  branding over the whole thing.
- **Auto-montage from raw video.** Drop several raw clips, pick a total length
  (15–60s or "match the music") and orientation, and the editor scans each clip,
  finds its most dynamic, well-lit moment, and cuts them into a montage for you.
- **Beat-sync.** It detects the tempo of your music and snaps every cut to the
  beat so transitions land on the downbeat. Free-to-use music sources (Pixabay,
  Mixkit, YouTube Audio Library — commercial use, no attribution) are linked
  right in the Music panel.
- **Animated agent nameplate** that slides in over the footage, plus a headshot
  chip, from your Brand Kit.
- **Hooks & animated captions.** A punchy opening hook ("JUST LISTED", the price,
  "4 BED · 3 BA", the city — one-tap suggestions from your listing) animates in
  over the first seconds with a pop / slide / typewriter / word-by-word / bar-wipe
  style, plus an optional closing hook. Per-clip captions now animate in (slide /
  pop / fade) with an accent-bar wipe.
- **Voiceover.** The app writes a narration script from your listing; hear it read
  by a computer voice to check pacing, then either **record it in your own voice**
  (one tap) or **import an AI-voice file** — the narration is mixed into the export
  and the music **ducks** automatically underneath it. (Browser speech can't be
  captured into a video file, so the recorded/imported track is what lands in the
  export.)

> On the shareable claude.ai link, browser storage can be cleared between visits,
> so for a permanent library use the downloaded/hosted copy of `web/studio.html`,
> or keep projects with **Projects → Export**.

**B. Command-line tool — for power & scale (below)**
1080p output, batch rendering, the depth-parallax engine, and the pluggable AI
layer. Best when you make lots of videos or want the highest quality.

## Install (command-line tool)

You need **[FFmpeg](https://ffmpeg.org/download.html)** (the free video engine) and
**Node.js 18+**.

```bash
# 1. FFmpeg
#    macOS:    brew install ffmpeg
#    Windows:  https://www.gyan.dev/ffmpeg/builds/  (add to PATH)
#    Ubuntu:   sudo apt-get install ffmpeg

# 2. This tool
git clone <this repo> listing-reel && cd listing-reel
npm install
npm link            # makes the `reel` command available everywhere (optional)
```

If you skip `npm link`, just prefix commands with `node bin/reel.js` instead of `reel`.

### See it work right now (no photos needed)

```bash
reel demo
```

This generates sample photos and renders `demo/listing-demo.mp4` so you can watch
the whole thing end-to-end before setting up a real listing.

---

## Make your first real video

### 1. Scaffold a project

```bash
reel init my-listing
```

Creates:

```
my-listing/
  listing.json      ← edit this
  photos/           ← drop your listing photos here (they play in filename order)
  assets/           ← put music.mp3, logo.png here
  output/           ← finished videos land here
```

### 2. Add your photos & details

Drop 4–10 photos into `photos/` (name them `01-...`, `02-...` to control order),
then open `listing.json` and fill in the address, price, and your agent info.

### 3. Render

```bash
reel create my-listing/listing.json
```

That's it. The finished `.mp4` is in `my-listing/output/`.

---

## The config file

Everything is driven by one JSON file (see
[`templates/listing.example.json`](templates/listing.example.json)):

```jsonc
{
  "output": { "format": "reel", "file": "output/123-ocean-view.mp4" },
  "theme":  { "name": "luxe", "accent": "#C6A15B", "musicVolume": 0.7 },

  "clipDuration": 4.0,                          // seconds per photo
  "transition": { "type": "auto", "duration": 0.8 },
  "music": "assets/music.mp3",

  "listing": {
    "tagline": "Modern Coastal Masterpiece",
    "address": "123 Ocean View Drive",
    "city": "Malibu, CA 90265",
    "price": "$4,250,000",
    "beds": 5, "baths": 6, "sqft": 6200
  },

  "agent": {
    "name": "Sara Beyersdorf",
    "title": "Broker Associate",
    "brokerage": "Sara Sells California",
    "phone": "(555) 123-4567",
    "email": "sara@sarasellscalifornia.com",
    "license": "DRE #01234567",
    "logo": "assets/logo.png"
  },

  "photos": [
    { "file": "photos/01-exterior.jpg", "motion": "push-in",  "caption": "Grand Entrance" },
    { "file": "photos/02-living.jpg",   "motion": "pan-right", "caption": "Open Living" },
    { "file": "photos/03-pool.jpg",     "motion": "drone-up" }
  ]
}
```

- **Leave `motion` off** (or set `"auto"`) and ListingReel varies the moves for you.
- **`caption`** is optional per photo — it shows as a lower-third.
- Any missing field is simply skipped (no empty labels).
- If you omit the `photos` array entirely, run with `--photos <folder>` and every
  image in that folder is used in filename order.

### Themes

`luxe` (dark + gold, serif — high-end), `modern` (clean white/blue),
`minimal` (understated), `bold` (high-contrast reels).
Run `reel themes` to list them. Override the accent color with `"accent"` or `--accent`.

---

## Command reference

```bash
reel create [config]        # render a video (default command)
reel init [dir]             # scaffold a new listing project
reel demo                   # sample photos + sample render
reel motions                # list camera motions
reel themes                 # list visual themes
reel formats                # list formats & transitions
```

Handy `create` flags (override the config on the fly):

```bash
reel create listing.json --format square           # make a 1:1 version
reel create listing.json --theme bold --accent "#F0552B"
reel create listing.json --photos ./photos --out promo.mp4   # no config, just a folder
reel create listing.json --motion push-in          # force one motion for all photos
reel create listing.json --no-intro --no-outro     # photos only
reel create listing.json --music track.mp3
```

Run `reel create --help` for the full list.

> **Music tip:** use tracks you're licensed to use (e.g. from your Instagram/YouTube
> audio library, Epidemic Sound, Artlist, etc.). ListingReel doesn't ship music.

---

## Drone fly-overs & aerial looks

There are three ways to get real drone/aerial-style motion, from free to premium:

### 1. Your own drone footage & aerial photos (free, best quality)

If you already have drone clips or aerial shots, just list them like any photo —
`.mp4`, `.mov`, `.webm` are all fine. They're trimmed and dropped straight into
the same branded intro / caption / music / outro pipeline, mixed freely with stills:

```jsonc
"photos": [
  { "file": "photos/00-drone-flyover.mp4", "duration": "full", "caption": "Aerial Tour" },
  { "file": "photos/01-exterior.jpg", "motion": "push-in", "caption": "Grand Entrance" }
]
```

- `"duration": "full"` uses the whole clip; a number uses that many seconds.
- `"start": 6` trims the first 6 seconds off the front.

### 2. Local 2.5D depth parallax (free, on your machine)

The default `kenburns` engine moves a flat photo (zoom/pan). The **`parallax`**
engine estimates a **depth map** and moves the photo in 3D, so near objects shift
more than far ones — a real dimensional "push through" a room, not a flat zoom:

```bash
reel create listing.json --engine parallax
```

or per-photo: `{ "file": "kitchen.jpg", "engine": "parallax" }`.

For good depth, install a depth model once (runs on CPU, no GPU needed):

```bash
pip install numpy pillow torch transformers
python3 tools/estimate_depth.py photos/      # writes photos/<name>.depth.png
```

ListingReel picks those depth maps up automatically. Without a model it falls
back to numpy+Pillow with a crude heuristic depth (works, but flatter). Keep
parallax moves subtle — from a single photo, big moves reveal edges the photo
never captured (this is true of every photo-to-3D tool).

> **What this is not:** neither engine can fly *through* a wall into a room the
> photo doesn't show, or invent an aerial shot from a ground-level photo — that
> needs real footage (option 1) or generative AI (option 3).

### 3. Generative AI (premium, per-clip credits)

For genuine generative motion from a single photo — drone-like moves with real
parallax, moving water, drifting clouds, walk-throughs — hand each photo to an
external image-to-video model (Higgsfield, Runway, Kling, Luma, …) via the `ai`
block. This is the closest match to what the paid websites do for those shots:

```jsonc
"ai": {
  "provider": "command",
  "command": "higgsfield generate create --type image-to-video --image {image} --prompt 'slow cinematic {motion}, real estate, photorealistic' --duration {duration} --output {out}"
}
```

ListingReel runs your command once per photo (substituting `{image}`, `{out}`,
`{motion}`, `{duration}`, `{width}`, `{height}`, `{fps}`), then drops the returned
clips into the same intro/caption/music/outro pipeline. This keeps you free to use
any provider or CLI — including the [Higgsfield CLI](https://github.com/higgsfield-ai/cli).
Use `--no-ai` to force the free local engine even when a config has an `ai` block.

---

## How it works (under the hood)

1. Each photo is rendered to a motion clip with FFmpeg's `zoompan`, supersampled
   and lanczos-downscaled so the zoom/pan is buttery-smooth (no jitter).
2. Branded intro/outro cards are rendered as their own clips over a darkened,
   softly-pushing version of your first/last photo.
3. Everything is crossfaded together with `xfade` and mixed with music
   (`afade` in/out), then encoded to a web-ready H.264 MP4 (`+faststart`).

No cloud, no account, no watermark — it all runs locally.

---

## License

MIT.
