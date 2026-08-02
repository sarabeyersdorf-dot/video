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
| `drone-up` | rising "drone reveal" |
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

## Install

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

## Optional: true AI-generative motion

The default engine (Ken Burns–style camera motion) needs no API keys and is what
most listing reels use. If you want **generative** motion — parallax, moving
water, drifting clouds, walk-throughs — you can hand each photo to an external
image-to-video model (Higgsfield, Runway, Kling, Luma, …) via the `ai` block:

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
