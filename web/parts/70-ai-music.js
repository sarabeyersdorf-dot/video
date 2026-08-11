/* ============================================================================
   Goldframe — the music library
   ----------------------------------------------------------------------------
   WHY THIS EXISTS RATHER THAN A FOLDER OF DOWNLOADED TRACKS

   Nearly every "royalty-free" music site grants a SYNC licence: you may put the
   track in YOUR video. Almost none grant a DISTRIBUTION licence: you may put the
   track in YOUR PRODUCT so OTHER people can use it. Goldframe is shared with
   clients and other agents, so it needs the second — and a download button on
   someone's website is not a licence to redistribute.

   Checked while building this, and all of them say no in writing: Pixabay
   ("cannot distribute the Content on a Standalone basis"), Mixkit ("make any
   item available to any third party"), Uppbeat ("only in material published by
   yourself"), Bensound (which bans use in "software that produces or generates
   videos" — this app, by name), and the YouTube Audio Library (YouTube only).

   So Goldframe makes its own. Tracks are generated once, kept in this browser,
   and belong to whoever generated them. No attribution line, no credit in the
   export, no third party who can switch it off.

   TWO LIBRARIES SIT SIDE BY SIDE
     Shipped   music/library.json in the deployed site — the pack the whole
               team shares. Absent until someone builds and commits one.
     Yours     tracks you generate, kept in this browser's storage. Works the
               moment you press the button, with nothing to set up.

   ON COPYRIGHT, HONESTLY: the US Copyright Office holds that purely AI-generated
   material is not protected by copyright. That means nobody owns these tracks —
   including you. It does not matter here: you need the right to USE the music,
   not the right to stop others using it, and unprotected material carries no
   rights for anyone to assert against you. Your finished video, with your
   footage and edit, is still yours.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------------- the moods
     Five categories, because that is genuinely how listing music divides up.
     The prompts are written to produce beds a narrator can talk over: no
     vocals, no big transients, nothing that fights the voice. */
  var CATEGORIES = ["Luxury", "Warm", "Modern", "Upbeat", "Ambient"];

  var STARTER = [
    // ---- Luxury ---------------------------------------------------------
    ["Luxury", "Slow Piano Estate",   "Slow solo grand piano, sparse and elegant, gentle rubato, soft sustain pedal, warm room reverb, no drums, no vocals, refined and unhurried"],
    ["Luxury", "Strings At Dusk",     "Cinematic string ensemble, warm legato cellos and violins, slow build, sparse piano underneath, no percussion, no vocals, majestic but restrained"],
    ["Luxury", "Brushed Jazz Trio",   "Soft jazz trio, brushed drums, upright bass, mellow piano chords, relaxed swing, hotel lounge at night, instrumental only, understated"],
    ["Luxury", "Harp And Air",        "Gentle harp arpeggios with airy string pads, graceful and weightless, slow tempo, no percussion, no vocals, quietly opulent"],
    ["Luxury", "Modern Penthouse",    "Sleek cinematic ambient, warm analog synth pad, delicate piano motif, subtle sub bass, slow pulse, no vocals, premium and modern"],
    ["Luxury", "Cello And Piano",     "Solo cello with piano accompaniment, classical inspired, tender and timeless, slow tempo, no percussion, no vocals"],
    ["Luxury", "Late Saxophone",      "Mellow tenor saxophone over soft piano chords and light upright bass, intimate and sophisticated, slow, instrumental"],
    ["Luxury", "Guitar Villa",        "Nylon string classical guitar, Mediterranean feel, warm and unhurried, light string pad, no percussion, no vocals"],
    // ---- Warm -----------------------------------------------------------
    ["Warm",   "Acoustic Welcome",    "Warm fingerpicked acoustic guitar, cosy and inviting, light room tone, gentle tempo, no vocals, family home feeling"],
    ["Warm",   "Sunday Kitchen",      "Light acoustic guitar with soft shaker and gentle piano, cheerful and relaxed, mid tempo, instrumental, unhurried domestic warmth"],
    ["Warm",   "Golden Hour Ukulele", "Warm ukulele and acoustic guitar, sunset feeling, soft claps, friendly and approachable, no vocals"],
    ["Warm",   "Porch Light",         "Gentle folk guitar with light mandolin, nostalgic small town warmth, slow mid tempo, instrumental"],
    ["Warm",   "Hearth",              "Soft fingerstyle guitar with gentle cello, intimate and comforting, slow, no percussion, no vocals"],
    ["Warm",   "Garden Flute",        "Light acoustic guitar with soft flute, pastoral and serene, gentle tempo, instrumental, cottage garden"],
    ["Warm",   "Family Piano",        "Warm piano with acoustic guitar underneath, uplifting and wholesome, gentle build, no vocals"],
    ["Warm",   "Open Door",           "Bright acoustic guitar with light hand claps and soft percussion, welcoming and optimistic, mid tempo, instrumental"],
    // ---- Modern ---------------------------------------------------------
    ["Modern", "City Loft",           "Lo-fi electronic beat with warm ambient pads and soft electric piano, relaxed, understated, instrumental, urban apartment feeling"],
    ["Modern", "Glass And Steel",     "Minimal electronic, clean arpeggio, deep sub bass, spacious reverb, architectural and sleek, no vocals"],
    ["Modern", "New Build",           "Bright modern electronic pop instrumental, clean synth plucks, light four on the floor, fresh and contemporary, no vocals"],
    ["Modern", "Skyline",             "Atmospheric synth pads with a gentle pulsing beat, wide stereo, modern high rise at night, instrumental"],
    ["Modern", "Smart Home",          "Clean precise electronic, crisp percussion, subtle glitch textures, tech forward and tidy, instrumental"],
    ["Modern", "Vinyl Room",          "Retro soul inspired instrumental, warm Rhodes electric piano, round bass, brushed drums, midcentury modern, no vocals"],
    ["Modern", "Concrete Light",      "Deep ambient electronic, slow evolving pads, sparse piano notes, spacious and calm, no vocals"],
    ["Modern", "Studio Session",      "Chill downtempo electronic, soft beat, muted keys, creative and minimal, instrumental"],
    // ---- Upbeat ---------------------------------------------------------
    ["Upbeat", "Just Listed",         "Upbeat acoustic pop instrumental, strummed guitar, claps, light kit drums, bright piano, cheerful and energetic, no vocals"],
    ["Upbeat", "Open House",          "Feel good pop instrumental, bright piano chords, hand claps, driving but friendly, no vocals"],
    ["Upbeat", "Move In Ready",       "Optimistic indie pop instrumental, bouncy bass, clean electric guitar, light drums, hopeful, no vocals"],
    ["Upbeat", "Aerial Reveal",       "Epic cinematic build, soaring strings, big percussion, wide and inspiring, no vocals, drone footage energy"],
    ["Upbeat", "Curb Appeal",         "Upbeat funk instrumental, rhythm guitar, walking bass, tight drums, fun and engaging, no vocals"],
    ["Upbeat", "Marimba Tour",        "Bright marimba with acoustic guitar and light percussion, lively and playful walkthrough energy, instrumental"],
    ["Upbeat", "Keys In Hand",        "Triumphant orchestral pop, building drums, bright brass, celebratory arrival, no vocals"],
    ["Upbeat", "Fresh Start",         "Light pop rock instrumental, clean guitars, steady drums, positive forward momentum, no vocals"],
    // ---- Ambient --------------------------------------------------------
    ["Ambient","Morning Light",       "Gentle ambient piano with soft string pad, peaceful sunrise, very slow, spacious reverb, no percussion, no vocals"],
    ["Ambient","Still Water",         "Calm ambient with soft water like textures and slow pads, tranquil lakeside, no percussion, no vocals"],
    ["Ambient","Wide Horizon",        "Expansive ambient pads with distant acoustic guitar, panoramic and breathtaking, very slow, instrumental"],
    ["Ambient","Zen Garden",          "Minimal ambient, soft bells, bamboo flute, deep space between notes, Japanese inspired tranquility, no vocals"],
    ["Ambient","Coastal Breeze",      "Light airy ambient with soft ocean textures and gentle guitar, breezy beachfront calm, instrumental"],
    ["Ambient","Desert Warmth",       "Warm ambient with reverberant slide guitar and soft pads, arid open landscape, slow, no vocals"],
    ["Ambient","Forest Edge",         "Nature inspired ambient with soft strings and gentle woodwind, wooded and peaceful, no percussion, no vocals"],
    ["Ambient","Twilight Rhodes",     "Soft ambient with gentle Rhodes electric piano and warm pads, evening, dreamy and slow, no vocals"]
  ];

  var TAIL = ". Instrumental only, no vocals, no lyrics, no speech. Consistent level throughout, suitable as background music under a narrator. Clean ending.";

  /* ------------------------------------------------------------- storage
     A small store of its own rather than sharing the editor's project
     database — music outlives any one project. */
  var DB = null;
  function db() {
    if (DB) return DB;
    DB = new Promise(function (res, rej) {
      var r = indexedDB.open("gf_music", 1);
      r.onupgradeneeded = function () {
        if (!r.result.objectStoreNames.contains("tracks")) r.result.createObjectStore("tracks", { keyPath: "id" });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return DB;
  }
  function put(rec) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction("tracks", "readwrite").objectStore("tracks").put(rec);
        t.onsuccess = function () { res(rec); }; t.onerror = function () { rej(t.error); };
      });
    });
  }
  function all() {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction("tracks", "readonly").objectStore("tracks").getAll();
        t.onsuccess = function () { res(t.result || []); }; t.onerror = function () { rej(t.error); };
      });
    }).catch(function () { return []; });
  }
  function del(id) {
    return db().then(function (d) {
      return new Promise(function (res) {
        var t = d.transaction("tracks", "readwrite").objectStore("tracks").delete(id);
        t.onsuccess = function () { res(); }; t.onerror = function () { res(); };
      });
    });
  }

  /* ---------------------------------------------------- the shipped library
     music/library.json next to the app, if anyone has built one. Missing is
     the normal case and must not look like an error. */
  var shipped = [];
  function loadShipped() {
    if (location.protocol === "file:") return Promise.resolve([]);
    return fetch("music/library.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (j) { return (j && j.tracks) || []; })
      .catch(function () { return []; });
  }

  /* --------------------------------------------------------------- making
     One track. `seconds` is what the user hears; each model wants it in its
     own units, or not at all. */
  function generate(opts, say) {
    opts = opts || {};
    var modelId = opts.model || window.GFAI.cfg.musicModel || "cassetteai/music-generator";
    var model = window.GFAI.findModel("music", modelId);
    if (!model) return Promise.reject(new Error("That music model isn't in the list any more — pick another in AI settings."));
    var seconds = Math.max(15, Math.min(model.max, opts.seconds || 60));
    var prompt = (opts.prompt || "").trim();
    if (!prompt) return Promise.reject(new Error("Describe the music you want first."));

    var input = {};
    input[model.txt] = prompt + TAIL;
    if (model.dur) input[model.dur] = model.durUnit === "ms" ? Math.round(seconds * 1000) : seconds;
    if (/elevenlabs/.test(modelId)) input.force_instrumental = true;

    say && say("Composing…");
    return window.GFAI.run("music", modelId, input, {
      cost: window.GFAI.estimate("music", modelId, seconds),
      onProgress: say, overCap: opts.overCap, timeoutMs: 5 * 60 * 1000
    }).then(function (r) {
      var url = pickAudioUrl(r);
      if (!url) throw new Error("The model finished but didn't return any audio. Try again.");
      say && say("Downloading…");
      return window.GFAI.fetchBlob(url);
    }).then(function (blob) {
      var rec = {
        id: "t" + Date.now() + "_" + Math.floor(Math.random() * 1e6),
        name: opts.name || prompt.slice(0, 40),
        category: opts.category || "Modern",
        prompt: prompt, model: model.name, modelId: modelId,
        seconds: seconds, at: Date.now(), blob: blob
      };
      return put(rec).then(function () { return rec; });
    });
  }

  function pickAudioUrl(r) {
    if (!r) return null;
    if (typeof r === "string") return r;
    if (r.audio_file) return r.audio_file.url || r.audio_file;
    if (r.audio) return r.audio.url || r.audio;
    if (r.audio_url) return r.audio_url.url || r.audio_url;
    if (r.output) return pickAudioUrl(r.output);
    if (r.data) return pickAudioUrl(r.data);
    return null;
  }

  /* ------------------------------------------------------------- the pack
     Forty tracks, one after another. Sequential on purpose: a failure part way
     through leaves everything already made safely in the library, and the run
     can simply be repeated to fill the gaps. */
  var packCancel = false;
  function buildPack(opts, say, onOne) {
    opts = opts || {};
    var todo = STARTER.slice();
    packCancel = false;
    return all().then(function (have) {
      var known = {};
      have.forEach(function (t) { known[t.name] = true; });
      todo = todo.filter(function (row) { return !known[row[1]]; });   // resume, don't duplicate
      var made = 0, failed = [];
      function next(i) {
        if (packCancel || i >= todo.length) return Promise.resolve({ made: made, failed: failed, total: todo.length });
        var row = todo[i];
        say && say("Composing " + (i + 1) + " of " + todo.length + " — " + row[1] + " (" + row[0] + ")…");
        return generate({
          prompt: row[2], name: row[1], category: row[0],
          seconds: opts.seconds || 60, model: opts.model, overCap: true
        }).then(function (rec) { made++; onOne && onOne(rec); }, function (e) {
          if (/NO_KEY|refused|credit|OVER_CAP/i.test(e.message)) throw e;
          failed.push(row[1]);
        }).then(function () { return next(i + 1); });
      }
      return next(0);
    });
  }

  /* ----------------------------------------------------------- export pack
     A plain, uncompressed ZIP. MP3s are already compressed, so storing them
     saves nothing and costs a dependency. Hand this file to Claude in a session
     with the repo attached and it becomes the shared team library. */
  function crc32(buf) {
    var c, table = crc32.t;
    if (!table) {
      table = crc32.t = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {   // [{name, data:Uint8Array}]
    var chunks = [], central = [], offset = 0;
    var enc = new TextEncoder();
    function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
    function u16(n) { return [n & 255, (n >>> 8) & 255]; }
    files.forEach(function (f) {
      var nameBytes = enc.encode(f.name), crc = crc32(f.data), len = f.data.length;
      var local = [].concat([80, 75, 3, 4], u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(len), u32(len), u16(nameBytes.length), u16(0));
      chunks.push(new Uint8Array(local), nameBytes, f.data);
      central.push({ name: nameBytes, crc: crc, len: len, off: offset });
      offset += local.length + nameBytes.length + len;
    });
    var cstart = offset, csize = 0;
    central.forEach(function (c) {
      var head = [].concat([80, 75, 1, 2], u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(c.crc), u32(c.len), u32(c.len), u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.off));
      chunks.push(new Uint8Array(head), c.name);
      csize += head.length + c.name.length;
    });
    chunks.push(new Uint8Array([].concat([80, 75, 5, 6], u16(0), u16(0), u16(central.length), u16(central.length),
      u32(csize), u32(cstart), u16(0))));
    return new Blob(chunks, { type: "application/zip" });
  }

  function exportPack() {
    return all().then(function (tracks) {
      if (!tracks.length) throw new Error("There's nothing in your library yet.");
      var manifest = { version: 1, built: new Date().toISOString(), tracks: [] };
      var files = [];
      return tracks.reduce(function (p, t, i) {
        return p.then(function () {
          return t.blob.arrayBuffer().then(function (ab) {
            var ext = (t.blob.type || "").indexOf("wav") >= 0 ? "wav" : "mp3";
            var file = String(i + 1).padStart(2, "0") + "-" +
              t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "." + ext;
            files.push({ name: "music/" + file, data: new Uint8Array(ab) });
            manifest.tracks.push({
              file: file, name: t.name, category: t.category,
              seconds: t.seconds, model: t.model, modelId: t.modelId, prompt: t.prompt,
              generated: new Date(t.at).toISOString()
            });
          });
        });
      }, Promise.resolve()).then(function () {
        var enc = new TextEncoder();
        files.push({ name: "music/library.json", data: enc.encode(JSON.stringify(manifest, null, 2)) });
        files.push({ name: "MUSIC_LICENSES.md", data: enc.encode(licenseDoc(manifest)) });
        return zip(files);
      });
    });
  }

  function licenseDoc(manifest) {
    var out = [];
    out.push("# Goldframe music library — where these tracks came from");
    out.push("");
    out.push("Built " + manifest.built + ". " + manifest.tracks.length + " tracks.");
    out.push("");
    out.push("Every track here was generated by an AI music model from the prompt shown,");
    out.push("through the account whose key built this pack. None of it was downloaded from");
    out.push("a stock music site, so none of it carries a stock licence, an attribution");
    out.push("requirement, or a third party who can withdraw it.");
    out.push("");
    out.push("The US Copyright Office holds that purely AI-generated material is not protected");
    out.push("by copyright. No copyright is claimed in these tracks. That does not affect your");
    out.push("right to use them: unprotected material carries no rights for anyone to assert.");
    out.push("Videos made with them remain your own work.");
    out.push("");
    out.push("| # | Track | Mood | Seconds | Model | Prompt |");
    out.push("| - | ----- | ---- | ------- | ----- | ------ |");
    manifest.tracks.forEach(function (t, i) {
      out.push("| " + (i + 1) + " | " + t.name + " | " + t.category + " | " + t.seconds + " | " +
        t.model + " | " + t.prompt.replace(/\|/g, "/").slice(0, 120) + " |");
    });
    return out.join("\n");
  }

  window.GFMusic = {
    CATEGORIES: CATEGORIES,
    STARTER: STARTER,
    generate: generate,
    buildPack: buildPack,
    cancelPack: function () { packCancel = true; },
    list: all,
    remove: del,
    loadShipped: loadShipped,
    exportPack: exportPack,
    licenseDoc: licenseDoc,
    shipped: function () { return shipped; },
    setShipped: function (s) { shipped = s; }
  };
})();
