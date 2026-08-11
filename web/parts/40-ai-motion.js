/* ============================================================================
   Goldframe AI — making a still photo move
   ----------------------------------------------------------------------------
   Two ways, and they are good at different things.

   1. parallax()  FREE, on your computer, about ten seconds a photo
      Works out how far away everything in the photo is, cuts the picture into
      depth layers, and slides the near ones further than the far ones as the
      camera moves. The result is a genuine push THROUGH a room rather than a
      flat zoom into a picture of one. It cannot invent anything the photo never
      saw, so it stays honest — and because nothing is invented, it is an
      enhancement, not an alteration, and needs no disclosure.

   2. generate()  PAID, in the cloud, about a minute a photo
      Hands the photo to a real video model. Water moves, curtains breathe,
      clouds drift, the camera flies. This is what the expensive listing-video
      websites sell. It IS an alteration — it shows the property doing things
      the camera never recorded — so the source frame is labelled before it is
      sent, which means the label lives in every frame that comes back.

   Both replace the photo on the timeline with a clip, in place, keeping its
   caption and position — and both keep the original photo for undo.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------- photo item -> video item
     Converting in place (rather than adding a clip and deleting a photo) keeps
     the running order, the caption and any auto-curate decisions intact. */
  function becomeVideo(item, blob, meta) {
    return new Promise(function (res, rej) {
      var oldUrl = item.url;
      if (!item.gfAI || !item.gfAI.original) {
        item.gfAI = item.gfAI || {};
        item.gfAI.original = { blob: item.blob, name: item.name, kind: item.kind };
      }
      var url = URL.createObjectURL(blob);
      var v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "auto";
      var settled = false;
      v.onloadeddata = function () {
        if (settled) return; settled = true;
        item.kind = "video"; item.el = v; item.url = url; item.blob = blob;
        // A blob straight out of MediaRecorder carries no duration in its
        // header, so `v.duration` reads Infinity. Left alone that makes the
        // whole timeline infinite — the scrub bar dies and export never ends.
        item.natDur = (isFinite(v.duration) && v.duration > 0) ? v.duration : (meta.seconds || 5);
        item.motion = "still";          // the movement is in the clip now
        item.dur = null;                 // play the whole thing
        item.ready = true;
        item.gfAI.job = meta.job;
        item.gfAI.model = meta.model;
        item.gfAI.prompt = meta.prompt || "";
        item.gfAI.at = Date.now();
        if (meta.labelJob) item.gfAI.labelJob = meta.labelJob;
        // The still-image "clean twin" belongs to a photo, not a clip. Keeping it
        // would just be a spare full-size JPEG saved with every project forever.
        item.gfAI.clean = null;
        try { if (oldUrl) URL.revokeObjectURL(oldUrl); } catch (e) {}
        window.GF.renderList(); window.GF.rebuild();
        window.GF.drawAt(window.GF.posterTime()); window.GF.scheduleAutosave();
        window.GFCompliance.log({
          photo: item.name, job: meta.job, model: meta.model, prompt: meta.prompt,
          address: (window.GF.listing() || {}).address
        });
        res(item);
      };
      function fail(msg) {
        if (settled) return; settled = true;
        try { URL.revokeObjectURL(url); } catch (e) {}
        rej(new Error(msg));
      }
      v.onerror = function () { fail("The clip came back in a format this browser can't play."); };
      v.src = url;
      setTimeout(function () { fail("The clip took too long to open."); }, 20000);
    });
  }

  /* ============================================================== free: depth
     The camera path. `t` runs 0 to 1; we return where the virtual camera is.
     Kept gentle on purpose — from a single photo, a big move reveals edges the
     photo never captured, and that is true of every photo-to-3D tool ever made. */
  var PATHS = {
    "push-in":   function (t) { return { z: 0.00 + 0.14 * t, x: 0,               y: 0 }; },
    "pull-out":  function (t) { return { z: 0.14 - 0.14 * t, x: 0,               y: 0 }; },
    "pan-left":  function (t) { return { z: 0.05,            x: 0.06 - 0.12 * t, y: 0 }; },
    "pan-right": function (t) { return { z: 0.05,            x: -0.06 + 0.12 * t, y: 0 }; },
    "pan-up":    function (t) { return { z: 0.05,            x: 0, y: 0.05 - 0.10 * t }; },
    "pan-down":  function (t) { return { z: 0.05,            x: 0, y: -0.05 + 0.10 * t }; },
    "drone-up":  function (t) { return { z: 0.03 + 0.06 * t, x: 0, y: 0.08 - 0.14 * t }; },
    "ken-burns": function (t) { return { z: 0.02 + 0.10 * t, x: -0.03 + 0.06 * t, y: 0.02 - 0.04 * t }; },
    "orbit":     function (t) { return { z: 0.06, x: 0.07 * Math.sin(t * Math.PI * 1.0 - Math.PI / 2), y: 0.02 * Math.cos(t * Math.PI) }; }
  };

  var BANDS = 14;   // depth layers. More = smoother, slower to prepare.

  function parallax(item, opts, say) {
    opts = opts || {};
    var move = PATHS[opts.motion] || PATHS[item.motion] || PATHS["push-in"];
    var seconds = Math.max(2, Math.min(10, opts.seconds || 5));
    var fmt = window.GF.formats[window.GF.state.format];
    var W = fmt.w, H = fmt.h;

    say && say("Studying the depth of the photo…");
    var src;
    return window.GFPhoto.sourceOf(item).then(function (s) {
      src = s;
      return window.GFLocal.depth(src, say);
    }).then(function (dm) {
      say && say("Cutting the picture into layers…");
      var layers = buildLayers(src, dm, W, H);
      say && say("Filming the move — this runs in real time, about " + seconds + " seconds…");
      return record(layers, move, seconds, W, H, say);
    }).then(function (blob) {
      return becomeVideo(item, blob, {
        job: "parallax",
        model: "on-device depth",
        prompt: (opts.motion || item.motion || "push-in") + ", " + seconds + "s",
        seconds: seconds
      });
    });
  }

  // Slice the photo into depth bands, each on its own transparent canvas. Behind
  // them sits a blurred, stretched copy of the whole photo so that when a near
  // layer slides aside it uncovers something plausible rather than a hole.
  function buildLayers(img, dm, W, H) {
    var iw = img.naturalWidth, ih = img.naturalHeight;
    // Cover the output frame, with a little margin for the camera to move into.
    var over = 1.18;
    var scale = Math.max(W / iw, H / ih) * over;
    var dw = Math.round(iw * scale), dh = Math.round(ih * scale);

    var base = document.createElement("canvas"); base.width = dw; base.height = dh;
    base.getContext("2d").drawImage(img, 0, 0, dw, dh);

    // Depth map, stretched to match, read once.
    var dcv = document.createElement("canvas"); dcv.width = dw; dcv.height = dh;
    var dg = dcv.getContext("2d");
    var tmp = document.createElement("canvas"); tmp.width = dm.width; tmp.height = dm.height;
    var ti = tmp.getContext("2d").createImageData(dm.width, dm.height);
    for (var p = 0; p < dm.data.length; p++) {
      var v = Math.round(dm.data[p] * 255);
      ti.data[p * 4] = ti.data[p * 4 + 1] = ti.data[p * 4 + 2] = v; ti.data[p * 4 + 3] = 255;
    }
    tmp.getContext("2d").putImageData(ti, 0, 0);
    dg.filter = "blur(3px)";              // soften band edges before slicing
    dg.drawImage(tmp, 0, 0, dw, dh);
    dg.filter = "none";
    var depth = dg.getImageData(0, 0, dw, dh).data;

    var src = base.getContext("2d").getImageData(0, 0, dw, dh);

    // Backdrop: the whole photo, blurred, to fill anything uncovered.
    var back = document.createElement("canvas"); back.width = dw; back.height = dh;
    var bg = back.getContext("2d");
    bg.filter = "blur(" + Math.max(6, dw * 0.012) + "px)";
    bg.drawImage(base, 0, 0);
    bg.filter = "none";

    var layers = [{ canvas: back, depth: 0, w: dw, h: dh }];
    for (var b = 0; b < BANDS; b++) {
      var lo = b / BANDS, hi = (b + 1) / BANDS;
      var c = document.createElement("canvas"); c.width = dw; c.height = dh;
      var g = c.getContext("2d");
      var out = g.createImageData(dw, dh);
      var any = false;
      for (var i = 0, n = dw * dh; i < n; i++) {
        var d = depth[i * 4] / 255;
        if (d < lo || d >= hi) continue;
        var o = i * 4;
        out.data[o] = src.data[o]; out.data[o + 1] = src.data[o + 1];
        out.data[o + 2] = src.data[o + 2]; out.data[o + 3] = 255;
        any = true;
      }
      if (!any) continue;
      g.putImageData(out, 0, 0);
      // Bleed the layer outward a touch so neighbouring bands overlap instead of
      // showing a seam between them.
      var soft = document.createElement("canvas"); soft.width = dw; soft.height = dh;
      var sg = soft.getContext("2d");
      sg.filter = "blur(1.2px)";
      sg.drawImage(c, 0, 0);
      sg.filter = "none";
      sg.globalCompositeOperation = "source-over";
      sg.drawImage(c, 0, 0);
      layers.push({ canvas: soft, depth: (lo + hi) / 2, w: dw, h: dh });
    }
    return layers;
  }

  function record(layers, move, seconds, W, H, say) {
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";

    function frame(t) {
      var cam = move(t);
      g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        // Near layers (depth 1) react most; the backdrop barely moves.
        var k = 0.25 + L.depth * 1.75;
        var z = 1 + cam.z * k;
        var dw = L.w * z, dh = L.h * z;
        var dx = (W - dw) / 2 + cam.x * W * k;
        var dy = (H - dh) / 2 + cam.y * H * k;
        g.drawImage(L.canvas, dx, dy, dw, dh);
      }
    }

    frame(0);
    var stream = c.captureStream(30);
    var mime = pickMime();
    var rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined); }
    catch (e) {
      try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e2) {}
      return Promise.reject(new Error("This browser can't record video. Chrome, Edge and Safari all can."));
    }

    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };

    return new Promise(function (res, rej) {
      var finished = false, watchdog = null;
      function cleanup() {
        clearInterval(watchdog);
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      }
      rec.onerror = function () { finished = true; cleanup(); rej(new Error("Recording the move failed.")); };
      rec.onstop = function () {
        finished = true; cleanup();
        var blob = new Blob(chunks, { type: (mime || "video/webm").split(";")[0] });
        if (!blob.size) return rej(new Error("Recording produced an empty clip."));
        res(blob);
      };
      var t0 = performance.now();
      rec.start();

      // requestAnimationFrame stops firing when the tab is hidden, so a user who
      // switches to their email mid-render would otherwise leave this promise
      // parked forever with the whole panel disabled. setInterval keeps running
      // (throttled, but running), so it can end the recording regardless.
      watchdog = setInterval(function () {
        if (finished) { clearInterval(watchdog); return; }
        if ((performance.now() - t0) / 1000 >= seconds + 1.5) {
          try { rec.stop(); } catch (e) { finished = true; cleanup(); rej(new Error("Recording the move failed.")); }
        }
      }, 500);

      (function step() {
        if (finished) return;
        var el = (performance.now() - t0) / 1000;
        var t = Math.min(1, el / seconds);
        frame(ease(t));
        if (el >= seconds) { setTimeout(function () { if (!finished) { try { rec.stop(); } catch (e) {} } }, 120); return; }
        if (say && Math.random() < 0.06) say("Filming — " + Math.round(t * 100) + "% (keep this tab in front)");
        requestAnimationFrame(step);
      })();
    });
  }

  function ease(p) { return p * p * (3 - 2 * p); }

  function pickMime() {
    var opts = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=h264", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (var i = 0; i < opts.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported(opts[i])) return opts[i];
    return "";
  }

  /* ============================================================ paid: generate */
  var MOTION_WORDS = {
    "push-in":   "a slow, steady cinematic push forward into the room, camera gliding on a dolly",
    "pull-out":  "a slow cinematic pull backwards revealing the whole space",
    "pan-left":  "a smooth slow pan to the left across the space",
    "pan-right": "a smooth slow pan to the right across the space",
    "pan-up":    "a slow tilt upward revealing the height of the space",
    "pan-down":  "a slow tilt downward",
    "drone-up":  "a smooth aerial drone rise revealing the property and its surroundings",
    "ken-burns": "a gentle drifting camera move with subtle parallax",
    "orbit":     "a slow arcing orbit around the space",
    "still":     "an almost still camera with only subtle natural movement in the scene"
  };

  function prompt(item, opts) {
    var mo = opts.motion || item.motion || "push-in";
    var extra = opts.life
      ? " Natural ambient life: soft daylight shifting, leaves and plants moving gently in a breeze, water rippling, curtains breathing."
      : "";
    return MOTION_WORDS[mo] + " through this real estate property." + extra +
      " Photorealistic, high-end property tour footage, steady and smooth. " +
      "Keep the architecture, walls, windows, doors and layout exactly as photographed — " +
      "do not add, remove or reshape any part of the building. No people unless already present. " +
      "No text, no captions, no watermarks, no camera shake, no warping.";
  }

  function generate(item, opts, say) {
    opts = opts || {};
    var modelId = opts.model || window.GFAI.cfg.videoModel;
    var model = window.GFAI.findModel("video", modelId);
    if (!model) return Promise.reject(new Error("That video model isn't in the list any more — pick another in AI settings."));
    var seconds = Math.max(3, Math.min(model.max, opts.seconds || window.GFAI.cfg.clipSeconds || 5));
    var cost = window.GFAI.estimate("video", modelId, seconds);
    var text = prompt(item, opts);

    say && say("Preparing the photo…");
    // Label the SOURCE frame, so the disclosure is present in every frame the
    // model gives back. Cheaper, cleaner and more durable than re-encoding.
    return prepareFrame(item).then(function (dataUrl) {
      var input = {};
      input[model.img] = dataUrl;
      input.prompt = text;
      input[model.secs] = seconds;
      input.negative_prompt = "blurry, distorted, warped architecture, melting walls, text, watermark, extra windows, low quality";
      if (/veo/.test(modelId)) input.generate_audio = false;
      if (/kling/.test(modelId)) input.generate_audio = false;
      return window.GFAI.run("video", modelId, input, {
        cost: cost, onProgress: say, overCap: opts.overCap, timeoutMs: 10 * 60 * 1000
      });
    }).then(function (result) {
      var url = pickVideoUrl(result);
      if (!url) throw new Error("The model finished but didn't return a clip. Try again, or pick a different model in AI settings.");
      say && say("Downloading the clip…");
      return window.GFAI.fetchBlob(url);
    }).then(function (blob) {
      return becomeVideo(item, blob, {
        job: "motion", labelJob: "motion", model: model.name, prompt: text, seconds: seconds
      });
    });
  }

  function prepareFrame(item) {
    return window.GFPhoto.sourceOf(item).then(function (src) {
      if (window.GFAI.cfg.disclose === false) return window.GFAI.shrink(src, 1280, 0.94);
      var c = window.GFLocal.draw(src);
      // The label goes on the frame we send, so it comes back in every frame of
      // the clip. Labelling video after the fact would mean re-encoding it.
      window.GFCompliance.watermark(c, "motion");
      return window.GFAI.shrink(c, 1280, 0.94);
    });
  }

  function pickVideoUrl(r) {
    if (!r) return null;
    if (typeof r === "string") return r;
    if (r.video) return r.video.url || r.video;
    if (r.videos && r.videos.length) return r.videos[0].url || r.videos[0];
    if (r.output) return pickVideoUrl(r.output);
    if (r.data) return pickVideoUrl(r.data);
    return null;
  }

  window.GFMotion = {
    PATHS: PATHS,
    MOTION_WORDS: MOTION_WORDS,
    parallax: parallax,
    generate: generate,
    prompt: prompt,
    // One restore path for everything, in part 30 — it reads the original's own
    // kind, so it puts back a photo or a clip correctly whichever way round the
    // edits happened.
    undo: function (item) { return window.GFPhoto.undo(item); }
  };
})();
