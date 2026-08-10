# Deploy Goldframe to Netlify (auto-deploy from GitHub)

The web app is a single self-contained page. `web/_app.html` is the source of
truth; the build step wraps it into `dist/index.html`, which Netlify publishes.
Once connected, **every push to the branch redeploys automatically** — no manual
uploads.

## One-time setup

1. Sign in at [app.netlify.com](https://app.netlify.com) (use *Log in with
   GitHub* so it can see the repo).
2. **Add new site → Import an existing project → GitHub**.
3. Pick the repository **`sarabeyersdorf-dot/video`**.
4. Netlify reads `netlify.toml`, so the fields are prefilled:
   - **Build command:** `node scripts/build-web.mjs`
   - **Publish directory:** `dist`
   - **Branch to deploy:** choose `main` (or whichever branch you want live).
5. Click **Deploy**. First build takes ~1 minute; you'll get a URL like
   `something-random.netlify.app`.

## After it's live

- **Rename the site:** Site configuration → *Change site name* (e.g.
  `goldframe`, giving `goldframe.netlify.app`).
- **Custom domain:** Domain management → *Add a domain* (e.g.
  `create.legacyproperties.com`) and follow the DNS steps.
- **Updates:** just push to the branch — Netlify rebuilds and redeploys. You can
  watch progress under the site's *Deploys* tab, and roll back to any previous
  deploy with one click.

## What the config does (`netlify.toml`)

- Runs `node scripts/build-web.mjs` to regenerate `dist/index.html` from
  `web/_app.html` on each deploy (no duplicated HTML to keep in sync).
- Serves `index.html` for any path (single-page app).
- Revalidates the HTML on each visit so new deploys show up immediately.
- Sets a few safe security headers. It intentionally does **not** set a
  Content-Security-Policy — the app needs its own inline script/style, `blob:`
  media, the canvas/MediaRecorder export pipeline, and (with permission) the
  microphone for voiceover; a strict CSP would break those.

## Notes

- Everything runs in each visitor's browser. Their drafts and Brand Kit are
  saved locally in their own browser — there's no shared server or database, so
  the site is free to host and private by default.
- To deploy manually instead (no GitHub), run `npm run build:web` and drag the
  `dist` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).
