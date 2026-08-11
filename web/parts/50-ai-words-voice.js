/* ============================================================================
   Goldframe AI — the words, and the voice that says them
   ----------------------------------------------------------------------------
   WORDS
     roomGuess()   free  works out what each photo shows, from its filename and
                         from the picture itself. Surprisingly good, because
                         listing photos are nearly always named after the room.
     captions()    free  turns those guesses into per-clip captions
     script()      free  writes a narration script from the listing details
     social()      free  writes a post caption with hashtags
     ...and a paid upgrade for each, where a model actually LOOKS at the photos
     and writes about what it sees — "west-facing marble island" rather than
     "Kitchen".

   VOICE
     speak()       paid  real narration, returned as an audio file and dropped
                         straight into the video, where the existing mixer ducks
                         the music underneath it.

   The free versions are not placeholders. An agent with no key gets a complete,
   usable set of words. The paid versions are better, and say so.
   ========================================================================== */
(function () {
  "use strict";

  /* ============================================================ free: rooms */
  var ROOM_WORDS = [
    ["kitchen",      /kitchen|galley|pantry|cook/i,                    "The Kitchen"],
    ["primary",      /primary|master|main.?bed|suite/i,                "Primary Suite"],
    ["bedroom",      /bed\b|bedroom|bdrm|guest.?room/i,                "Bedroom"],
    ["bath",         /bath|ensuite|en.?suite|shower|powder|wc\b/i,     "The Bath"],
    ["living",       /living|lounge|family.?room|great.?room|den/i,    "Living Space"],
    ["dining",       /dining|breakfast.?nook|eat.?in/i,                "Dining"],
    ["office",       /office|study|den|library|work/i,                 "Home Office"],
    ["pool",         /pool|spa|hot.?tub|jacuzzi/i,                     "The Pool"],
    ["yard",         /yard|garden|lawn|landscap|patio|deck|terrace|balcon/i, "Outdoor Living"],
    ["exterior",     /exterior|front|facade|curb|street|elevation/i,   "Welcome Home"],
    ["aerial",       /aerial|drone|sky|overhead|birds?.?eye/i,         "From Above"],
    ["view",         /view|vista|ocean|mountain|city.?scape|sunset/i,  "The View"],
    ["garage",       /garage|carport|driveway/i,                       "Parking"],
    ["laundry",      /laundry|utility|mud.?room/i,                     "Utility"],
    ["stairs",       /stair|hall|entry|foyer|entrance/i,               "Grand Entrance"]
  ];

  // What is this photo of? Filename first (agents name their files), then the
  // picture's own character as a fallback.
  function roomGuess(item, index, total) {
    var name = item.name || "";
    for (var i = 0; i < ROOM_WORDS.length; i++) {
      if (ROOM_WORDS[i][1].test(name)) return { key: ROOM_WORDS[i][0], caption: ROOM_WORDS[i][2], from: "filename" };
    }
    var f = item.feat;   // auto-curate leaves its analysis here when it has run
    if (f) {
      if (f.sky > 0.28 && f.wide > 1.1) return { key: "exterior", caption: index === 0 ? "Welcome Home" : "Outdoor Living", from: "picture" };
      if (f.lum > 0.66 && f.colorful < 0.25) return { key: "bath", caption: "Spa-Like Bath", from: "picture" };
      if (f.detail > 0.34) return { key: "kitchen", caption: "The Kitchen", from: "picture" };
    }
    if (index === 0) return { key: "exterior", caption: "Welcome Home", from: "position" };
    if (total && index === total - 1) return { key: "view", caption: "Come See It", from: "position" };
    return { key: "space", caption: "", from: "none" };
  }

  function captions(say) {
    var media = window.GF.state.media.filter(function (m) { return m.ready; });
    if (!media.length) return Promise.reject(new Error("Add some photos first."));
    var n = 0;
    media.forEach(function (m, i) {
      var g = roomGuess(m, i, media.length);
      if (g.caption && !m.caption) { m.caption = g.caption; n++; }
    });
    window.GF.renderList(); window.GF.rebuild(); window.GF.scheduleAutosave();
    say && say(n ? ("Captioned " + n + " clip" + (n === 1 ? "" : "s") + ". Edit any of them in the list.")
                 : "Every clip already had a caption — nothing to change.");
    return Promise.resolve(n);
  }

  /* ============================================================ free: script */
  function script() {
    var L = window.GF.listing() || {};
    var P = window.GF.profile() || {};
    var bits = [];
    var opener = L.tagline ? L.tagline + "." : "Welcome home.";
    bits.push(opener);
    if (L.address) bits.push("This is " + L.address + (L.city ? ", in " + L.city : "") + ".");
    var specs = [];
    if (L.beds) specs.push(L.beds + " bedroom" + (L.beds > 1 ? "s" : ""));
    if (L.baths) specs.push(L.baths + " bath" + (L.baths > 1 ? "s" : ""));
    if (L.sqft) specs.push((+L.sqft).toLocaleString("en-US") + " square feet");
    if (specs.length) bits.push(specs.join(", ") + " of thoughtfully designed space.");

    var media = window.GF.state.media.filter(function (m) { return m.ready; });
    var seen = {}, tour = [];
    media.forEach(function (m, i) {
      var g = roomGuess(m, i, media.length);
      if (!g.key || seen[g.key] || g.key === "space") return;
      seen[g.key] = true;
      tour.push(g.key);
    });
    var lines = {
      kitchen: "A kitchen built for real cooking and easy entertaining.",
      primary: "The primary suite is a genuine retreat.",
      bedroom: "Bedrooms with room to breathe.",
      bath: "Baths finished to feel like a spa.",
      living: "Living space that opens up and stays warm.",
      dining: "A dining room made for long evenings.",
      office: "A quiet room to work in.",
      pool: "And outside, the pool.",
      yard: "Outdoor living you'll actually use.",
      view: "And then there's the view.",
      aerial: "Set in a neighbourhood worth arriving in.",
      exterior: "It makes an impression from the street."
    };
    tour.slice(0, 4).forEach(function (k) { if (lines[k]) bits.push(lines[k]); });

    if (L.price) bits.push("Offered at " + L.price + ".");
    var who = P.name ? P.name + (P.brokerage ? " with " + P.brokerage : "") : "";
    bits.push((L.cta || P.cta || "Schedule a private showing") + (who ? " — call " + who : "") + (P.phone ? " at " + P.phone : "") + ".");
    return bits.join(" ");
  }

  /* ============================================================ free: social */
  function social() {
    var L = window.GF.listing() || {};
    var P = window.GF.profile() || {};
    var head = (L.tagline || "Just listed") + (L.city ? " · " + L.city : "");
    var specs = [];
    if (L.beds) specs.push(L.beds + " BD");
    if (L.baths) specs.push(L.baths + " BA");
    if (L.sqft) specs.push((+L.sqft).toLocaleString("en-US") + " SF");
    var lines = [head];
    if (L.address) lines.push(L.address);
    if (specs.length || L.price) lines.push(specs.join(" · ") + (L.price ? (specs.length ? " · " : "") + L.price : ""));
    lines.push("");
    lines.push(L.cta || P.cta || "DM me for a private showing.");
    if (P.name) lines.push(P.name + (P.brokerage ? " | " + P.brokerage : "") + (P.license ? " | " + P.license : ""));
    var city = (L.city || "").split(",")[0].replace(/[^a-z0-9]/gi, "");
    lines.push("");
    lines.push(["#justlisted", "#realestate", city ? "#" + city.toLowerCase() : "", "#homeforsale", "#luxuryrealestate", "#listingvideo"].filter(Boolean).join(" "));

    var note = window.GFCompliance.summary(window.GF.state.media);
    if (note) { lines.push(""); lines.push(note.social); }
    return lines.join("\n");
  }

  function hooks() {
    var L = window.GF.listing() || {};
    var out = ["JUST LISTED"];
    if (L.price) out.push(L.price);
    if (L.beds && L.baths) out.push(L.beds + " BED · " + L.baths + " BA");
    if (L.city) out.push((L.city.split(",")[0] || "").toUpperCase());
    if (L.sqft) out.push((+L.sqft).toLocaleString("en-US") + " SQ FT");
    out.push("YOU HAVE TO SEE THIS");
    return out;
  }

  /* ============================================================== paid: eyes */
  function llm(prompt, imageDataUrl, opts) {
    opts = opts || {};
    var modelId = imageDataUrl ? "fal-ai/any-llm/vision" : "fal-ai/any-llm";
    var input = { prompt: prompt, model: "google/gemini-flash-1.5" };
    if (imageDataUrl) input.image_url = imageDataUrl;
    if (opts.system) input.system_prompt = opts.system;
    return window.GFAI.run("text", modelId, input, {
      cost: window.GFAI.estimate("text", modelId, 1),
      onProgress: opts.onProgress,
      overCap: opts.overCap,
      timeoutMs: 90 * 1000
    }).then(function (r) {
      var t = (r && (r.output || r.response || r.text)) || (r && r.data && (r.data.output || r.data.response));
      if (!t) throw new Error("The writer didn't come back with anything. Try again.");
      return String(t).trim();
    });
  }

  // Look at every photo and write a caption for each, plus a suggested order.
  function smartCaptions(say, opts) {
    opts = opts || {};
    var media = window.GF.state.media.filter(function (m) { return m.ready && m.kind === "image"; });
    if (!media.length) return Promise.reject(new Error("Add some photos first."));
    var done = 0;
    function next(i) {
      if (i >= media.length) {
        window.GF.renderList(); window.GF.rebuild(); window.GF.scheduleAutosave();
        return Promise.resolve(done);
      }
      var m = media[i];
      say && say("Looking at photo " + (i + 1) + " of " + media.length + "…");
      return window.GFAI.shrink(m.el, 640, 0.85).then(function (url) {
        return llm(
          "This is one photo from a real-estate listing. Write a caption for it to appear on screen in a " +
          "short listing video: at most four words, title case, specific to what you can actually see " +
          "(the room and its single most appealing feature). No quotes, no punctuation at the end, no emoji. " +
          "If it is an exterior, say something about arrival or the setting. Reply with the caption only.",
          url, { onProgress: null, overCap: opts.overCap }
        );
      }).then(function (t) {
        t = t.replace(/^["'\s]+|["'.\s]+$/g, "").split("\n")[0];
        if (t && t.length <= 40) { m.caption = t; done++; }
        return next(i + 1);
      }).catch(function (e) {
        // One bad photo shouldn't stop the run.
        if (/NO_KEY|OVER_CAP|refused|credit/i.test(e.message)) throw e;
        return next(i + 1);
      });
    }
    return next(0);
  }

  function smartScript(say, opts) {
    opts = opts || {};
    var L = window.GF.listing() || {};
    var P = window.GF.profile() || {};
    var rooms = window.GF.state.media.filter(function (m) { return m.ready; })
      .map(function (m, i, a) { return roomGuess(m, i, a.length).caption || "a room"; }).join(", ");
    say && say("Writing the narration…");
    return llm(
      "Write a warm, confident 30-second voiceover script for a real-estate listing video. " +
      "About 75 words. Speak to a buyer, not about the seller. Short sentences a person can " +
      "actually say out loud. No exclamation marks, no cliches like 'nestled' or 'boasts', no emoji, " +
      "no stage directions, no headings — just the words to read.\n\n" +
      "Property: " + [L.tagline, L.address, L.city].filter(Boolean).join(", ") + "\n" +
      "Details: " + [L.beds && (L.beds + " bed"), L.baths && (L.baths + " bath"), L.sqft && (L.sqft + " sq ft"), L.price].filter(Boolean).join(", ") + "\n" +
      "The video shows, in order: " + (rooms || "the property") + "\n" +
      "End with this call to action: " + (L.cta || P.cta || "Schedule a private showing") +
      (P.name ? ", from " + P.name + (P.brokerage ? " at " + P.brokerage : "") : "") + ".",
      null, { onProgress: say, overCap: opts.overCap }
    );
  }

  function smartSocial(platform, say, opts) {
    opts = opts || {};
    var L = window.GF.listing() || {};
    var P = window.GF.profile() || {};
    var note = window.GFCompliance.summary(window.GF.state.media);
    say && say("Writing the caption…");
    return llm(
      "Write a social media caption for a real-estate listing video on " + (platform || "Instagram") + ". " +
      "Hook in the first line. Short lines, plenty of white space, no more than 80 words before the hashtags. " +
      "Then 6 to 10 relevant hashtags on their own line. No emoji spam — two at most. " +
      "Do not invent any feature that isn't in the details below.\n\n" +
      "Property: " + [L.tagline, L.address, L.city].filter(Boolean).join(", ") + "\n" +
      "Details: " + [L.beds && (L.beds + " bed"), L.baths && (L.baths + " bath"), L.sqft && (L.sqft + " sq ft"), L.price].filter(Boolean).join(", ") + "\n" +
      "Agent: " + [P.name, P.brokerage, P.license].filter(Boolean).join(", ") + "\n" +
      "Call to action: " + (L.cta || P.cta || "DM for a private showing") +
      (note ? "\nEnd the caption with this exact disclosure line on its own line: " + note.social : ""),
      null, { onProgress: say, overCap: opts.overCap }
    );
  }

  /* =============================================================== paid: voice */
  function speak(text, opts, say) {
    opts = opts || {};
    text = (text || "").trim();
    if (!text) return Promise.reject(new Error("There's no script to read. Write one first."));
    if (text.length > 4500) text = text.slice(0, 4500);

    var modelId = opts.model || window.GFAI.cfg.ttsModel;
    var model = window.GFAI.findModel("tts", modelId);
    if (!model) return Promise.reject(new Error("That voice isn't in the list any more — pick another in AI settings."));
    var voice = opts.voice || window.GFAI.cfg.ttsVoice;
    if (model.voices && model.voices.indexOf(voice) < 0) voice = model.voices[0];

    var input = {};
    input[model.txt || "text"] = text;
    input.voice = voice;
    if (opts.speed && opts.speed !== 1) input.speed = opts.speed;

    say && say("Recording the narration…");
    return window.GFAI.run("tts", modelId, input, {
      cost: window.GFAI.estimate("tts", modelId, text.length),
      onProgress: say, overCap: opts.overCap, timeoutMs: 4 * 60 * 1000
    }).then(function (r) {
      var url = pickAudioUrl(r);
      if (!url) throw new Error("The voice finished but didn't return any audio. Try a different voice.");
      say && say("Bringing the audio back…");
      return window.GFAI.fetchBlob(url).then(function (blob) {
        return { blob: blob, timing: (r && (r.timestamps || (r.data && r.data.timestamps))) || null };
      });
    }).then(function (out) {
      // Hand it to the editor's existing voiceover slot — from here on it is
      // mixed, ducked and exported exactly like a recording made by hand.
      // That handover decodes the audio on its own schedule and posts its own
      // result, so we don't claim success on its behalf here.
      window.GF.setVoiceBlob(out.blob, "AI narration (" + model.name + " · " + voice + ")");
      window.GF.scheduleAutosave();
      say && say("Narration sent to the Voiceover panel.");
      return out;
    });
  }

  function pickAudioUrl(r) {
    if (!r) return null;
    if (typeof r === "string") return r;
    if (r.audio) return r.audio.url || r.audio;
    if (r.audio_url) return r.audio_url.url || r.audio_url;
    if (r.output) return pickAudioUrl(r.output);
    if (r.data) return pickAudioUrl(r.data);
    return null;
  }

  window.GFWords = {
    roomGuess: roomGuess,
    captions: captions,
    script: script,
    social: social,
    hooks: hooks,
    smartCaptions: smartCaptions,
    smartScript: smartScript,
    smartSocial: smartSocial,
    speak: speak,
    llm: llm
  };
})();
