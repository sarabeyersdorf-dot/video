/* ============================================================================
   Goldframe AI — the panel an agent actually touches
   ----------------------------------------------------------------------------
   Written for someone who sells houses, not software. The rules it follows:

     * Every button says what it does to a listing, not what it does to a file.
     * Free is free and paid is paid, marked on the button, every time.
     * Nothing costs money without showing the price and waiting for a yes.
     * One thing runs at a time, with honest progress and a Stop button.
     * Anything AI does can be undone, per photo, forever.

   The whole panel is built here in code rather than in the page, so the AI
   features stay in one place and the editor's own markup is untouched.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var sel = {};            // media id -> true
  var busy = false;
  var cancelled = false;

  /* ------------------------------------------------------------------ styles */
  var css = document.createElement("style");
  css.textContent = [
    // The editor tints each control card by its position. Pin this one and give
    // the (now ninth) last card a colour, so inserting the panel doesn't leave
    // anything grey.
    "#aiCard{--ca:var(--accent)}",
    ".controls > section.card:nth-of-type(9){--ca:var(--c2)}",
    ".ai-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}",
    ".ai-chip{font-family:var(--mono);font-size:11px;letter-spacing:.04em;padding:4px 9px;border-radius:999px;border:1px solid var(--line-2);color:var(--muted);white-space:nowrap}",
    ".ai-chip.on{color:var(--accent);border-color:var(--accent)}",
    ".ai-group{border-top:1px solid var(--line);padding-top:14px;margin-top:16px}",
    ".ai-group h3{font-size:12.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:0 0 4px;font-weight:600}",
    ".ai-group p.desc{margin:0 0 10px}",
    ".ai-btns{display:flex;gap:8px;flex-wrap:wrap}",
    ".ai-btns .btn{font-size:12.5px}",
    ".tag{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;margin-left:7px;padding:2px 5px;border-radius:4px;vertical-align:1px}",
    ".tag.free{background:rgba(87,185,138,.16);color:#3f9e72;border:1px solid rgba(87,185,138,.35)}",
    ".tag.paid{background:rgba(224,178,60,.16);color:#a07a1c;border:1px solid rgba(224,178,60,.4)}",
    "body.dark .tag.free{color:#7fd3ab} body.dark .tag.paid{color:#e0b23c}",
    ".ai-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;margin:10px 0 12px}",
    ".ai-thumb{position:relative;aspect-ratio:1;border-radius:9px;overflow:hidden;border:2px solid var(--line);cursor:pointer;background:#000}",
    ".ai-thumb img,.ai-thumb video{width:100%;height:100%;object-fit:cover;display:block}",
    ".ai-thumb.sel{border-color:var(--accent);box-shadow:0 0 0 2px rgba(198,161,91,.25)}",
    ".ai-thumb .mk{position:absolute;left:4px;bottom:4px;font-family:var(--mono);font-size:8.5px;background:rgba(0,0,0,.66);color:#fff;padding:1px 4px;border-radius:3px;letter-spacing:.04em}",
    ".ai-thumb .ed{position:absolute;right:4px;top:4px;width:15px;height:15px;border-radius:50%;background:var(--accent);color:#1d1f20;font-size:9px;line-height:15px;text-align:center;font-weight:700}",
    ".ai-run{margin-top:12px;font-size:12.5px;color:var(--accent);font-family:var(--mono);min-height:17px}",
    ".ai-bar{height:3px;border-radius:999px;background:var(--line);overflow:hidden;margin-top:8px;display:none}",
    ".ai-bar.on{display:block} .ai-bar i{display:block;height:100%;background:var(--accent);width:0;transition:width .3s}",
    ".ai-note{font-size:11.5px;color:var(--faint);line-height:1.5;margin-top:9px}",
    ".ai-cost{font-family:var(--mono);font-size:22px;color:var(--accent);margin:6px 0 2px}",
    ".ai-model{display:block;border:1px solid var(--line);border-radius:10px;padding:11px 13px;margin-bottom:9px;cursor:pointer}",
    ".ai-model.sel{border-color:var(--accent);background:rgba(198,161,91,.06)}",
    ".ai-model b{display:block;font-size:13.5px;margin-bottom:2px}",
    ".ai-model span{display:block;font-size:11.5px;color:var(--muted);line-height:1.45}",
    ".ai-model em{font-family:var(--mono);font-style:normal;font-size:11px;color:var(--accent)}"
  ].join("\n");
  document.head.appendChild(css);

  /* ------------------------------------------------------------------ markup */
  function build() {
    var controls = document.querySelector(".controls");
    if (!controls) return;

    var card = document.createElement("section");
    card.className = "card";
    card.id = "aiCard";
    card.innerHTML = [
      '<div class="ai-head">',
      '  <h2 style="margin:0">AI Studio &#10024;</h2>',
      '  <div style="display:flex;gap:7px;align-items:center">',
      '    <span class="ai-chip" id="aiMode">Free mode</span>',
      '    <button class="btn ghost" id="aiSettingsBtn" style="font-size:12px;padding:6px 11px">Settings</button>',
      '  </div>',
      '</div>',
      '<p class="desc">Let AI do the fiddly parts — fixing photos, furnishing empty rooms, making stills move, writing the words and reading them out loud. Everything marked <span class="tag free">FREE</span> runs on your own computer and costs nothing.</p>',

      '<button class="btn primary" id="aiMagic" style="width:100%;margin-bottom:4px">&#10024; Polish this whole listing <span class="tag free">FREE</span></button>',
      '<p class="ai-note">Fixes the exposure and colour of every photo, writes a caption for each, and orders them into a story. About five seconds a photo. Nothing leaves your computer.</p>',

      '<div class="ai-group">',
      '  <h3>Pick the photos to work on</h3>',
      '  <p class="desc">Tap to select. With none selected, actions apply to every photo.</p>',
      '  <div class="ai-strip" id="aiStrip"></div>',
      '  <div class="ai-btns">',
      '    <button class="btn ghost" id="aiSelAll" style="font-size:12px">Select all</button>',
      '    <button class="btn ghost" id="aiSelNone" style="font-size:12px">Clear</button>',
      '    <button class="btn ghost" id="aiUndo" style="font-size:12px">&#8634; Undo AI on selected</button>',
      '  </div>',
      '</div>',

      '<div class="ai-group">',
      '  <h3>Make the photos better</h3>',
      '  <div class="ai-btns">',
      '    <button class="btn" data-ai="polish">Fix exposure &amp; colour <span class="tag free">FREE</span></button>',
      '    <button class="btn" data-ai="fit">Smart crop to frame <span class="tag free">FREE</span></button>',
      '    <button class="btn" data-ai="sky">Replace the sky <span class="tag free">FREE</span></button>',
      '    <select id="aiSkyKind" style="max-width:150px"><option value="blue">Clear blue</option><option value="bright">Bright &amp; open</option><option value="sunset">Sunset</option><option value="dusk">Dusk</option></select>',
      '  </div>',
      '  <p class="ai-note">Fixing exposure and cropping are photo enhancements — no disclosure needed. Replacing a sky changes the property as photographed, so Goldframe labels it. <a href="#" id="aiWhyLabel">Why?</a></p>',
      '</div>',

      '<div class="ai-group">',
      '  <h3>Furnish &amp; restyle the rooms</h3>',
      '  <p class="desc">Turn an empty room into one a buyer can picture living in.</p>',
      '  <div class="ai-btns" style="margin-bottom:10px">',
      '    <select id="aiRoom" style="max-width:150px"></select>',
      '    <select id="aiStyle" style="max-width:180px"></select>',
      '  </div>',
      '  <div class="ai-btns">',
      '    <button class="btn" data-ai="stage">Furnish empty room <span class="tag paid">PAID</span></button>',
      '    <button class="btn" data-ai="restage">Restyle furniture <span class="tag paid">PAID</span></button>',
      '    <button class="btn" data-ai="declutter">Remove clutter <span class="tag paid">PAID</span></button>',
      '    <button class="btn" data-ai="people">Add people <span class="tag paid">PAID</span></button>',
      '  </div>',
      '  <label class="field" style="margin-top:10px">Or say it in your own words',
      '    <input type="text" id="aiCustom" placeholder="e.g. make the lawn green and healthy">',
      '  </label>',
      '  <button class="btn ghost" data-ai="custom" style="margin-top:8px;font-size:12.5px">Do that <span class="tag paid">PAID</span></button>',
      '</div>',

      '<div class="ai-group">',
      '  <h3>Make the stills move</h3>',
      '  <div class="ai-btns" style="margin-bottom:10px">',
      '    <select id="aiMotionKind" style="max-width:150px"></select>',
      '    <select id="aiSeconds" style="max-width:120px"><option value="4">4 seconds</option><option value="5" selected>5 seconds</option><option value="6">6 seconds</option><option value="8">8 seconds</option></select>',
      '  </div>',
      '  <div class="ai-btns">',
      '    <button class="btn" data-ai="parallax">3D depth move <span class="tag free">FREE</span></button>',
      '    <button class="btn" data-ai="generate">AI video clip <span class="tag paid">PAID</span></button>',
      '    <label class="toggle" style="margin:0 0 0 4px"><input type="checkbox" id="aiLife"> add life (water, leaves, clouds)</label>',
      '  </div>',
      '  <p class="ai-note"><b>3D depth move</b> works out how far away everything is and pushes the camera through the room for real — free, on your computer, about ten seconds a photo. <b>AI video clip</b> sends the photo to a video model that can actually move water and drift clouds. Both replace the photo with a clip you can still reorder and caption.</p>',
      '</div>',

      '<div class="ai-group">',
      '  <h3>Words &amp; voice</h3>',
      '  <div class="ai-btns">',
      '    <button class="btn" data-ai="captions">Caption every clip <span class="tag free">FREE</span></button>',
      '    <button class="btn" data-ai="script">Write the narration <span class="tag free">FREE</span></button>',
      '    <button class="btn" data-ai="socialfree">Write the post <span class="tag free">FREE</span></button>',
      '  </div>',
      '  <div class="ai-btns" style="margin-top:9px">',
      '    <button class="btn ghost" data-ai="smartcaptions">Caption from what AI sees <span class="tag paid">PAID</span></button>',
      '    <button class="btn ghost" data-ai="smartscript">Better narration <span class="tag paid">PAID</span></button>',
      '    <button class="btn ghost" data-ai="smartsocial">Better post <span class="tag paid">PAID</span></button>',
      '  </div>',
      '  <div class="ai-btns" style="margin-top:12px;align-items:center">',
      '    <button class="btn primary" data-ai="speak">&#127908; Read it in a real voice <span class="tag paid">PAID</span></button>',
      '    <select id="aiVoice" style="max-width:170px"></select>',
      '  </div>',
      '  <p class="ai-note">The narration lands in the Voiceover panel and is mixed into the exported video, with the music ducking underneath — the same as a voice you record yourself.</p>',
      '</div>',

      '<div class="ai-group">',
      '  <h3>Disclosure &amp; compliance</h3>',
      '  <label class="toggle" style="margin-bottom:8px"><input type="checkbox" id="aiDisclose" checked> Label photos that AI changed</label>',
      '  <p class="ai-note" id="aiDiscloseNote"></p>',
      '  <div class="ai-btns" style="margin-top:9px">',
      '    <button class="btn ghost" id="aiCopyRemarks" style="font-size:12px">Copy MLS disclosure line</button>',
      '    <button class="btn ghost" id="aiRecord" style="font-size:12px">Download the AI record</button>',
      '  </div>',
      '</div>',

      '<div class="ai-run" id="aiRun"></div>',
      '<div class="ai-bar" id="aiBar"><i></i></div>',
      '<button class="btn ghost" id="aiStop" style="display:none;margin-top:10px;font-size:12px">Stop</button>'
    ].join("");

    // Right under "Photos & footage", where the eye already is.
    var first = controls.querySelector(".card");
    if (first && first.nextSibling) controls.insertBefore(card, first.nextSibling);
    else controls.appendChild(card);

    buildSettings();
    buildConfirm();
    fillSelects();
    wire();
    refresh();
  }

  /* ---------------------------------------------------------------- settings */
  function buildSettings() {
    var m = document.createElement("div");
    m.className = "modal"; m.id = "aiSettings";
    m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "AI settings");
    m.innerHTML = [
      '<div class="sheet">',
      '  <div class="sheet-head">',
      '    <div><h2>AI settings</h2><p class="desc">Goldframe uses one AI account — fal.ai — for everything paid. One key, one bill, every model.</p></div>',
      '    <button class="x" data-aiclose="aiSettings" aria-label="Close">&times;</button>',
      '  </div>',
      '  <div class="ai-group" style="border-top:0;padding-top:0;margin-top:0">',
      '    <h3>On the team?</h3>',
      '    <p class="desc">Type the passcode your brokerage gave you. You never see or handle a key, and the cost goes to the office account.</p>',
      '    <label class="field full">Team passcode<input type="password" id="aiTeam" placeholder="ask your admin" autocomplete="off"></label>',
      '  </div>',
      '  <div class="ai-group">',
      '    <h3>Or use your own account</h3>',
      '    <p class="desc">Make a free account at <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener">fal.ai</a>, add a card, copy the key, paste it here. It is saved in this browser only — never sent to us, never shared with anyone else using this page.</p>',
      '    <label class="field full">Your fal.ai key<input type="password" id="aiKey" placeholder="fal-..." autocomplete="off"></label>',
      '  </div>',
      '  <div class="ai-group">',
      '    <h3>Spending</h3>',
      '    <div class="subgrid">',
      '      <label class="field">Stop and ask after<input type="number" id="aiCap" min="0" step="1" value="10"></label>',
      '      <div style="align-self:end;padding-bottom:9px;font-size:12.5px;color:var(--muted)">dollars in a day. Set 0 for no limit.</div>',
      '    </div>',
      '    <p class="ai-note" id="aiSpendNote"></p>',
      '  </div>',
      '  <div class="ai-group">',
      '    <h3>Which video model</h3>',
      '    <div id="aiVideoModels"></div>',
      '  </div>',
      '  <div class="ai-group">',
      '    <h3>Which model furnishes rooms</h3>',
      '    <div id="aiEditModels"></div>',
      '  </div>',
      '  <div class="ai-group">',
      '    <h3>Which model adds people &amp; changes skies</h3>',
      '    <div id="aiPeopleModels"></div>',
      '  </div>',
      '  <div class="ai-group">',
      '    <h3>Which voice</h3>',
      '    <div id="aiTtsModels"></div>',
      '  </div>',
      '  <div class="ai-group">',
      '    <h3>Which model writes music</h3>',
      '    <div id="aiMusicModels"></div>',
      '  </div>',
      '  <div class="modal-actions">',
      '    <button class="btn primary" id="aiSave">Save</button>',
      '    <button class="btn ghost" id="aiTest">Test the connection</button>',
      '    <button class="btn ghost" id="aiResetSpend">Reset today\'s total</button>',
      '    <button class="btn ghost" data-aiclose="aiSettings">Close</button>',
      '  </div>',
      '  <p class="ai-note" id="aiTestNote"></p>',
      '</div>'
    ].join("");
    document.body.appendChild(m);
    m.addEventListener("click", function (e) { if (e.target === m) close("aiSettings"); });
  }

  function buildConfirm() {
    var m = document.createElement("div");
    m.className = "modal"; m.id = "aiConfirm";
    m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "Confirm");
    m.innerHTML = [
      '<div class="sheet" style="max-width:460px">',
      '  <div class="sheet-head"><div><h2 id="aiCfTitle">Just checking</h2></div>',
      '  <button class="x" data-aiclose="aiConfirm" aria-label="Close">&times;</button></div>',
      '  <div class="ai-cost" id="aiCfCost"></div>',
      '  <p class="desc" id="aiCfBody" style="margin-bottom:0"></p>',
      '  <div class="modal-actions"><button class="btn primary" id="aiCfGo">Yes, go ahead</button>',
      '  <button class="btn ghost" data-aiclose="aiConfirm">Not now</button></div>',
      '</div>'
    ].join("");
    document.body.appendChild(m);
    m.addEventListener("click", function (e) { if (e.target === m) close("aiConfirm"); });
  }

  function open(id) { $(id).classList.add("open"); }
  function close(id) { $(id).classList.remove("open"); }

  // A money question, asked plainly, every time.
  function ask(title, cost, body) {
    return new Promise(function (res) {
      $("aiCfTitle").textContent = title;
      $("aiCfCost").textContent = cost != null ? "about " + window.GFAI.money(cost) : "";
      $("aiCfBody").textContent = body;
      var go = $("aiCfGo"), done = false;
      go.onclick = function () { if (done) return; done = true; close("aiConfirm"); res(true); };
      var m = $("aiConfirm");
      var watch = setInterval(function () {
        if (!m.classList.contains("open") && !done) { done = true; clearInterval(watch); res(false); }
        if (done) clearInterval(watch);
      }, 200);
      open("aiConfirm");
    });
  }

  /* ----------------------------------------------------------------- filling */
  function fillSelects() {
    var r = $("aiRoom");
    [["living", "Living room"], ["bedroom", "Bedroom"], ["dining", "Dining room"], ["office", "Home office"], ["patio", "Patio / outdoor"]]
      .forEach(function (o) { r.appendChild(opt(o[0], o[1])); });

    var s = $("aiStyle");
    Object.keys(window.GFPhoto.STYLES).forEach(function (k) { s.appendChild(opt(k, k.replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }))); });

    var mo = $("aiMotionKind");
    [["push-in", "Push in"], ["pull-out", "Pull out"], ["pan-left", "Pan left"], ["pan-right", "Pan right"],
     ["pan-up", "Tilt up"], ["pan-down", "Tilt down"], ["drone-up", "Drone rise"], ["orbit", "Orbit"], ["ken-burns", "Drift"]]
      .forEach(function (o) { mo.appendChild(opt(o[0], o[1])); });

    fillVoices();
    modelPicker("aiVideoModels", "video", "videoModel");
    modelPicker("aiEditModels", "edit", "editModel");
    modelPicker("aiPeopleModels", "edit", "peopleModel");
    modelPicker("aiTtsModels", "tts", "ttsModel", fillVoices);
    modelPicker("aiMusicModels", "music", "musicModel");
  }

  function fillVoices() {
    var v = $("aiVoice"); if (!v) return;
    v.innerHTML = "";
    var m = window.GFAI.findModel("tts", window.GFAI.cfg.ttsModel);
    (m && m.voices ? m.voices : ["af_heart"]).forEach(function (name) {
      v.appendChild(opt(name, pretty(name)));
    });
    if (window.GFAI.cfg.ttsVoice) v.value = window.GFAI.cfg.ttsVoice;
    if (!v.value) v.selectedIndex = 0;
  }
  function pretty(v) {
    var map = { af_heart: "Heart — warm (best)", af_bella: "Bella — warm", af_nicole: "Nicole — soft",
                am_michael: "Michael — male", am_puck: "Puck — male", bf_emma: "Emma — British" };
    return map[v] || v;
  }
  function opt(v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; return o; }

  function modelPicker(hostId, task, cfgKey, after) {
    var host = $(hostId); if (!host) return;
    host.innerHTML = "";
    window.GFAI.CATALOG[task].forEach(function (m) {
      var el = document.createElement("label");
      el.className = "ai-model" + (window.GFAI.cfg[cfgKey] === m.id ? " sel" : "");
      var unit = m.per === "second" ? ("$" + m.price.toFixed(3).replace(/0+$/, "") + " a second")
              : m.per === "minute" ? ("$" + m.price.toFixed(2) + " a minute")
              : m.per === "track" ? ("$" + m.price.toFixed(2) + " a track")
              : m.per === "1k chars" ? ("$" + m.price.toFixed(2) + " per 1,000 characters")
              : ("$" + m.price.toFixed(3).replace(/0+$/, "") + " an image");
      el.innerHTML = "<b>" + m.name + "</b><span>" + m.blurb + "</span><em>" + unit + "</em>";
      el.onclick = function () {
        window.GFAI.cfg[cfgKey] = m.id; window.GFAI.save();
        Array.prototype.forEach.call(host.children, function (c) { c.classList.remove("sel"); });
        el.classList.add("sel");
        if (after) after();
      };
      host.appendChild(el);
    });
  }

  /* -------------------------------------------------------------- photo strip */
  function strip() {
    var host = $("aiStrip"); if (!host) return;
    host.innerHTML = "";
    var media = window.GF.state.media.filter(function (m) { return m.ready; });
    if (!media.length) {
      host.innerHTML = '<p class="desc" style="grid-column:1/-1;margin:0">Add photos above and they\'ll appear here.</p>';
      return;
    }
    media.forEach(function (m) {
      var d = document.createElement("div");
      d.className = "ai-thumb" + (sel[m.id] ? " sel" : "");
      var t;
      if (m.kind === "image") { t = document.createElement("img"); t.src = m.url; }
      else { t = document.createElement("video"); t.src = m.url; t.muted = true; }
      d.appendChild(t);
      if (m.kind === "video") { var k = document.createElement("span"); k.className = "mk"; k.textContent = "clip"; d.appendChild(k); }
      if (m.gfAI && m.gfAI.job) {
        var alt = window.GFCompliance.alterationOf(m);
        var e = document.createElement("span"); e.className = "ed"; e.textContent = "AI";
        e.title = alt
          ? "Labelled " + window.GFCompliance.labelFor(alt) + " — last change: " + m.gfAI.job +
            (m.gfAI.model ? " (" + m.gfAI.model + ")" : "")
          : "Improved by AI: " + m.gfAI.job + " — no disclosure needed";
        d.appendChild(e);
      }
      d.onclick = function () { sel[m.id] ? delete sel[m.id] : (sel[m.id] = true); strip(); };
      host.appendChild(d);
    });
  }

  function targets(imagesOnly) {
    var media = window.GF.state.media.filter(function (m) { return m.ready; });
    var picked = media.filter(function (m) { return sel[m.id]; });
    var list = picked.length ? picked : media;
    return imagesOnly ? list.filter(function (m) { return m.kind === "image"; }) : list;
  }

  /* ------------------------------------------------------------------ running */
  function say(msg) { var r = $("aiRun"); if (r) r.textContent = msg || ""; }
  function bar(frac) {
    var b = $("aiBar"); if (!b) return;
    if (frac == null) { b.classList.remove("on"); return; }
    b.classList.add("on"); b.firstChild.style.width = Math.round(frac * 100) + "%";
  }
  function start() { busy = true; cancelled = false; $("aiStop").style.display = "inline-flex"; setButtons(true); }
  function stop(msg, cls) {
    busy = false; $("aiStop").style.display = "none"; setButtons(false); bar(null);
    say(msg || "");
    if (msg) window.GF.setStatus(msg, cls || "ok");
    strip(); refresh();
  }
  function setButtons(off) {
    Array.prototype.forEach.call(document.querySelectorAll("#aiCard .btn"), function (b) {
      if (b.id === "aiStop" || b.id === "aiSettingsBtn") return;
      b.disabled = off;
    });
  }

  // Walk a list of photos, one at a time, with progress and a working Stop.
  function each(list, fn, label) {
    var i = 0, ok = 0, failures = [];
    function next() {
      if (cancelled) return Promise.resolve();
      if (i >= list.length) return Promise.resolve();
      var m = list[i];
      bar(i / list.length);
      say(label + " — " + (i + 1) + " of " + list.length + (m.name ? " (" + m.name + ")" : "") + "…");
      return fn(m, function (s) { say(label + " " + (i + 1) + "/" + list.length + " — " + s); })
        .then(function () { ok++; })
        .catch(function (e) { failures.push((m.name || "a photo") + ": " + friendly(e)); })
        .then(function () { i++; strip(); return next(); });
    }
    return next().then(function () { return { ok: ok, failures: failures }; });
  }

  function report(res, what) {
    if (cancelled) return stop("Stopped. " + res.ok + " " + what + " finished before you stopped it.", "");
    if (!res.failures.length) return stop("Done — " + res.ok + " " + what + ".", "ok");
    if (!res.ok) return stop(res.failures[0], "err");
    stop(res.ok + " " + what + ", " + res.failures.length + " didn't work. " + res.failures[0], "");
  }

  function friendly(e) {
    var m = (e && e.message) || String(e);
    if (m === "NO_KEY") return "no AI key set up yet";
    if (m === "OVER_CAP") return "daily spending limit reached";
    if (m === "TEAM_NEEDS_SITE") return "team keys only work on the Goldframe website";
    return m;
  }

  // Everything paid comes through here: check there's a key, price it, check it
  // against the daily limit, then ask.
  //
  // The limit is enforced HERE, on the whole batch, rather than inside each
  // individual call. Checking per-item would stop a run halfway through with
  // some photos done and some not — worse than not starting. Checking the batch
  // total up front means the user is asked once, about the real number.
  function paid(title, cost, body, run) {
    if (!window.GFAI.ready()) {
      openSettings();   // full setup: populates fields AND wires Save / Test / Close
      window.GF.setStatus("Add a team passcode or your own AI key first — it takes a minute.", "err");
      return;
    }
    var spent = window.GFAI.spentToday();
    var cap = +window.GFAI.cfg.spendCap || 0;
    var over = cap > 0 && (spent + cost) > cap;

    if (over) {
      return ask("This goes past your daily limit", cost,
        body + "\n\nYou've spent about " + window.GFAI.money(spent) + " today and your limit is " +
        window.GFAI.money(cap) + ". This would take you to about " + window.GFAI.money(spent + cost) +
        ".\n\nGo ahead only if you meant to. You can change the limit in AI settings."
      ).then(function (yes) { if (yes) run(); }, function () {});
    }
    var note = body + (cap ? "\n\nSpent so far today: " + window.GFAI.money(spent) + " of your " + window.GFAI.money(cap) + " limit." : "");
    ask(title, cost, note).then(function (yes) { if (yes) run(); }, function () {});
  }

  /* -------------------------------------------------------------------- wiring */
  function wire() {
    $("aiSettingsBtn").onclick = function () { openSettings(); };
    $("aiSelAll").onclick = function () { window.GF.state.media.forEach(function (m) { if (m.ready) sel[m.id] = true; }); strip(); };
    $("aiSelNone").onclick = function () { sel = {}; strip(); };
    $("aiStop").onclick = function () { cancelled = true; say("Stopping after this one…"); };
    $("aiWhyLabel").onclick = function (e) {
      e.preventDefault();
      window.alert(
        "California AB 723 (in force since 1 January 2026) says that if a listing image is changed to add, " +
        "remove or alter a physical element — furniture, a sky, landscaping, people — the marketing must say " +
        "so clearly and must tell people how to see the untouched original.\n\n" +
        "Brightness, contrast, white balance and cropping are specifically excluded: they are enhancements, " +
        "not alterations. Goldframe follows that line exactly, labels the picture itself so the label survives " +
        "any repost, keeps your original photo for undo and export, and writes the disclosure line for the MLS.\n\n" +
        "Your MLS may ask for more (CRMLS wants a watermark and a remarks note; Bright wants it in the caption). " +
        "This is a sensible default, not legal advice."
      );
    };

    $("aiUndo").onclick = function () {
      var list = targets(false).filter(function (m) { return m.gfAI && m.gfAI.original; });
      if (!list.length) return window.GF.setStatus("Nothing to undo on those — AI hasn't changed them.", "");
      start();
      each(list, function (m) { return window.GFMotion.undo(m); }, "Putting originals back")
        .then(function (r) { report(r, "restored"); });
    };

    $("aiDisclose").checked = window.GFAI.cfg.disclose !== false;
    $("aiDisclose").onchange = function () {
      window.GFAI.cfg.disclose = this.checked; window.GFAI.save(); refresh();
    };

    $("aiCopyRemarks").onclick = function () {
      var t = window.GFCompliance.remarksLine();
      copy(t, "MLS disclosure line copied — paste it into your listing remarks.");
    };
    $("aiRecord").onclick = function () {
      var L = window.GF.listing() || {};
      var text = window.GFCompliance.exportRecord(L.address);
      var blob = new Blob([text], { type: "text/plain" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "goldframe-ai-disclosure-record.txt";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      window.GF.setStatus("Downloaded your AI disclosure record.", "ok");
    };

    $("aiMagic").onclick = function () {
      var list = targets(true);
      if (!list.length) return window.GF.setStatus("Add some photos first.", "err");
      start();
      each(list, function (m, s) { return window.GFPhoto.polish(m, s); }, "Polishing")
        .then(function (r) {
          if (cancelled) return report(r, "photos polished");
          return window.GFWords.captions(function () {}).then(function () {
            var b = $("curateBtn");
            if (b && !b.disabled) b.click();
            stop("Polished " + r.ok + " photos, captioned the clips and ordered them into a story. Have a look at the preview.", "ok");
          });
        })
        .catch(function (e) { stop(friendly(e), "err"); });
    };

    // The action buttons all share one handler — add a case, get a button.
    Array.prototype.forEach.call(document.querySelectorAll("#aiCard [data-ai]"), function (b) {
      b.onclick = function () { action(b.getAttribute("data-ai")); };
    });

    window.GFAI.on("spend", function () { refresh(); });

    // Keep the strip in step with the photo list. Watching the list rather than
    // patching the editor's render function means the two stay decoupled — the
    // editor doesn't have to know the AI panel exists.
    var list = $("mediaList");
    if (list && window.MutationObserver) {
      new MutationObserver(function () { strip(); }).observe(list, { childList: true, subtree: true });
    }
    strip();
  }

  function copy(text, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { window.GF.setStatus(msg, "ok"); },
        function () { window.prompt("Copy this:", text); });
    } else window.prompt("Copy this:", text);
  }

  /* --------------------------------------------------------------- the actions */
  function action(kind) {
    if (busy) return;
    var photos = targets(true);
    var all = targets(false);
    var secs = +($("aiSeconds").value) || 5;

    switch (kind) {
      case "polish":
        if (!photos.length) return window.GF.setStatus("Add some photos first.", "err");
        start();
        return each(photos, function (m, s) { return window.GFPhoto.polish(m, s); }, "Polishing")
          .then(function (r) { report(r, "photos improved"); });

      case "fit":
        if (!photos.length) return window.GF.setStatus("Add some photos first.", "err");
        start();
        return each(photos, function (m, s) { return window.GFPhoto.fitFrame(m, s); }, "Cropping")
          .then(function (r) { report(r, "photos cropped"); });

      case "sky": {
        if (!photos.length) return window.GF.setStatus("Add some photos first.", "err");
        var kindSky = $("aiSkyKind").value;
        start();
        return each(photos, function (m, s) { return window.GFPhoto.skySwap(m, kindSky, s); }, "Replacing the sky")
          .then(function (r) { report(r, "skies replaced"); });
      }

      case "parallax":
        if (!photos.length) return window.GF.setStatus("Select at least one photo.", "err");
        if (!window.GFLocal.available()) return window.GF.setStatus("This needs the app open at a web address, not a file on your desktop.", "err");
        start();
        return each(photos, function (m, s) {
          return window.GFMotion.parallax(m, { motion: $("aiMotionKind").value, seconds: secs }, s);
        }, "Building the 3D move").then(function (r) { report(r, "clips made"); });

      case "generate": {
        if (!photos.length) return window.GF.setStatus("Select at least one photo.", "err");
        var vm = window.GFAI.cfg.videoModel;
        var each1 = window.GFAI.estimate("video", vm, secs);
        return paid("Make " + photos.length + " AI video clip" + (photos.length > 1 ? "s" : ""),
          each1 * photos.length,
          "Using " + (window.GFAI.findModel("video", vm) || {}).name + " at " + secs + " seconds each. " +
          "Each clip takes roughly a minute to come back.",
          function () {
            start();
            each(photos, function (m, s) {
              return window.GFMotion.generate(m, { seconds: secs, motion: $("aiMotionKind").value, life: $("aiLife").checked, overCap: true }, s);
            }, "Generating").then(function (r) { report(r, "clips generated"); });
          });
      }

      case "stage": case "restage": case "declutter": case "people": case "custom": {
        if (!photos.length) return window.GF.setStatus("Select at least one photo.", "err");
        var jobName = { stage: "Furnish", restage: "Restyle", declutter: "Declutter", people: "Add people to", custom: "Edit" }[kind];
        var mid = (kind === "people" || kind === "custom") ? window.GFAI.cfg.peopleModel : window.GFAI.cfg.editModel;
        var per = window.GFAI.estimate("edit", mid, 1);
        var text = $("aiCustom").value.trim();
        if (kind === "custom" && !text) return window.GF.setStatus("Type what you'd like changed first.", "err");
        var opts = {
          style: $("aiStyle").value, room: $("aiRoom").value, text: text,
          model: mid, overCap: true
        };
        return paid(jobName + " " + photos.length + " photo" + (photos.length > 1 ? "s" : ""),
          per * photos.length,
          "Using " + (window.GFAI.findModel("edit", mid) || {}).name + ". Your original photos are kept, so you can undo any of this.",
          function () {
            start();
            var fn = { stage: "stage", restage: "restage", declutter: "declutter", people: "addPeople", custom: "custom" }[kind];
            each(photos, function (m, s) { return window.GFPhoto[fn](m, opts, s); }, jobName + "ing")
              .then(function (r) { report(r, "photos changed"); });
          });
      }

      case "captions":
        return window.GFWords.captions(function (m) { window.GF.setStatus(m, "ok"); say(m); });

      case "script": {
        var t = window.GFWords.script();
        $("vo_script").value = t; window.GF.state.voScript = t; window.GF.scheduleAutosave();
        return window.GF.setStatus("Narration written from your listing — read it through in the Voiceover panel and change anything that isn't you.", "ok");
      }

      case "socialfree": {
        var s2 = window.GFWords.social();
        if ($("shareCaption")) $("shareCaption").value = s2;
        return window.GF.setStatus("Post caption written — it's in the Share & publish panel.", "ok");
      }

      case "smartcaptions":
        return paid("Look at " + photos.length + " photo" + (photos.length > 1 ? "s" : "") + " and caption them",
          window.GFAI.estimate("text", "fal-ai/any-llm/vision", 1) * photos.length,
          "AI reads each photo and writes a caption from what it can actually see.",
          function () {
            start(); say("Looking at your photos…");
            window.GFWords.smartCaptions(say, { overCap: true })
              .then(function (n) { stop("Captioned " + n + " photos from what AI could see.", "ok"); })
              .catch(function (e) { stop(friendly(e), "err"); });
          });

      case "smartscript":
        return paid("Write a better narration", window.GFAI.estimate("text", "fal-ai/any-llm", 1),
          "AI writes a 30-second script from your listing details and the rooms in your video.",
          function () {
            start();
            window.GFWords.smartScript(say, { overCap: true }).then(function (t2) {
              $("vo_script").value = t2; window.GF.state.voScript = t2; window.GF.scheduleAutosave();
              stop("Narration written. It's in the Voiceover panel.", "ok");
            }).catch(function (e) { stop(friendly(e), "err"); });
          });

      case "smartsocial":
        return paid("Write a better post", window.GFAI.estimate("text", "fal-ai/any-llm", 1),
          "AI writes the caption and hashtags for your post.",
          function () {
            start();
            window.GFWords.smartSocial("Instagram", say, { overCap: true }).then(function (t3) {
              if ($("shareCaption")) $("shareCaption").value = t3;
              stop("Post written. It's in the Share & publish panel.", "ok");
            }).catch(function (e) { stop(friendly(e), "err"); });
          });

      case "speak": {
        var scriptText = ($("vo_script").value || "").trim() || window.GFWords.script();
        var mid2 = window.GFAI.cfg.ttsModel;
        return paid("Read the narration out loud",
          window.GFAI.estimate("tts", mid2, scriptText.length),
          "About " + Math.round(scriptText.length / 15) + " seconds of speech, in the " +
          ((window.GFAI.findModel("tts", mid2) || {}).name || "chosen") + " voice. It goes straight into your video.",
          function () {
            start();
            window.GFAI.cfg.ttsVoice = $("aiVoice").value; window.GFAI.save();
            window.GFWords.speak(scriptText, { voice: $("aiVoice").value, overCap: true }, say)
              .then(function () { stop("Narration ready. Check the Voiceover panel — the music will duck underneath it.", "ok"); })
              .catch(function (e) { stop(friendly(e), "err"); });
          });
      }
    }
  }

  /* ----------------------------------------------------------------- settings */
  function openSettings() {
    $("aiTeam").value = window.GFAI.cfg.teamCode || "";
    $("aiKey").value = window.GFAI.cfg.ownKey || "";
    $("aiCap").value = window.GFAI.cfg.spendCap;
    $("aiSpendNote").textContent = "Spent today, by Goldframe's own estimate: " + window.GFAI.money(window.GFAI.spentToday()) +
      ". This is a guide, not a bill — your real total is on your fal.ai dashboard.";
    $("aiTestNote").textContent = "";
    open("aiSettings");

    $("aiSave").onclick = function () {
      window.GFAI.cfg.teamCode = $("aiTeam").value.trim();
      window.GFAI.cfg.ownKey = $("aiKey").value.trim();
      window.GFAI.cfg.spendCap = Math.max(0, +$("aiCap").value || 0);
      window.GFAI.save(); refresh();
      $("aiTestNote").textContent = "Saved.";
      window.GF.setStatus("AI settings saved.", "ok");
    };
    $("aiTest").onclick = function () {
      window.GFAI.cfg.teamCode = $("aiTeam").value.trim();
      window.GFAI.cfg.ownKey = $("aiKey").value.trim();
      window.GFAI.save();
      $("aiTestNote").textContent = "Checking…";
      window.GFAI.test().then(function (r) {
        $("aiTestNote").textContent = "Working. You're connected with " +
          (r.mode === "team" ? "your team's account." : "your own account.");
        refresh();
      }).catch(function (e) { $("aiTestNote").textContent = friendly(e); });
    };
    $("aiResetSpend").onclick = function () {
      window.GFAI.resetSpend();
      $("aiSpendNote").textContent = "Today's total reset to zero.";
      refresh();
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-aiclose]"), function (b) {
      b.onclick = function () { close(b.getAttribute("data-aiclose")); };
    });
  }

  /* ------------------------------------------------------------------ refresh */
  function refresh() {
    var chip = $("aiMode"); if (!chip) return;
    var c = window.GFAI.credentials();
    var spent = window.GFAI.spentToday();
    if (c.mode === "none") { chip.textContent = "Free mode"; chip.className = "ai-chip"; }
    else {
      chip.textContent = (c.mode === "team" ? "Team account" : "Your account") + (spent ? " · " + window.GFAI.money(spent) + " today" : "");
      chip.className = "ai-chip on";
    }
    var n = $("aiDiscloseNote");
    if (n) {
      n.textContent = window.GFAI.cfg.disclose !== false
        ? "On: any photo AI changes gets a small label burned into it, and your original is kept. Recommended — and required in California for altered listing images."
        : "Off: nothing is labelled. Only do this for photos that will never be used to market the property.";
    }
    var d = $("aiDisclose"); if (d) d.checked = window.GFAI.cfg.disclose !== false;
  }

  // The music panel spends money too, and it should ask the same way this one
  // does — one confirmation dialog, one behaviour for the user to learn.
  window.GFAsk = ask;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
