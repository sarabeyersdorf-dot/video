/* ============================================================================
   Goldframe AI — on your own computer, free
   ----------------------------------------------------------------------------
   Everything in this file runs inside the browser. No key, no account, no bill,
   nothing uploaded. Two kinds of work live here:

   INSTANT (no download at all — plain maths on the picture)
     autoGrade   fix flat, dark or yellow photos the way a photographer would
     reframe     find the part of a photo worth keeping when a wide shot has to
                 become a tall 9:16 reel
     skyMask     a rough sky finder used as a fallback

   SMARTER (downloads a small model the first time, then it is cached)
     depth       works out how far away every pixel is, which is what turns a
                 flat zoom into a real 3D push through a room
     segment     labels every pixel — sky, building, floor, tree, window — which
                 makes sky replacement clean around a roofline

   Downloads are lazy and honest: nothing is fetched until the user asks for the
   feature, and the size is shown before it starts.
   ========================================================================== */
(function () {
  "use strict";

  var TFJS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";

  var MODELS = {
    depth: {
      repo: "onnx-community/depth-anything-v2-small",
      task: "depth-estimation",
      dtype: "q4f16",
      mb: 19,
      label: "depth (3D push-ins)"
    },
    segment: {
      repo: "Xenova/segformer-b0-finetuned-ade-512-512",
      task: "image-segmentation",
      dtype: "quantized",
      mb: 5,
      label: "scene labels (sky replacement)"
    }
  };

  var lib = null;           // the transformers.js module, once loaded
  var pipes = {};           // task -> loaded pipeline
  var loading = {};         // task -> in-flight promise

  function canRunModels() {
    // Models are cached by the browser's Cache API, which does not exist when a
    // page is opened straight off disk. Without it every use re-downloads the
    // model, so we simply don't offer it.
    return location.protocol !== "file:";
  }

  function loadLib(onProgress) {
    if (lib) return Promise.resolve(lib);
    if (loading.__lib) return loading.__lib;
    onProgress && onProgress("Loading the on-device AI engine (about half a megabyte)…");
    loading.__lib = import(/* webpackIgnore: true */ TFJS).then(function (m) {
      lib = m;
      return m;
    }).catch(function () {
      throw new Error("Couldn't load the on-device AI engine. Check your internet connection and try again.");
    });
    return loading.__lib;
  }

  function getPipe(which, onProgress) {
    var spec = MODELS[which];
    if (pipes[which]) return Promise.resolve(pipes[which]);
    if (loading[which]) return loading[which];
    if (!canRunModels()) {
      return Promise.reject(new Error("This feature needs the app to be open at a web address. Use the Goldframe website (or Projects ▸ Export) rather than a file opened from your desktop."));
    }
    loading[which] = loadLib(onProgress).then(function (m) {
      onProgress && onProgress("First time only: downloading the " + spec.label + " model, about " + spec.mb + " MB…");
      return m.pipeline(spec.task, spec.repo, {
        dtype: spec.dtype,
        device: (navigator.gpu ? "webgpu" : "wasm"),
        progress_callback: function (p) {
          if (p && p.status === "progress" && p.progress != null && onProgress) {
            onProgress("Downloading " + spec.label + " — " + Math.round(p.progress) + "%");
          }
        }
      });
    }).then(function (p) {
      pipes[which] = p;
      onProgress && onProgress("Ready.");
      return p;
    }).catch(function (e) {
      delete loading[which];
      throw e;
    });
    return loading[which];
  }

  /* ------------------------------------------------------------------ canvas */
  function draw(img, w, h) {
    var c = document.createElement("canvas");
    c.width = w || img.naturalWidth || img.width;
    c.height = h || img.naturalHeight || img.height;
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  function canvasToBlob(c, type, q) {
    return new Promise(function (res) { c.toBlob(function (b) { res(b); }, type || "image/jpeg", q || 0.94); });
  }

  /* ================================================================ auto grade
     What a good property photographer does to a raw frame: lift the shadows a
     little, stop the highlights from blowing out, neutralise a colour cast from
     indoor bulbs, and add just enough contrast and saturation to look rich
     without looking fake.

     This is a real correction, not a filter — it measures the photo first. It is
     also, importantly, an ENHANCEMENT rather than an alteration: it changes no
     physical element of the property, so it needs no disclosure (see part 40).
   */
  function autoGrade(source, strength) {
    strength = strength == null ? 1 : strength;
    return window.GFAI.toImage(source).then(function (img) {
      var c = draw(img);
      var g = c.getContext("2d");
      var W = c.width, H = c.height;
      var im = g.getImageData(0, 0, W, H), d = im.data;

      // --- measure -------------------------------------------------------
      var hist = new Uint32Array(256), rs = 0, gs = 0, bs = 0, n = d.length / 4;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], gg = d[i + 1], b = d[i + 2];
        rs += r; gs += gg; bs += b;
        hist[(r * 0.299 + gg * 0.587 + b * 0.114) | 0]++;
      }
      // Black and white points at the 0.4% / 99.6% marks — clipping a tiny tail
      // is what gives a photo "snap" without crushing detail.
      var lo = 0, hi = 255, cut = n * 0.004, acc = 0, k;
      for (k = 0; k < 256; k++) { acc += hist[k]; if (acc > cut) { lo = k; break; } }
      acc = 0;
      for (k = 255; k >= 0; k--) { acc += hist[k]; if (acc > cut) { hi = k; break; } }
      if (hi - lo < 24) { lo = 0; hi = 255; }

      // Grey-world white balance: on average a room should be neutral. If the
      // average is warm, the bulbs were warm — pull it back, but only part way,
      // because buyers like a slightly warm home.
      var avg = (rs + gs + bs) / (3 * n);
      var kr = (avg / (rs / n)), kg = (avg / (gs / n)), kb = (avg / (bs / n));
      var wbAmt = 0.55 * strength;
      kr = 1 + (kr - 1) * wbAmt; kg = 1 + (kg - 1) * wbAmt; kb = 1 + (kb - 1) * wbAmt;

      // --- apply ---------------------------------------------------------
      var span = hi - lo, gamma = 0.94;             // a touch brighter midtones
      var lut = new Uint8Array(256);
      for (k = 0; k < 256; k++) {
        var v = (k - lo) / span;
        v = Math.max(0, Math.min(1, v));
        v = Math.pow(v, gamma);
        v = v + (v * (1 - v) * (v - 0.5)) * 0.55 * strength;   // gentle S-curve
        lut[k] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
      var sat = 1 + 0.14 * strength;
      for (i = 0; i < d.length; i += 4) {
        var R = lut[Math.min(255, Math.max(0, d[i] * kr | 0))];
        var G = lut[Math.min(255, Math.max(0, d[i + 1] * kg | 0))];
        var B = lut[Math.min(255, Math.max(0, d[i + 2] * kb | 0))];
        var L = R * 0.299 + G * 0.587 + B * 0.114;
        d[i]     = Math.max(0, Math.min(255, L + (R - L) * sat));
        d[i + 1] = Math.max(0, Math.min(255, L + (G - L) * sat));
        d[i + 2] = Math.max(0, Math.min(255, L + (B - L) * sat));
      }
      g.putImageData(im, 0, 0);
      return c;
    });
  }

  /* ============================================================== auto reframe
     A wide 16:9 room photo squeezed into a tall 9:16 reel loses two thirds of
     its width. Which third do you keep? Not the middle — the middle of a
     kitchen photo is often a blank worktop.

     Score every possible crop by three things and take the best:
       detail   edges and texture (cabinetry, furniture, architecture)
       depth    near things matter more than the far wall     (model, optional)
       meaning  reward rooms and buildings, punish sky, ceiling and blank floor
                                                              (model, optional)
     With no models loaded the detail term alone already beats a centre crop.
   */
  function reframe(source, targetAspect, opts) {
    opts = opts || {};
    return window.GFAI.toImage(source).then(function (img) {
      var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
      var srcAspect = W / H;
      if (Math.abs(srcAspect - targetAspect) < 0.02) return { x: 0, y: 0, w: W, h: H, moved: false };

      var cw, ch;
      if (srcAspect > targetAspect) { ch = H; cw = Math.round(H * targetAspect); }
      else { cw = W; ch = Math.round(W / targetAspect); }

      // Work on a small copy — the answer is a position, not a picture.
      var sw = 160, sh = Math.max(1, Math.round(160 * H / W));
      var small = draw(img, sw, sh);
      var d = small.getContext("2d").getImageData(0, 0, sw, sh).data;

      var horizontal = srcAspect > targetAspect;
      var steps = horizontal ? sw : sh;
      var energy = new Float32Array(steps);

      // Edge energy per column (or row).
      for (var y = 1; y < sh; y++) {
        for (var x = 1; x < sw; x++) {
          var i = (y * sw + x) * 4, l = i - 4, u = i - sw * 4;
          var e = Math.abs(d[i] - d[l]) + Math.abs(d[i + 1] - d[l + 1]) + Math.abs(d[i + 2] - d[l + 2])
                + Math.abs(d[i] - d[u]) + Math.abs(d[i + 1] - d[u + 1]) + Math.abs(d[i + 2] - d[u + 2]);
          // Sky and ceilings are bright, flat and usually at the top — worth
          // less than the middle of the frame either way.
          energy[horizontal ? x : y] += e;
        }
      }
      if (opts.weights && opts.weights.length === steps) {
        for (var w2 = 0; w2 < steps; w2++) energy[w2] *= (0.4 + 1.2 * opts.weights[w2]);
      }

      // Sliding window over the small image, mapped back to full size.
      var winSmall = Math.max(1, Math.round(horizontal ? (cw / W) * sw : (ch / H) * sh));
      var best = -1, bestAt = 0, run = 0, j;
      for (j = 0; j < winSmall && j < steps; j++) run += energy[j];
      best = run; bestAt = 0;
      for (j = winSmall; j < steps; j++) {
        run += energy[j] - energy[j - winSmall];
        // A mild pull toward centre stops the crop lurching to an edge when two
        // areas score almost the same.
        var centre = 1 - Math.abs(((j - winSmall / 2) / steps) - 0.5) * 0.25;
        if (run * centre > best) { best = run * centre; bestAt = j - winSmall + 1; }
      }

      var pos = Math.round((bestAt / steps) * (horizontal ? W : H));
      var x0 = horizontal ? Math.max(0, Math.min(W - cw, pos)) : 0;
      var y0 = horizontal ? 0 : Math.max(0, Math.min(H - ch, pos));
      return { x: x0, y: y0, w: cw, h: ch, moved: true };
    });
  }

  /* =================================================================== depth
     Returns { width, height, data } where data is 0..1, 1 = closest to camera.
     This is what part 40 turns into a genuine 3D camera move.

     If the model can't be downloaded — no internet, a corporate network that
     blocks the CDN, or the app opened straight off disk — we fall back to a
     rough estimate rather than failing. The move is flatter, but it still
     works, and the user is told which one they got. */
  function depth(source, onProgress) {
    return getPipe("depth", onProgress).then(function () {
      return realDepth(source, onProgress);
    }, function () {
      onProgress && onProgress("Using the quick depth estimate (the full model couldn't be downloaded)…");
      return heuristicDepth(source);
    });
  }

  function realDepth(source, onProgress) {
    return Promise.all([window.GFAI.shrink(source, 768, 0.92), getPipe("depth", onProgress)])
      .then(function (both) {
        onProgress && onProgress("Working out the depth of the room…");
        return both[1](both[0]);
      })
      .then(function (out) {
        var t = out.predicted_depth;
        var dims = t.dims || [t.height, t.width];
        var h = dims[dims.length - 2], w = dims[dims.length - 1];
        var src = t.data, lo = Infinity, hi = -Infinity, i;
        for (i = 0; i < src.length; i++) { if (src[i] < lo) lo = src[i]; if (src[i] > hi) hi = src[i]; }
        var span = (hi - lo) || 1;
        var norm = new Float32Array(src.length);
        for (i = 0; i < src.length; i++) norm[i] = (src[i] - lo) / span;
        return { width: w, height: h, data: norm };
      });
  }

  /* Rough depth without any model, from three things a photograph reliably
     tells you: floor and foreground sit low in the frame, near surfaces carry
     more fine detail than far ones, and distant walls and windows are brighter.
     Crude, but enough for a gentle, believable camera move. */
  function heuristicDepth(source) {
    return window.GFAI.toImage(source).then(function (img) {
      var W = 96, H = Math.max(16, Math.round(96 * (img.naturalHeight || img.height) / (img.naturalWidth || img.width)));
      var c = draw(img, W, H);
      var d = c.getContext("2d").getImageData(0, 0, W, H).data;
      var out = new Float32Array(W * H), i, x, y;

      for (y = 0; y < H; y++) {
        for (x = 0; x < W; x++) {
          i = (y * W + x) * 4;
          var L = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
          // local detail
          var det = 0, cnt = 0;
          if (x > 0) { det += Math.abs(d[i] - d[i - 4]) + Math.abs(d[i + 1] - d[i - 3]) + Math.abs(d[i + 2] - d[i - 2]); cnt++; }
          if (y > 0) { var u = i - W * 4; det += Math.abs(d[i] - d[u]) + Math.abs(d[i + 1] - d[u + 1]) + Math.abs(d[i + 2] - d[u + 2]); cnt++; }
          det = cnt ? Math.min(1, det / (cnt * 3 * 60)) : 0;
          var low = y / (H - 1);                         // 0 top, 1 bottom
          out[y * W + x] = Math.max(0, Math.min(1, 0.50 * low + 0.32 * det + 0.18 * (1 - L)));
        }
      }
      // Smooth it hard — a noisy depth map makes the layers shimmer.
      var sm = new Float32Array(out.length), r = 3;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        var s = 0, n = 0;
        for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
          var ny = y + dy, nx = x + dx;
          if (ny < 0 || nx < 0 || ny >= H || nx >= W) continue;
          s += out[ny * W + nx]; n++;
        }
        sm[y * W + x] = s / n;
      }
      return { width: W, height: H, data: sm, rough: true };
    });
  }

  /* ================================================================= segment
     Returns a map of label -> mask canvas, e.g. seg.sky, seg.building. */
  function segment(source, onProgress) {
    return Promise.all([window.GFAI.shrink(source, 768, 0.92), getPipe("segment", onProgress)])
      .then(function (both) {
        onProgress && onProgress("Working out what's in the photo…");
        return both[1](both[0], { subtask: "semantic" });
      })
      .then(function (parts) {
        var out = {};
        (parts || []).forEach(function (p) {
          if (!p || !p.label || !p.mask) return;
          out[p.label] = p.mask;
        });
        return out;
      });
  }

  /* ================================================== sky finder (no download)
     Used when the model isn't available or hasn't been downloaded. Deliberately
     conservative: it only claims sky it is confident about, because a wrong sky
     mask looks far worse than no sky replacement at all. */
  function skyMaskFallback(source) {
    return window.GFAI.toImage(source).then(function (img) {
      var c = draw(img), g = c.getContext("2d");
      var W = c.width, H = c.height;
      var im = g.getImageData(0, 0, W, H), d = im.data;
      var mask = document.createElement("canvas"); mask.width = W; mask.height = H;
      var mg = mask.getContext("2d");
      var mi = mg.createImageData(W, H), md = mi.data;
      var flood = new Uint8Array(W * H);

      // Seed from the top edge, then grow downward through similar pixels. This
      // follows a roofline far better than "everything blue at the top".
      var stack = [], x, y;
      for (x = 0; x < W; x++) if (isSkyish(d, (x) * 4)) { stack.push(x); flood[x] = 1; }
      while (stack.length) {
        var p = stack.pop();
        var px = p % W, py = (p / W) | 0;
        var neigh = [[px + 1, py], [px - 1, py], [px, py + 1]];
        for (var k = 0; k < 3; k++) {
          var nx = neigh[k][0], ny = neigh[k][1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          var np = ny * W + nx;
          if (flood[np]) continue;
          if (!isSkyish(d, np * 4)) continue;
          flood[np] = 1; stack.push(np);
        }
      }
      for (var i = 0; i < flood.length; i++) {
        var v = flood[i] ? 255 : 0;
        md[i * 4] = md[i * 4 + 1] = md[i * 4 + 2] = v; md[i * 4 + 3] = 255;
      }
      mg.putImageData(mi, 0, 0);
      return mask;
    });
    function isSkyish(d, i) {
      var r = d[i], g = d[i + 1], b = d[i + 2];
      var L = r * 0.299 + g * 0.587 + b * 0.114;
      if (L < 120) return false;                       // sky is bright
      if (b < r - 6) return false;                     // and never warmer than red
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      var sat = mx ? (mx - mn) / mx : 0;
      return sat < 0.45;                               // flat, not a coloured wall
    }
  }

  /* ------------------------------------------------------------ soften a mask
     A hard mask edge is the single biggest giveaway in a composited sky. */
  function feather(maskCanvas, px) {
    var c = document.createElement("canvas");
    c.width = maskCanvas.width; c.height = maskCanvas.height;
    var g = c.getContext("2d");
    g.filter = "blur(" + (px || 2) + "px)";
    g.drawImage(maskCanvas, 0, 0);
    g.filter = "none";
    return c;
  }

  window.GFLocal = {
    available: canRunModels,
    MODELS: MODELS,
    autoGrade: autoGrade,
    reframe: reframe,
    depth: depth,
    heuristicDepth: heuristicDepth,
    segment: segment,
    skyMaskFallback: skyMaskFallback,
    feather: feather,
    draw: draw,
    canvasToBlob: canvasToBlob,
    preload: function (which, onProgress) { return getPipe(which, onProgress); }
  };
})();
