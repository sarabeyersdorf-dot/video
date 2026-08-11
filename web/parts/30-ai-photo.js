/* ============================================================================
   Goldframe AI — photo actions
   ----------------------------------------------------------------------------
   Everything here takes one photo on the timeline and gives back a better one:

     polish        free   fix exposure, colour cast and flatness
     fitFrame      free   crop a wide photo to the reel shape, keeping what matters
     skySwap       free   replace a dull sky (uses the small on-device model)
     stage         paid   furnish an empty room
     restyle       paid   change the style of a furnished room
     declutter     paid   remove clutter, cars, bins, personal photos
     addPeople     paid   place people in the shot for lifestyle appeal
     custom        paid   anything else, in the agent's own words

   TWO RULES THAT RUN THROUGH ALL OF IT

   1. The original is never lost. Every action stashes the untouched photo on the
      item, so "Undo AI" is always one click, and the original can be exported
      for the MLS — which California now requires.

   2. Anything that changes the property discloses itself. The label is burned
      into the picture the moment it is created, before it can be shared,
      downloaded or forgotten about. See part 20 for why.

   THE PROMPTS
   The wording below is not casual. Three things measurably improve results and
   all three are in every prompt: say what class of edit this is before saying
   what to draw; name the objects rather than the vibe; and forbid camera and
   perspective changes explicitly, because perspective drift is what makes a
   staged room read as fake even when every object is plausible.
   ========================================================================== */
