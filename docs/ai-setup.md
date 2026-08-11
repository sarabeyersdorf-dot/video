# Goldframe AI — setup, in plain English

You do not need to understand any code to use this. There are three things to
know: what's free, what costs money, and how to turn the paid part on.

---

## 1. What you get for free, today, with no setup at all

Open the app and there's a new panel called **AI Studio**. Everything marked
**FREE** runs inside your own browser. Nothing is uploaded, nothing is charged,
and it works offline once the page has loaded.

| Button | What it does |
| --- | --- |
| **Polish this whole listing** | Fixes exposure and colour on every photo, captions each one, and puts them in a sensible order. Start here. |
| **Fix exposure & colour** | Lifts dark shadows, stops windows blowing out, removes the yellow cast from indoor bulbs. |
| **Smart crop to frame** | Turns a wide photo into a tall reel by keeping the part worth keeping — not just the middle. |
| **Replace the sky** | Swaps a flat white sky for blue, bright, sunset or dusk. |
| **3D depth move** | Works out how far away everything is and pushes the camera *through* the room. This is the big one — it looks like drone footage, and it costs nothing. |
| **Caption every clip** | Names each room from the photo's filename and its contents. |
| **Write the narration** | Writes a script from your listing details. |
| **Write the post** | Writes the Instagram caption and hashtags. |

The first time you use **3D depth move** or **Replace the sky**, the app quietly
downloads a small AI model (about 19 MB and 5 MB). After that it's instant and
works offline. If the download can't happen, it falls back to a rougher method
rather than failing.

---

## 2. What costs money

Four things genuinely need a model too big to run on a laptop:

| Feature | Roughly |
| --- | --- |
| Furnish an empty room | **2 cents** a photo |
| Remove clutter / restyle furniture | 2–5 cents a photo |
| Add people to a shot | 15 cents a photo |
| AI video clip (real generative motion) | **25 cents** for a 5-second clip on the default model |
| Read the narration in a real voice | about 2 cents for a 30-second script |

A whole listing done properly — eight photos furnished, three turned into AI
video clips, narrated — lands around **$1.20**. The comparable listing-video
websites charge $30–$80 for the same thing.

---

## 3. Turning on the paid part

You have two routes. **Route A is what you want for yourself and your team.**

### Route A — one account, everyone uses it, nobody sees a key

**Step 1. Get a fal.ai key.**

1. Go to <https://fal.ai> and sign up.
2. Add a payment card. Put $20 on it to start — that is a lot of listings.
3. Go to <https://fal.ai/dashboard/keys> and click **Add key**.
4. Copy it. It looks like a long string of letters and numbers.

**Step 2. Put it into Netlify (this is the bit that keeps it safe).**

1. Open your site in Netlify.
2. **Site configuration → Environment variables → Add a variable.**
3. Add these two:

   | Name | Value |
   | --- | --- |
   | `GF_FAL_KEY` | the key you copied from fal.ai |
   | `GF_TEAM_CODE` | a passcode you invent — see the warning below |

   **Make the passcode long and random**, like `legacy-7Kq2-vTm9-Rd4x`, not
   `legacy2026`. Anyone who guesses it can spend money on your fal account. The
   proxy locks out an address after twelve wrong tries in ten minutes, but a
   guessable passcode is still a guessable passcode.

4. Optionally add `GF_ORIGIN` set to your site's address (e.g.
   `https://goldframe.netlify.app`). That stops *other websites* using your key
   from a visitor's browser. It's a browser rule, so it doesn't stop someone who
   already has the passcode — which is why the passcode matters more.
5. **Deploys → Trigger deploy → Deploy site.**

**Step 3. Tell your team the passcode.**

Each person opens the app once, clicks **AI Studio → Settings**, types the
passcode into "Team passcode", and clicks Save. That's it — they never see or
handle a key, and everything they generate bills to your one account.

If you ever need to cut someone off, change `GF_TEAM_CODE` in Netlify and
redeploy. Everyone re-enters the new one.

### Route B — clients and other agents bring their own key

Anyone who visits your site can click **AI Studio → Settings**, paste their own
fal.ai key, and use every paid feature at their own expense. Their key is stored
in their own browser and never touches your account or your bill.

This is on by default. To turn it off — team-only site — add the environment
variable `GF_ALLOW_BYOK` set to `false`.

### Keeping a lid on spending

In **AI Studio → Settings** there's a daily limit, set to **$10** out of the box.
When a day's estimated spend passes it, Goldframe stops and asks before doing
anything else. Set it to `0` to remove the limit.

