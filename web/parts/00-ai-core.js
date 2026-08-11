/* ============================================================================
   Goldframe AI — core
   ----------------------------------------------------------------------------
   One place that knows how to talk to an AI model, so every feature above it
   (staging, generative motion, voiceover, copywriting) is a few lines long.

   THE ONE BIG IDEA
   Every paid feature goes through fal.ai. fal is a front door to almost every
   model worth using — Kling, Veo, Seedance, Wan and Luma for video; FLUX.2 and
   Gemini/Nano-Banana for images; ElevenLabs and Kokoro for voice — behind ONE
   key, ONE way of asking, and ONE way of waiting for the answer. That means one
   account to set up, one bill to read, and one thing to change when a better
   model ships. Swapping "Kling" for "Veo" is a single line in the catalog.

   HOW A REQUEST FINDS ITS KEY (first one that works wins)
     1. Team key   — Sara's key, held on the server, unlocked by a team passcode.
                     Nobody on the team ever sees or pastes a key.
     2. Own key    — a visitor pastes their own key; it stays in their browser
                     and is forwarded, never stored by us.
     3. Free       — no key at all: the on-device features still work (see
                     10-ai-ondevice.js). Paid features say so politely.

   WHY THERE IS A SERVER STEP AT ALL
   Model providers will not let a web page hold a billing key safely — anyone
   could read it from the page and spend your money. The Netlify function in
   netlify/functions/ai.js is the smallest possible fix: it holds the team key,
   checks the passcode, and refuses to talk to anything that is not fal.
   ========================================================================== */
