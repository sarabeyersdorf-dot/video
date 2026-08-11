/* ============================================================================
   Goldframe — the music panel
   ----------------------------------------------------------------------------
   Sits under the existing Music card, because that is where someone looking for
   music will look. Three things and no more:

     browse   the shipped pack and your own tracks, filtered by mood, with a
              preview button and one click to drop it into this video
     make     describe a track, get it in about ten seconds for about a penny
     build    generate the whole forty-track starter pack once

   Preview plays through a plain audio element rather than the editor's mixer,
   so auditioning music never disturbs the video you are working on.
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var mine = [], filter = "All", playing = null, playingId = null, busy = false;

  var css = document.createElement("style");
  css.textContent = [
    ".mus-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:9px;margin-bottom:7px;background:var(--bg-2)}",
    ".mus-row.on{border-color:var(--accent)}",
    ".mus-play{flex:none;width:30px;height:30px;border-radius:50%;border:1px solid var(--line-2);background:transparent;color:var(--ink);cursor:pointer;font-size:11px;line-height:1}",
    ".mus-play:hover{border-color:var(--accent);color:var(--accent)}",
    ".mus-meta{flex:1;min-width:0}",
    ".mus-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".mus-sub{font-size:11px;color:var(--faint);font-family:var(--mono)}",
    ".mus-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 12px}",
    ".mus-tab{font-size:12px;padding:5px 11px;border-radius:999px;border:1px solid var(--line-2);background:transparent;color:var(--muted);cursor:pointer}",
    ".mus-tab.on{border-color:var(--accent);color:var(--accent)}",
    ".mus-empty{font-size:12.5px;color:var(--faint);padding:10px 0}",
    ".mus-list{max-height:330px;overflow:auto;padding-right:2px}"
  ].join("\n");
  document.head.appendChild(css);

  function build() {
    var controls = document.querySelector(".controls");
    if (!controls) return;
    // Find the editor's own Music card and sit directly under it.
    var host = null;
    Array.prototype.forEach.call(controls.querySelectorAll("section.card > h2"), function (h) {
      if (/^music$/i.test((h.textContent || "").trim())) host = h.parentNode;
    });

    var card = document.createElement("section");
    card.className = "card";
    card.id = "musCard";
    card.innerHTML = [
      '<div class="ai-head">',
      '  <h2 style="margin:0">Music library &#127925;</h2>',
      '  <span class="ai-chip" id="musCount">empty</span>',
      '</div>',
      '<p class="desc">Tracks made for Goldframe, so there is no credit line to add and nobody who can take them away. Pick one, or describe what you want and have it written.</p>',
      '<div class="mus-tabs" id="musTabs"></div>',
      '<div class="mus-list" id="musList"></div>',

      '<div class="ai-group">',
      '  <h3>Make a track for this listing</h3>',
      '  <label class="field full">Describe it',
      '    <input type="text" id="musPrompt" placeholder="warm acoustic guitar, unhurried, family home">',
      '  </label>',
      '  <div class="ai-btns" style="margin-top:10px">',
      '    <select id="musCat" style="max-width:130px"></select>',
      '    <select id="musSecs" style="max-width:130px"><option value="30">30 seconds</option><option value="60" selected>60 seconds</option><option value="90">90 seconds</option><option value="120">2 minutes</option></select>',
      '    <button class="btn primary" id="musMake">&#10024; Write it <span class="tag paid">PAID</span></button>',
      '  </div>',
      '  <p class="ai-note">About a penny for a minute of music. It lands in your library and in this video.</p>',
      '</div>',

      '<div class="ai-group">',
      '  <h3>Build the starter pack</h3>',
      '  <p class="desc">Forty instrumental tracks &mdash; eight each of Luxury, Warm, Modern, Upbeat and Ambient. One time, then you have a library.</p>',
      '  <div class="ai-btns">',
      '    <button class="btn" id="musPack">&#9835; Build all forty <span class="tag paid">PAID</span></button>',
      '    <button class="btn ghost" id="musStop" style="display:none">Stop</button>',
      '    <button class="btn ghost" id="musExport" style="font-size:12px">&#8595; Download pack</button>',
      '  </div>',
      '  <p class="ai-note">Takes about ten minutes and costs under a dollar on the default model. Already-made tracks are skipped, so you can stop and pick it up later. <b>Download pack</b> saves the tracks plus a licence record &mdash; hand that file to Claude with the repo attached to make it the library your whole team sees.</p>',
      '</div>',
      '<div class="ai-run" id="musRun"></div>'
    ].join("");

    if (host && host.nextSibling) controls.insertBefore(card, host.nextSibling);
    else controls.appendChild(card);

    var cat = $("musCat");
    window.GFMusic.CATEGORIES.forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; cat.appendChild(o);
    });

    tabs();
    wire();
    refresh();
  }

  function tabs() {
    var host = $("musTabs"); host.innerHTML = "";
    ["All"].concat(window.GFMusic.CATEGORIES).forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mus-tab" + (filter === c ? " on" : "");
      b.textContent = c;
      b.onclick = function () { filter = c; tabs(); render(); };
      host.appendChild(b);
    });
  }

  function refresh() {
    return Promise.all([window.GFMusic.list(), window.GFMusic.loadShipped()]).then(function (r) {
      mine = r[0].sort(function (a, b) { return a.name.localeCompare(b.name); });
      window.GFMusic.setShipped(r[1]);
      render();
    });
  }

  function render() {
    var host = $("musList"); if (!host) return;
    var ship = window.GFMusic.shipped();
    var rows = ship.map(function (t) { return { kind: "shipped", t: t }; })
      .concat(mine.map(function (t) { return { kind: "mine", t: t }; }));
    if (filter !== "All") rows = rows.filter(function (r) { return r.t.category === filter; });

    $("musCount").textContent = (ship.length + mine.length)
      ? (ship.length + mine.length) + " track" + (ship.length + mine.length === 1 ? "" : "s")
      : "empty";
    $("musCount").className = "ai-chip" + (rows.length ? " on" : "");

    host.innerHTML = "";
    if (!rows.length) {
      host.innerHTML = '<p class="mus-empty">' + (filter === "All"
        ? "Nothing here yet. Write one below, or build the starter pack."
        : "No " + filter.toLowerCase() + " tracks yet.") + "</p>";
      return;
    }
    rows.forEach(function (r) {
      var id = r.kind + ":" + (r.t.id || r.t.file);
      var d = document.createElement("div");
      d.className = "mus-row" + (playingId === id ? " on" : "");

      var p = document.createElement("button");
      p.className = "mus-play"; p.title = "Preview";
      p.innerHTML = playingId === id ? "&#9632;" : "&#9654;";
      p.onclick = function () { preview(r, id); };
      d.appendChild(p);

      var m = document.createElement("div"); m.className = "mus-meta";
      var n = document.createElement("div"); n.className = "mus-name"; n.textContent = r.t.name;
      var s = document.createElement("div"); s.className = "mus-sub";
      s.textContent = r.t.category + " · " + (r.t.seconds || "?") + "s" + (r.kind === "shipped" ? " · team" : "");
      m.appendChild(n); m.appendChild(s); d.appendChild(m);

      var use = document.createElement("button");
      use.className = "btn ghost"; use.style.fontSize = "12px"; use.textContent = "Use";
      use.onclick = function () { use.disabled = true; useTrack(r).then(function () { use.disabled = false; }); };
      d.appendChild(use);

      if (r.kind === "mine") {
        var x = document.createElement("button");
        x.className = "iconbtn del"; x.textContent = "✕"; x.title = "Remove from your library";
        x.onclick = function () {
          stopPreview();
          window.GFMusic.remove(r.t.id).then(refresh);
        };
        d.appendChild(x);
      }
      host.appendChild(d);
    });
  }

  function blobFor(r) {
    if (r.kind === "mine") return Promise.resolve(r.t.blob);
    return fetch("music/" + r.t.file).then(function (res) {
      if (!res.ok) throw new Error("That track isn't on the server any more.");
      return res.blob();
    });
  }

  function stopPreview() {
    if (playing) { try { playing.pause(); } catch (e) {} try { URL.revokeObjectURL(playing.src); } catch (e) {} }
    playing = null; playingId = null;
  }

  function preview(r, id) {
    if (playingId === id) { stopPreview(); render(); return; }
    stopPreview();
    blobFor(r).then(function (b) {
      var a = new Audio(URL.createObjectURL(b));
      a.onended = function () { stopPreview(); render(); };
      a.play().catch(function () {});
      playing = a; playingId = id; render();
    }).catch(function (e) { say(e.message); });
  }

  function useTrack(r) {
    stopPreview(); render();
    return blobFor(r).then(function (b) {
      return window.GF.setMusicBlob(b, r.t.name);
    }).then(function () {
      window.GF.rebuild(); window.GF.drawAt(window.GF.posterTime()); window.GF.scheduleAutosave();
      window.GF.setStatus("“" + r.t.name + "” added as the music for this video.", "ok");
    }).catch(function (e) {
      window.GF.setStatus(e.message || "Couldn't load that track.", "err");
    });
  }

  function say(m) { var r = $("musRun"); if (r) r.textContent = m || ""; }
  function lock(on) {
    busy = on;
    ["musMake", "musPack", "musExport"].forEach(function (id) { if ($(id)) $(id).disabled = on; });
    if ($("musStop")) $("musStop").style.display = on ? "inline-flex" : "none";
  }

  // Money questions reuse the AI panel's confirmation, so there is one place
  // where spending is explained and one behaviour to remember.
  function paid(title, cost, body, run) {
    if (!window.GFAI.ready()) {
      window.GF.setStatus("Add a team passcode or your own AI key in AI Studio ▸ Settings first.", "err");
      var s = $("aiSettings"); if (s) s.classList.add("open");
      return;
    }
    window.GFAsk(title, cost, body).then(function (yes) { if (yes) run(); });
  }

  function wire() {
    $("musMake").onclick = function () {
      if (busy) return;
      var prompt = ($("musPrompt").value || "").trim();
      if (!prompt) return window.GF.setStatus("Describe the music you'd like first.", "err");
      var secs = +$("musSecs").value || 60;
      var model = window.GFAI.cfg.musicModel || "cassetteai/music-generator";
      paid("Write a " + secs + "-second track", window.GFAI.estimate("music", model, secs),
        "It will be saved to your library and set as the music for this video.",
        function () {
          lock(true);
          window.GFMusic.generate({ prompt: prompt, category: $("musCat").value, seconds: secs, overCap: true }, say)
            .then(function (rec) {
              return refresh().then(function () { return useTrack({ kind: "mine", t: rec }); });
            })
            .then(function () { lock(false); say(""); })
            .catch(function (e) { lock(false); say(""); window.GF.setStatus(friendly(e), "err"); });
        });
    };

    $("musPack").onclick = function () {
      if (busy) return;
      var secs = 60;
      var model = window.GFAI.cfg.musicModel || "cassetteai/music-generator";
      var one = window.GFAI.estimate("music", model, secs);
      window.GFMusic.list().then(function (have) {
        var known = {};
        have.forEach(function (t) { known[t.name] = true; });
        var left = window.GFMusic.STARTER.filter(function (r) { return !known[r[1]]; }).length;
        if (!left) return window.GF.setStatus("The whole starter pack is already in your library.", "ok");
        paid("Build " + left + " track" + (left === 1 ? "" : "s"), one * left,
          "Sixty seconds each, across all five moods. Roughly ten minutes. You can stop at any point and what's finished is kept.",
          function () {
            lock(true);
            window.GFMusic.buildPack({ seconds: secs, model: model }, say, function () { refresh(); })
              .then(function (res) {
                lock(false);
                refresh();
                say("");
                window.GF.setStatus(res.failed.length
                  ? ("Made " + res.made + " tracks. " + res.failed.length + " didn't come back — press Build again to fill the gaps.")
                  : ("Starter pack ready — " + res.made + " tracks in your library."), res.failed.length ? "" : "ok");
              })
              .catch(function (e) { lock(false); say(""); window.GF.setStatus(friendly(e), "err"); });
          });
      });
    };

    $("musStop").onclick = function () { window.GFMusic.cancelPack(); say("Stopping after this one…"); };

    $("musExport").onclick = function () {
      say("Packing…");
      window.GFMusic.exportPack().then(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "goldframe-music-pack.zip";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        say("");
        window.GF.setStatus("Music pack downloaded, with a licence record inside.", "ok");
      }).catch(function (e) { say(""); window.GF.setStatus(e.message, "err"); });
    };
  }

  function friendly(e) {
    var m = (e && e.message) || String(e);
    if (m === "NO_KEY") return "No AI key set up yet — see AI Studio ▸ Settings.";
    if (m === "OVER_CAP") return "That would pass your daily spending limit.";
    if (m === "TEAM_NEEDS_SITE") return "Team keys only work on the Goldframe website.";
    return m;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