The number Goldframe shows is its own estimate, not a bill. Your real total is
always on your fal.ai dashboard.

---

## 4. The disclosure rules — read this part

**California AB 723 has been in force since 1 January 2026.** If a listing image
is changed to *add, remove or alter a physical element* — furniture, a sky,
landscaping, people — then your marketing must say so clearly, and must tell
people how to see the untouched original. That covers the MLS, your website,
social media and print.

Brightness, contrast, white balance and cropping are specifically **excluded**.
They're enhancements, not alterations.

Goldframe encodes that line for you:

- **Polish, smart crop** → silent. Nothing to disclose.
- **Furnish, restyle, declutter, sky, add people, AI video** → the label
  (`VIRTUALLY STAGED` / `DIGITALLY ALTERED` / `AI-GENERATED MOTION`) is burned
  into the picture the moment it's made, so it survives every repost, crop and
  screenshot.
- Your **original photo is always kept** and one click restores it.
- **Copy MLS disclosure line** gives you the wording for your listing remarks.
- **Download the AI record** gives you a dated log of every AI change, which
  model made it, and what it was asked to do — the thing you hand a broker or an
  MLS if anyone ever queries a photo.

Some MLSs want more than the law does. CRMLS wants a watermark *and* a note in
the remarks; Bright wants "Virtually Staged" in the photo caption; MRED and NWMLS
want a watermark. Goldframe's default satisfies all of those at once.

One rule the software can't enforce for you: **never alter structure.** Adding a
sofa is disclosable staging. Adding a window is misrepresentation, everywhere.

*This is a sensible, documented default — not legal advice. Check your own MLS's
rules.*

---

## 5. Which model should I pick?

The defaults are chosen to be cheap and safe. Change them in **Settings** only if
you have a reason.

**Video** — default **Wan 2.6** at 5¢/second because it's steady and cheap enough
to use on a whole listing. Step up to **Veo 3.1 Fast** (15¢/s) for one hero shot;
its light and reflections are noticeably better. Full **Veo 3.1** at 40¢/s is
showreel money — $16 for a listing — so don't make it your default.

**Furnishing rooms** — default **Staging specialist**, which is trained only on
placing furniture. That's the point: a general model can wander off and redesign
your windows, and this one can't. It's also the cheapest.

**People and skies** — default **Nano Banana Pro** (Google's Gemini 3 Pro Image).
It costs more, but it's the best at leaving a house exactly as photographed,
which is exactly what you need when the edit is *next to* the building rather
than inside it.

**Voice** — default **Kokoro** at 2¢ per 1,000 characters. **ElevenLabs v3** is
noticeably warmer for five times the price, and it returns word-by-word timing.

---

## 6. If something goes wrong

| What you see | What it means |
| --- | --- |
| "That key was refused" | The key or passcode is wrong. Re-copy it from fal.ai; keys have no spaces. |
| "The AI account is out of credit" | Top up at fal.ai. |
| "Team keys only work on the Goldframe website" | You're using the downloaded `studio.html` file. Team keys live on the server, so open the real site instead — or paste your own key. |
| "This needs the app open at a web address" | Same thing: some features need the app served over the web, not opened from your desktop. |
| "Couldn't find much sky in this photo" | The sky finder wants a decent amount of visible sky. |
| "The model declined this image" | The safety filter fired. Try another photo or plainer wording. |
| A paid button does nothing | No key set up yet — Settings opens automatically the first time. |

---

## 7. For whoever maintains the code

```
web/_app.html            the editor — markup, styles, core script
web/parts/*.js           the AI layer, loaded in number order
  00-ai-core             keys, provider catalog, cost, the one call() everything uses
  10-ai-ondevice         free: grading, cropping, depth, segmentation
  20-ai-compliance       disclosure rules, watermark, audit record
  30-ai-photo            staging, decluttering, people, skies
  40-ai-motion           3D depth moves (free) and generative clips (paid)
  50-ai-words-voice      captions, script, social copy, narration
  60-ai-ui               the panel
netlify/functions/ai.mjs the key-holding proxy
scripts/build-web.mjs    builds dist/index.html AND web/studio.html
scripts/smoke-test.mjs   runs the whole free path in a real browser
```

```bash
npm run build:web    # after ANY edit to _app.html or parts/
npm test             # smoke test in a real browser
```

`web/studio.html` and `dist/index.html` are **generated**. Never edit them by
hand — edit `web/_app.html` or a file in `web/parts/` and rebuild.

Adding a new model is one line in the `CATALOG` at the top of `00-ai-core.js`,
plus its prefix in the `ALLOWED` list in `netlify/functions/ai.mjs`.