(function () {
  "use strict";

  var LS_KEY = "gf_ai_v1";       // settings (never contains the team key)
  var LS_LEDGER = "gf_ai_spend"; // running cost estimate, so spend is visible

  /* ------------------------------------------------------------------ catalog
     Prices are US dollars, checked August 2026. They are estimates shown to the
     user BEFORE anything is charged — never treat them as billing truth. Each
     entry is deliberately boring data so a non-programmer can add a new model
     by copying a line. */
  var CATALOG = {
    /* ---- photo -> moving video clip -------------------------------------
       `img` and `secs` name the fields that model expects. They differ between
       families, and this is the one place they are written down — if fal ever
       renames one, it is a one-word fix here rather than a hunt through code. */
    video: [
      { id: "wan/v2.6/image-to-video",                        name: "Wan 2.6",         blurb: "Best value. Natural, steady motion — the sensible default for a whole listing.", per: "second", price: 0.05,  max: 10, tier: "value",  img: "image_url",       secs: "duration" },
      { id: "fal-ai/kling-video/v2.6/pro/image-to-video",     name: "Kling 2.6 Pro",   blurb: "Smoother camera moves and cleaner edges. A step up in polish.",                 per: "second", price: 0.14,  max: 10, tier: "better", img: "image_url",       secs: "duration" },
      { id: "fal-ai/kling-video/v3/pro/image-to-video",       name: "Kling v3 Pro",    blurb: "Kling's newest. Holds architecture well and takes longer clips.",               per: "second", price: 0.112, max: 15, tier: "better", img: "start_image_url", secs: "duration" },
      { id: "fal-ai/veo3.1/fast/image-to-video",              name: "Veo 3.1 Fast",    blurb: "Google's model. Beautiful light and reflections. Hero-shot money.",             per: "second", price: 0.15,  max: 8,  tier: "best",   img: "image_url",       secs: "duration" },
      { id: "fal-ai/veo3.1/image-to-video",                   name: "Veo 3.1",         blurb: "The showreel option. Expensive — use it on one hero photo, not twelve.",        per: "second", price: 0.40,  max: 8,  tier: "best",   img: "image_url",       secs: "duration" },
      { id: "bytedance/seedance-2.0/image-to-video",          name: "Seedance 2.0",    blurb: "Very sharp, up to 4K. Strong on exteriors and drone-style reveals.",            per: "second", price: 0.3024, max: 15, tier: "best",  img: "image_url",       secs: "duration" }
    ],
    /* ---- editing a photo ------------------------------------------------- */
    edit: [
      { id: "fal-ai/flux-2-lora-gallery/apartment-staging",   name: "Staging specialist", blurb: "Trained only on furnishing rooms, so it can't wander off and redesign your windows. Cheapest and safest for staging.", per: "image", price: 0.021, tier: "value",  job: "stage", img: "image_urls" },
      { id: "fal-ai/flux-2-pro/edit",                         name: "FLUX.2 Pro",         blurb: "General-purpose photo editing. A good all-rounder for rooms and exteriors.",            per: "image", price: 0.045, tier: "better", job: "any",   img: "image_urls" },
      { id: "fal-ai/nano-banana-pro/edit",                    name: "Nano Banana Pro",    blurb: "Google's Gemini 3 Pro Image. Best at keeping a house exactly as it is — the right pick for adding people or changing a sky.", per: "image", price: 0.15, tier: "best", job: "any", img: "image_urls" }
    ],
    /* ---- narration ------------------------------------------------------- */
    tts: [
      { id: "fal-ai/kokoro/american-english",                 name: "Kokoro",             blurb: "Clean, natural American voice. Cheapest by a distance.",              per: "1k chars", price: 0.02, tier: "value",  txt: "prompt", voices: ["af_heart", "af_bella", "af_nicole", "am_michael", "am_puck", "bf_emma"] },
      { id: "fal-ai/elevenlabs/tts/turbo-v2.5",               name: "ElevenLabs Turbo",   blurb: "Warmer and more human. Fast.",                                        per: "1k chars", price: 0.05, tier: "better", txt: "text",   voices: ["Sarah", "Charlotte", "Matilda", "Brian", "George", "Will"] },
      { id: "fal-ai/elevenlabs/tts/eleven-v3",                name: "ElevenLabs v3",      blurb: "The warmest read money buys, and it returns word-by-word timing.", per: "1k chars", price: 0.10, tier: "best",   txt: "text",   voices: ["Sarah", "Charlotte", "Matilda", "Brian", "George", "Will"] }
    ],
    /* ---- looking at a photo and writing about it -------------------------- */
    text: [
      { id: "fal-ai/any-llm/vision",                          name: "Vision writer",      blurb: "Looks at each photo, names the room and writes the words.", per: "call", price: 0.003, tier: "value" },
      { id: "fal-ai/any-llm",                                 name: "Copywriter",         blurb: "Writes the script, hooks and social captions from your listing details.", per: "call", price: 0.002, tier: "value" }
    ]
  };

  /* ---------------------------------------------------------------- settings */
  var DEFAULTS = {
    videoModel: "wan/v2.6/image-to-video",
    editModel:  "fal-ai/flux-2-lora-gallery/apartment-staging",
    peopleModel:"fal-ai/nano-banana-pro/edit",
    ttsModel:   "fal-ai/kokoro/american-english",
    ttsVoice:   "af_heart",
    clipSeconds: 5,
    ownKey: "",        // the visitor's own fal key — this browser only
    teamCode: "",      // unlocks Sara's key on the server
    spendCap: 10,      // dollars per session before Goldframe stops and asks
    disclose: true     // AB 723 / MLS disclosure on altered images (see 40-)
  };

  var cfg = load();
  function load() {
    var out = {}, k;
    for (k in DEFAULTS) out[k] = DEFAULTS[k];
    try {
      var saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      for (k in saved) if (k in DEFAULTS) out[k] = saved[k];
    } catch (e) {}
    return out;
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  /* ------------------------------------------------------------- cost ledger
     People are far more comfortable spending money they can see. Every call
     adds its estimate here; the AI panel shows the running total and refuses to
     go past the cap without a fresh OK. */
  function ledger() {
    try { return JSON.parse(localStorage.getItem(LS_LEDGER) || "{}"); } catch (e) { return {}; }
  }
  function spentToday() {
    var l = ledger(), day = new Date().toISOString().slice(0, 10);
    return l.day === day ? (l.usd || 0) : 0;
  }
  function addSpend(usd) {
    var day = new Date().toISOString().slice(0, 10);
    var l = ledger();
    var next = { day: day, usd: (l.day === day ? (l.usd || 0) : 0) + usd };
    try { localStorage.setItem(LS_LEDGER, JSON.stringify(next)); } catch (e) {}
    fire("spend", next);
    return next.usd;
  }
  function resetSpend() {
    try { localStorage.removeItem(LS_LEDGER); } catch (e) {}
    fire("spend", { usd: 0 });
  }

  /* --------------------------------------------------------------- estimates */
  function findModel(task, id) {
    var list = CATALOG[task] || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  // What will this cost, roughly, before we do it?
  function estimate(task, id, amount) {
    var m = findModel(task, id);
    if (!m) return 0;
    if (m.per === "second") return m.price * (amount || cfg.clipSeconds);
    if (m.per === "1k chars") return m.price * ((amount || 0) / 1000);
    return m.price * (amount || 1);
  }
  function money(usd) {
    if (usd >= 1) return "$" + usd.toFixed(2);
    if (usd >= 0.01) return "$" + usd.toFixed(2);
    return "under a cent";
  }

  /* --------------------------------------------------------------- transport
     Two ways out of the browser, tried in order.

     A. The Netlify function at /.netlify/functions/ai. Present whenever the app
        is served from the deployed site. It adds the team key (passcode) or
        forwards the visitor's own key without keeping it.
     B. A direct call to fal, for the standalone studio.html copy where there is
        no server to help. Only possible with the visitor's own key. */
  var PROXY = "/.netlify/functions/ai";
  var proxyState = null; // null = unknown, true/false once probed

  // Only a definite answer is remembered. A probe that fails because the network
  // hiccuped or a serverless function was cold must not condemn the rest of the
  // session to "there is no server here" — that would tell a team member their
  // passcode doesn't work while they are staring at the site it works on.
  function haveProxy() {
    if (proxyState !== null) return Promise.resolve(proxyState);
    if (location.protocol === "file:") { proxyState = false; return Promise.resolve(false); }
    return fetch(PROXY + "?ping=1", { method: "GET" })
      .then(function (r) {
        if (r.ok) { proxyState = true; return true; }
        if (r.status === 404) { proxyState = false; return false; }  // definitely absent
        return false;                                                 // unknown: ask again next time
      })
      .catch(function () { return false; });
  }

  function credentials() {
    if (cfg.teamCode) return { mode: "team", label: "your team key" };
    if (cfg.ownKey)   return { mode: "own",  label: "your own key" };
    return { mode: "none", label: "" };
  }
  function ready() { return credentials().mode !== "none"; }

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    if (cfg.teamCode) h["x-gf-team"] = cfg.teamCode;
    else if (cfg.ownKey) h["x-gf-key"] = cfg.ownKey;
    return h;
  }

  /* Ask fal to start a job, then wait for it.
     `onProgress(text)` is called with plain-English status so the UI never has
     to show a raw queue state to a real-estate agent. */
  function run(task, modelId, input, opts) {
    opts = opts || {};
    var cred = credentials();
    if (cred.mode === "none") {
      return Promise.reject(new Error("NO_KEY"));
    }
    var cap = +cfg.spendCap || 0;
    var cost = opts.cost != null ? opts.cost : 0;
    if (cap > 0 && spentToday() + cost > cap && !opts.overCap) {
      var err = new Error("OVER_CAP");
      err.spent = spentToday(); err.cap = cap; err.cost = cost;
      return Promise.reject(err);
    }
    var say = opts.onProgress || function () {};

    return haveProxy().then(function (viaProxy) {
      if (viaProxy) return viaProxyCall(modelId, input, say, opts);
      if (cred.mode === "team") {
        throw new Error("TEAM_NEEDS_SITE");
      }
      return direct(modelId, input, say, opts);
    }).then(function (out) {
      if (cost) addSpend(cost);
      return out;
    });
  }

  function viaProxyCall(modelId, input, say, opts) {
    say("Sending it off…");
    return fetch(PROXY, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ model: modelId, input: input, sync: !!opts.sync })
    }).then(readJson).then(function (j) {
      if (j.error) throw describe(j);
      if (j.done) return j.result;
      return pollProxy(modelId, j.request_id, say, opts);
    });
  }

  // A generative video takes a minute, which is twenty or so status checks. On
  // café wi-fi, one of them will fail. Dropping the whole job at that point
  // would throw away work the model has already been paid for, so a handful of
  // consecutive network errors are tolerated before giving up.
  var POLL_TOLERANCE = 4;
  function transient(status) { return status === 429 || (status >= 500 && status < 600); }

  function pollProxy(modelId, id, say, opts) {
    var started = Date.now(), limit = (opts.timeoutMs || 8 * 60 * 1000), misses = 0;
    function tick() {
      if (Date.now() - started > limit) throw new Error("This is taking unusually long. The model may be busy — try again in a minute.");
      return wait(3000).then(function () {
        return fetch(PROXY + "?model=" + encodeURIComponent(modelId) + "&id=" + encodeURIComponent(id), {
          headers: authHeaders()
        }).then(readJson);
      }).then(function (s) {
        // A 502 from a cold serverless function, or a 429 on the status
        // endpoint, is a hiccup — not a reason to abandon a job the model is
        // already being paid for. Only a definite refusal ends the wait.
        if (s.error && transient(s.httpStatus)) {
          if (++misses > POLL_TOLERANCE) throw describe(s);
          say("The server is busy — still waiting…");
          return tick();
        }
        if (s.error) throw describe(s);
        misses = 0;
        if (s.status === "COMPLETED" || s.done) return s.result;
        say(s.status === "IN_QUEUE"
          ? "Waiting in the queue" + (s.queue_position ? " (" + s.queue_position + " ahead)" : "") + "…"
          : "Generating…");
        return tick();
      }, function (netErr) {
        if (++misses > POLL_TOLERANCE) throw netErr;
        say("Lost the connection for a moment — still waiting…");
        return tick();
      });
    }
    say("Sent. Waiting for the model…");
    return tick();
  }

  // Standalone copy, visitor's own key, straight to fal.
  function direct(modelId, input, say, opts) {
    var key = cfg.ownKey;
    var base = "https://queue.fal.run/" + modelId;
    say("Sending it off…");
    return fetch(base, {
      method: "POST",
      headers: { "Authorization": "Key " + key, "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }).then(readJson).then(function (j) {
      if (!j.request_id) throw describe(j);
      var started = Date.now(), limit = (opts.timeoutMs || 8 * 60 * 1000), misses = 0;
      function tick() {
        if (Date.now() - started > limit) throw new Error("This is taking unusually long. The model may be busy — try again in a minute.");
        return wait(3000).then(function () {
          return fetch(base + "/requests/" + j.request_id + "/status", { headers: { "Authorization": "Key " + key } }).then(readJson);
        }).then(function (s) {
          if (s.error && transient(s.httpStatus)) {
            if (++misses > POLL_TOLERANCE) throw describe(s);
            say("The server is busy — still waiting…");
            return tick();
          }
          if (s.error) throw describe(s);
          misses = 0;
          if (s.status === "COMPLETED") {
            return fetch(base + "/requests/" + j.request_id, { headers: { "Authorization": "Key " + key } }).then(readJson);
          }
          say(s.status === "IN_QUEUE"
            ? "Waiting in the queue" + (s.queue_position ? " (" + s.queue_position + " ahead)" : "") + "…"
            : "Generating…");
          return tick();
        }, function (netErr) {
          if (++misses > POLL_TOLERANCE) throw netErr;
          say("Lost the connection for a moment — still waiting…");
          return tick();
        });
      }
      return tick();
    }).catch(function (e) {
      if (e && /Failed to fetch|NetworkError|Load failed/i.test(e.message || "")) {
        throw new Error("This copy of Goldframe can't reach the AI service directly from your browser. Open the app at its web address (the Netlify site) and it will work.");
      }
      throw e;
    });
  }

  function readJson(r) {
    return r.text().then(function (t) {
      var j;
      try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { error: t || ("HTTP " + r.status) }; }
      if (!r.ok && !j.error) j.error = j.detail || j.message || ("HTTP " + r.status);
      if (!r.ok) j.httpStatus = r.status;
      return j;
    });
  }

  // Turn provider errors into something an estate agent can act on.
  function describe(j) {
    var raw = typeof j.error === "string" ? j.error : JSON.stringify(j.error || j.detail || j);
    var s = j.httpStatus;
    if (s === 401 || s === 403 || /unauthor|forbidden|invalid.*key/i.test(raw)) {
      return new Error("That key was refused. Check it in AI settings — or, if you're on the team, that the team passcode is right.");
    }
    if (s === 402 || /insufficient|balance|credit/i.test(raw)) {
      return new Error("The AI account is out of credit. Top it up at fal.ai and try again.");
    }
    if (s === 429 || /rate limit/i.test(raw)) {
      return new Error("Too many requests at once. Wait about a minute, then try again.");
    }
    if (/nsfw|safety|content polic/i.test(raw)) {
      return new Error("The model declined this image on safety grounds. Try a different photo or a plainer instruction.");
    }
    return new Error(raw.slice(0, 300));
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ----------------------------------------------------------------- uploads
     fal wants a URL for the input photo. A data: URL works and saves us running
     a file host, but it is heavy, so shrink first. 1600px on the long edge is
     plenty for every model here and keeps the request small. */
  function blobToDataUrl(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(new Error("Couldn't read that image.")); };
      fr.readAsDataURL(blob);
    });
  }

  function shrink(source, maxEdge, quality) {
    maxEdge = maxEdge || 1600;
    return toImage(source).then(function (img) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      var scale = Math.min(1, maxEdge / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      var c = document.createElement("canvas"); c.width = cw; c.height = ch;
      c.getContext("2d").drawImage(img, 0, 0, cw, ch);
      return c.toDataURL("image/jpeg", quality || 0.92);
    });
  }

  function toImage(source) {
    if (source instanceof HTMLImageElement && source.complete) return Promise.resolve(source);
    if (source instanceof HTMLCanvasElement) { var i = new Image(); i.src = source.toDataURL("image/jpeg", 0.92); return once(i); }
    if (source instanceof HTMLVideoElement) {
      var c = document.createElement("canvas");
      c.width = source.videoWidth; c.height = source.videoHeight;
      c.getContext("2d").drawImage(source, 0, 0);
      var im = new Image(); im.src = c.toDataURL("image/jpeg", 0.92); return once(im);
    }
    if (source instanceof Blob) {
      var b = new Image(), bu = URL.createObjectURL(source);
      b.src = bu;
      // Release the URL once the pixels are decoded — this path runs on every
      // repeat edit, so leaking one full-size JPEG per call adds up fast.
      return once(b).then(function (im) { try { URL.revokeObjectURL(bu); } catch (e) {} return im; },
                          function (e) { try { URL.revokeObjectURL(bu); } catch (e2) {} throw e; });
    }
    if (typeof source === "string") { var s = new Image(); s.crossOrigin = "anonymous"; s.src = source; return once(s); }
    return Promise.reject(new Error("Unsupported image source."));
  }
  function once(img) {
    return new Promise(function (res, rej) {
      if (img.complete && img.naturalWidth) return res(img);
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error("Couldn't load that image.")); };
    });
  }

  // Pull a finished file back off fal's CDN as a Blob we can put on the timeline.
  function fetchBlob(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Couldn't download the finished file.");
      return r.blob();
    });
  }

  /* -------------------------------------------------------------- tiny events */
  var listeners = {};
  function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
  function fire(name, data) { (listeners[name] || []).forEach(function (f) { try { f(data); } catch (e) {} }); }

  /* ------------------------------------------------------------------ export */
  window.GFAI = {
    CATALOG: CATALOG,
    cfg: cfg,
    save: save,
    findModel: findModel,
    estimate: estimate,
    money: money,
    run: run,
    ready: ready,
    credentials: credentials,
    haveProxy: haveProxy,
    spentToday: spentToday,
    addSpend: addSpend,
    resetSpend: resetSpend,
    shrink: shrink,
    toImage: toImage,
    blobToDataUrl: blobToDataUrl,
    fetchBlob: fetchBlob,
    on: on,
    fire: fire,
    // Check a key works without spending anything.
    test: function () {
      return haveProxy().then(function (viaProxy) {
        if (viaProxy) {
          return fetch(PROXY + "?check=1", { headers: authHeaders() }).then(readJson).then(function (j) {
            if (j.error) throw describe(j);
            return j;
          });
        }
        if (!cfg.ownKey) throw new Error("Paste your own key first — there's no server here to hold a team key.");
        return fetch("https://rest.alpha.fal.ai/tokens/", {
          method: "POST",
          headers: { "Authorization": "Key " + cfg.ownKey, "Content-Type": "application/json" },
          body: JSON.stringify({ allowed_apps: ["fal-ai/flux"], token_expiration: 60 })
        }).then(function (r) {
          if (r.status === 401 || r.status === 403) throw new Error("That key was refused.");
          return { ok: true, mode: "own" };
        });
      });
    }
  };
})();