(function () {
  "use strict";

  var KEEP =
    "Keep the architecture, walls, windows, window frames, trim, doors, flooring, " +
    "ceiling and the view through the windows exactly as they are in the original photo. " +
    "Do not move or resize any window or door. Do not change the camera angle, perspective, " +
    "lens or the existing lighting direction. Photorealistic real-estate photography, " +
    "matching the original white balance and shadows.";

  var STYLES = {
    "modern coastal":  "a low linen sectional in warm white, a natural jute rug, a light oak coffee table, a woven rattan accent chair, ceramic table lamps and a few green plants in textured pots",
    "warm modern":     "a mid-tone fabric sofa, a wool rug in soft greige, a walnut coffee table, a leather accent chair, brass table lamps and a large fiddle-leaf fig",
    "scandinavian":    "a pale grey sofa, a flatweave cream rug, light birch furniture, a simple black floor lamp, linen cushions and a single trailing plant",
    "traditional":     "a rolled-arm sofa in neutral fabric, a patterned wool area rug, a dark wood coffee table, a wing chair, a table lamp with a pleated shade and framed art",
    "mid-century":     "a walnut-legged sofa in mustard or teal, a geometric rug, a low sideboard, a globe floor lamp and a ceramic planter",
    "luxury contemporary": "a deep low-profile sofa in bouclé, a large silk-blend rug, a marble and brass coffee table, a sculptural armchair, oversized abstract art and orchid arrangements"
  };

  var ROOM_HINTS = {
    living:  "living room",
    bedroom: "bedroom with a bed, nightstands, lamps and soft bedding",
    dining:  "dining room with a dining table, chairs and a centrepiece",
    office:  "home office with a desk, chair, shelving and a task lamp",
    patio:   "outdoor patio with weatherproof seating, a low table and planters"
  };

  function prompts(job, opts) {
    opts = opts || {};
    var style = STYLES[opts.style] || STYLES["modern coastal"];
    var room = ROOM_HINTS[opts.room] || "room";
    switch (job) {
      case "stage":
        return "Using the provided photograph, add furniture and decor only. Furnish this empty " +
          room + " in a " + (opts.style || "modern coastal") + " style: " + style + ". " + KEEP;
      case "restage":
        return "Using the provided photograph, replace the existing furniture and decor with a " +
          (opts.style || "modern coastal") + " scheme: " + style + ". Remove the old furnishings entirely. " + KEEP;
      case "declutter":
        return "Using the provided photograph, remove clutter only: personal photographs, paperwork, " +
          "toiletries, cables, bins, laundry, small appliances left out, toys and vehicles on the driveway. " +
          "Fill the space behind each removed item with the surface that logically continues there. " +
          "Do not add any new furniture or objects. " + KEEP;
      case "people":
        return "Using the provided photograph, add " + (opts.people || "two people in their thirties") +
          " in the mid-ground, seen from behind at a three-quarter view, in casual neutral-toned clothing, " +
          "relaxed natural posture, mid-stride. Scale them correctly to the surroundings. Match the existing " +
          "sunlight direction and cast accurate soft shadows on the ground consistent with the other shadows " +
          "in the photo. Do not alter the house, roof, windows, doors, siding, landscaping, fence, driveway " +
          "or sky in any way. Do not change the camera angle or exposure. Photorealistic, natural depth of field.";
      case "sky":
        return "Using the provided photograph, replace only the sky with " + (opts.sky || "a clear blue sky with soft high clouds") +
          ". Keep the roofline, trees, wires and every edge exactly as they are, with a natural soft transition. " +
          "Match the lighting on the house to the new sky so the light direction and warmth remain consistent. " +
          "Do not alter the house, landscaping, driveway or any other part of the photo.";
      default:
        return (opts.text || "") + " " + KEEP;
    }
  }

  /* ------------------------------------------------------- swapping the photo
     Replace the picture behind a timeline item, keeping its position, caption,
     motion and duration. The original is tucked away for undo and for the MLS. */
  function replace(item, blob, meta) {
    return new Promise(function (res, rej) {
      var oldUrl = item.url;
      if (!item.gfAI || !item.gfAI.original) {
        item.gfAI = item.gfAI || {};
        // `kind` matters: undo has to know whether to put back a photo or a clip.
        item.gfAI.original = { blob: item.blob, name: item.name, kind: item.kind };
      }
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        item.kind = "image"; item.el = img; item.url = url; item.blob = blob; item.ready = true;
        item.natDur = 0;
        item.gfAI.job = meta.job;
        item.gfAI.model = meta.model || "on-device";
        item.gfAI.prompt = meta.prompt || "";
        item.gfAI.at = Date.now();
        if (meta.clean !== undefined) item.gfAI.clean = meta.clean;
        if (meta.labelJob !== undefined) item.gfAI.labelJob = meta.labelJob;
        try { if (oldUrl && oldUrl !== url) URL.revokeObjectURL(oldUrl); } catch (e) {}
        window.GF.renderList(); window.GF.rebuild();
        window.GF.drawAt(window.GF.posterTime()); window.GF.scheduleAutosave();
        res(item);
      };
      img.onerror = function () {
        try { URL.revokeObjectURL(url); } catch (e) {}
        rej(new Error("The edited photo came back unreadable."));
      };
      img.src = url;
    });
  }

  // Put the untouched original back, whatever the item has since become.
  function undo(item) {
    if (!item.gfAI || !item.gfAI.original) return Promise.resolve(item);
    var orig = item.gfAI.original;
    var wasVideo = orig.kind === "video";
    return new Promise(function (res, rej) {
      var oldUrl = item.url;
      var url = URL.createObjectURL(orig.blob);
      var el = wasVideo ? document.createElement("video") : new Image();
      var settled = false;
      function done() {
        if (settled) return; settled = true;
        item.kind = wasVideo ? "video" : "image";
        item.el = el; item.url = url; item.blob = orig.blob; item.ready = true;
        item.motion = wasVideo ? "still" : "auto";
        item.dur = null;
        item.natDur = wasVideo ? (isFinite(el.duration) && el.duration > 0 ? el.duration : 5) : 0;
        item.gfAI = { original: orig };     // still restorable if they edit again
        try { if (oldUrl && oldUrl !== url) URL.revokeObjectURL(oldUrl); } catch (e) {}
        window.GF.renderList(); window.GF.rebuild();
        window.GF.drawAt(window.GF.posterTime()); window.GF.scheduleAutosave();
        res(item);
      }
      function fail() {
        if (settled) return; settled = true;
        try { URL.revokeObjectURL(url); } catch (e) {}
        rej(new Error("Couldn't put the original back."));
      }
      if (wasVideo) { el.muted = true; el.playsInline = true; el.preload = "auto"; el.onloadeddata = done; }
      else el.onload = done;
      el.onerror = fail;
      el.src = url;
      setTimeout(fail, 20000);
    });
  }

  /* ---------------------------------------------------- finish an edited photo
     One funnel every action passes through, so the disclosure rules cannot be
     forgotten by whoever adds the next feature. Two subtleties live here:

     1. TWO COPIES ARE KEPT. The picture shown and exported carries the burned-in
        label; a clean, unlabelled twin is kept alongside it. Later edits are
        made from the clean copy, so labels never stack up on top of each other
        and no model is ever asked to redraw text it can see in its input.

     2. THE LABEL IS STICKY. Once a photo has been altered it stays labelled,
        even through later enhancements. Cropping a staged photo used to be able
        to cut the disclosure off the bottom-left corner — now the crop is taken
        from the clean copy and the label re-applied afterwards. */
  function finish(item, canvas, meta) {
    var priorLabel = item.gfAI && item.gfAI.labelJob;
    var labelJob = window.GFCompliance.isAlteration(meta.job) ? meta.job : (priorLabel || null);

    return window.GFLocal.canvasToBlob(canvas, "image/jpeg", 0.94).then(function (clean) {
      if (!labelJob || window.GFAI.cfg.disclose === false) {
        return replace(item, clean, extend(meta, { clean: null, labelJob: labelJob }));
      }
      window.GFCompliance.watermark(canvas, labelJob);
      return window.GFLocal.canvasToBlob(canvas, "image/jpeg", 0.94).then(function (shown) {
        return replace(item, shown, extend(meta, { clean: clean, labelJob: labelJob }));
      });
    }).then(function (it) {
      window.GFCompliance.log({
        photo: it.name, job: meta.job, model: meta.model, prompt: meta.prompt,
        address: (window.GF.listing() || {}).address
      });
      return it;
    });
  }

  function extend(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  // The picture later edits should work from: the unlabelled twin when there is
  // one, otherwise whatever is on the timeline.
  function sourceOf(item) {
    if (item.gfAI && item.gfAI.clean) return window.GFAI.toImage(item.gfAI.clean);
    return Promise.resolve(item.el);
  }

  /* ================================================================== free ops */

  function polish(item, say) {
    say && say("Reading the photo…");
    return sourceOf(item).then(function (src) {
      return window.GFLocal.autoGrade(src, 1);
    }).then(function (c) {
      return finish(item, c, { job: "grade", model: "on-device", prompt: "auto exposure, white balance and contrast" });
    });
  }

  function fitFrame(item, say) {
    var f = window.GF.formats[window.GF.state.format];
    var aspect = f.w / f.h;
    say && say("Finding the best crop…");
    return sourceOf(item).then(function (src) {
      return window.GFLocal.reframe(src, aspect).then(function (box) {
        if (!box.moved) throw new Error("This photo is already the right shape for " + window.GF.state.format + ".");
        var c = document.createElement("canvas");
        c.width = box.w; c.height = box.h;
        c.getContext("2d").drawImage(src, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
        return finish(item, c, { job: "reframe", model: "on-device", prompt: "smart crop to " + window.GF.state.format });
      });
    });
  }

  // Free sky replacement: find the sky with the small on-device model, paint a
  // real graded sky behind it, then feather the join.
  var SKIES = {
    blue:   [["#2E6FB8", 0], ["#7FB4E3", 0.55], ["#CFE4F5", 1]],
    sunset: [["#2B3D6B", 0], ["#B4636A", 0.5], ["#F3A96B", 0.82], ["#FBD9A5", 1]],
    dusk:   [["#16213E", 0], ["#3E4A78", 0.55], ["#8E7BA5", 0.85], ["#D8B4A0", 1]],
    bright: [["#4A8FD4", 0], ["#9CC9EE", 0.6], ["#EAF4FC", 1]]
  };

  function skySwap(item, kind, say) {
    var stops = SKIES[kind] || SKIES.blue;
    var src;
    say && say("Looking for the sky…");
    return sourceOf(item).then(function (s) {
      src = s;
      return window.GFLocal.segment(src, say).then(function (seg) {
        return seg && seg.sky ? seg.sky.toCanvas() : null;
      }).catch(function () { return null; });
    }).then(function (mask) {
      if (mask) return mask;
      say && say("Using the quick sky finder…");
      return window.GFLocal.skyMaskFallback(src);
    }).then(function (mask) {
      var W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
      // How much sky is there? If almost none, say so instead of guessing.
      var probe = document.createElement("canvas"); probe.width = 64; probe.height = 64;
      var pg = probe.getContext("2d"); pg.drawImage(mask, 0, 0, 64, 64);
      var pd = pg.getImageData(0, 0, 64, 64).data, lit = 0;
      for (var i = 0; i < pd.length; i += 4) if (pd[i] > 128) lit++;
      if (lit / 4096 < 0.02) throw new Error("Goldframe couldn't find much sky in this photo — try one with more of it visible.");

      say && say("Painting the new sky…");
      var soft = window.GFLocal.feather(scaleTo(mask, W, H), Math.max(1.5, Math.min(W, H) * 0.0025));

      // 1. the new sky, 2. masked to sky-only, 3. laid under the original photo
      var skyC = document.createElement("canvas"); skyC.width = W; skyC.height = H;
      var sg = skyC.getContext("2d");
      var grad = sg.createLinearGradient(0, 0, 0, H * 0.75);
      stops.forEach(function (s) { grad.addColorStop(s[1], s[0]); });
      sg.fillStyle = grad; sg.fillRect(0, 0, W, H);
      sg.globalCompositeOperation = "destination-in";
      sg.drawImage(soft, 0, 0, W, H);

      var out = document.createElement("canvas"); out.width = W; out.height = H;
      var og = out.getContext("2d");
      og.drawImage(src, 0, 0, W, H);
      og.globalAlpha = 0.97;
      og.drawImage(skyC, 0, 0);
      og.globalAlpha = 1;

      return finish(item, out, { job: "sky", model: "on-device", prompt: kind + " sky" });
    });
  }

  function scaleTo(canvasOrImage, W, H) {
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    c.getContext("2d").drawImage(canvasOrImage, 0, 0, W, H);
    return c;
  }

  /* ================================================================== paid ops */

  function cloudEdit(item, job, opts, say) {
    opts = opts || {};
    var modelId = opts.model || pickEditModel(job);
    var model = window.GFAI.findModel("edit", modelId);
    if (!model) {
      return Promise.reject(new Error("The model set for this job (\"" + modelId + "\") isn't in the list any more. Open AI settings and pick one."));
    }
    var prompt = prompts(job, opts);
    var cost = window.GFAI.estimate("edit", modelId, 1);

    say && say("Preparing the photo…");
    // Send the CLEAN copy — a model given an image with a disclosure label
    // burned into it will faithfully try to redraw the label.
    return sourceOf(item).then(function (src) {
      return window.GFAI.shrink(src, 1600, 0.94);
    }).then(function (dataUrl) {
      var input = { prompt: prompt, num_images: 1, output_format: "jpeg" };
      input[model.img === "image_url" ? "image_url" : "image_urls"] =
        model.img === "image_url" ? dataUrl : [dataUrl];
      return window.GFAI.run("edit", modelId, input, {
        cost: cost, onProgress: say, overCap: opts.overCap, timeoutMs: 5 * 60 * 1000
      });
    }).then(function (result) {
      var url = pickImageUrl(result);
      if (!url) throw new Error("The model finished but didn't return a picture. Try again, or pick a different model in AI settings.");
      say && say("Bringing the new photo back…");
      return window.GFAI.fetchBlob(url);
    }).then(function (blob) {
      return window.GFAI.toImage(blob);
    }).then(function (img) {
      var c = window.GFLocal.draw(img);
      return finish(item, c, { job: job, model: model.name || modelId, prompt: prompt });
    });
  }

  function pickEditModel(job) {
    var c = window.GFAI.cfg;
    if (job === "stage" || job === "restage") return c.editModel;
    // People and skies need the model that is best at leaving a house alone.
    if (job === "people" || job === "sky") return c.peopleModel;
    return c.peopleModel;
  }

  // fal returns images in a few different shapes depending on the family.
  function pickImageUrl(r) {
    if (!r) return null;
    if (typeof r === "string") return r;
    if (r.images && r.images.length) return r.images[0].url || r.images[0];
    if (r.image) return r.image.url || r.image;
    if (r.output && r.output.length) return r.output[0].url || r.output[0];
    if (r.data) return pickImageUrl(r.data);
    return null;
  }

  window.GFPhoto = {
    prompts: prompts,
    STYLES: STYLES,
    ROOM_HINTS: ROOM_HINTS,
    SKIES: SKIES,
    polish: polish,
    fitFrame: fitFrame,
    skySwap: skySwap,
    stage:     function (i, o, s) { return cloudEdit(i, "stage", o, s); },
    restage:   function (i, o, s) { return cloudEdit(i, "restage", o, s); },
    declutter: function (i, o, s) { return cloudEdit(i, "declutter", o, s); },
    addPeople: function (i, o, s) { return cloudEdit(i, "people", o, s); },
    cloudSky:  function (i, o, s) { return cloudEdit(i, "sky", o, s); },
    custom:    function (i, o, s) { return cloudEdit(i, "custom", o, s); },
    undo: undo,
    replace: replace,
    sourceOf: sourceOf
  };
})();
