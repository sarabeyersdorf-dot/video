/* ============================================================================
   Goldframe AI proxy
   ----------------------------------------------------------------------------
   Sixty seconds of background for whoever reads this next:

   A web page cannot safely hold a key that spends money. Anyone can open the
   page source and take it. So the key lives here instead — on Netlify's servers,
   in an environment variable that never reaches the browser.

   This file does three small things and nothing else:
     1. Decides whose key to use.
        - "x-gf-team: <passcode>"  -> use Sara's key (GF_FAL_KEY). This is how
                                      the team works: they type a passcode once,
                                      never a key.
        - "x-gf-key: <fal key>"    -> a visitor brought their own key. We pass it
                                      straight through and never write it down,
                                      so their spending is their own.
     2. Forwards the request to fal.ai and hands back the answer.
     3. Refuses anything that is not a fal model on the allow-list, so this can
        never be turned into an open relay for someone else's traffic.

   SET UP (one time, in Netlify -> Site settings -> Environment variables)
     GF_FAL_KEY    your fal.ai API key            (required for team mode)
     GF_TEAM_CODE  a passcode you give your team  (required for team mode)
     GF_ALLOW_BYOK "true" to let the public use their own keys (default true)
     GF_ORIGIN     your site's address, e.g. https://goldframe.netlify.app
                   (optional; stops OTHER WEBSITES using your key from a
                   visitor's browser. It is a browser rule, so it does not stop
                   someone calling this directly with the passcode — make the
                   passcode long and random, not a word.)

   If you set none of these the app still runs — every free, on-device feature
   works, and the paid buttons explain what's missing.
   ========================================================================== */

const FAL_QUEUE = "https://queue.fal.run/";

// Only these model families may be called. Adding a model to the app's catalog
// means adding its prefix here too — that is deliberate friction.
const ALLOWED = [
  "fal-ai/",
  "wan/",
  "bytedance/",
  "luma/",
  "xai/",
  "alibaba/"
];

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(), ...extra }
  });

function cors() {
  const origin = process.env.GF_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, x-gf-team, x-gf-key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store"
  };
}

// Compare two secrets without leaking anything through how long it takes.
// Hashing first means even the LENGTH of the passcode isn't revealed by an
// early return, which a plain length check would give away.
import { createHash, timingSafeEqual } from "node:crypto";
function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Guessing the passcode should be slow and noisy, not free. Netlify keeps a warm
// instance between requests, so this catches a run of attempts from one address.
// It is a speed bump, not a wall — the real defence is a long random passcode.
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 12;
function tooManyTries(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) { attempts.delete(ip); return false; }
  return rec.n >= MAX_FAILURES;
}
function noteFailure(ip) {
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.first > WINDOW_MS) attempts.set(ip, { n: 1, first: Date.now() });
  else rec.n++;
  if (attempts.size > 5000) attempts.clear();   // never let this grow unbounded
}
function clientIp(req) {
  return (req.headers.get("x-nf-client-connection-ip") ||
          (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
          "unknown");
}

function resolveKey(req) {
  const team = req.headers.get("x-gf-team");
  const own = req.headers.get("x-gf-key");

  if (team) {
    const ip = clientIp(req);
    if (tooManyTries(ip)) {
      return { error: "Too many wrong passcodes. Wait ten minutes and try again.", status: 429 };
    }
    const code = process.env.GF_TEAM_CODE;
    const key = process.env.GF_FAL_KEY;
    // One answer whether team mode is unconfigured or the passcode is simply
    // wrong. Two different answers would tell a stranger which sites are worth
    // guessing at — the same leak the bare ping response closes.
    if (!code || !key || !sameSecret(team, code)) {
      noteFailure(ip);
      return {
        error: "That team passcode isn't right. If your site hasn't been set up for team access yet, add GF_FAL_KEY and GF_TEAM_CODE in Netlify — or use your own key instead.",
        status: 403
      };
    }
    return { key, mode: "team" };
  }

  if (own) {
    if (process.env.GF_ALLOW_BYOK === "false") {
      return { error: "This site only allows team access. Ask for the team passcode.", status: 403 };
    }
    return { key: own, mode: "own" };
  }

  return { error: "No key. Open AI settings and add a team passcode or your own key.", status: 401 };
}

// A model name becomes part of a URL, so it is checked against the URL the
// browser's own parser will actually produce — not against the raw string.
// Checking the raw string alone is not enough: "fal-ai/%2e%2e/%2e%2e/other/x"
// contains no literal "..", yet URL parsing collapses it to "/other/x" and the
// allow-list is bypassed.
function checkModel(model) {
  if (typeof model !== "string" || !model || model.length > 200) return "That model name doesn't look right.";
  if (/[?#%\s\\]/.test(model) || model.includes("..") || model.startsWith("/")) return "That model name isn't allowed.";
  if (!ALLOWED.some((p) => model.startsWith(p))) return `Goldframe won't call "${model}" — it isn't on the allow-list.`;
  let path;
  try { path = new URL(FAL_QUEUE + model).pathname.replace(/^\//, ""); }
  catch { return "That model name isn't allowed."; }
  if (path !== model || !ALLOWED.some((p) => path.startsWith(p))) return "That model name isn't allowed.";
  return null;
}

async function fal(url, key, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json", ...(init.headers || {}) }
  });
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  return { ok: r.ok, status: r.status, body };
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  const url = new URL(req.url);

  // Presence probe. No key needed — the app only needs to learn that there is a
  // server here at all. It deliberately says nothing about whether team mode is
  // configured: that would tell a stranger there is a passcode worth guessing.
  if (req.method === "GET" && url.searchParams.get("ping")) {
    return json({ ok: true });
  }

  const auth = resolveKey(req);
  if (auth.error) return json({ error: auth.error }, auth.status);

  // "Does my key work?" — costs nothing.
  if (req.method === "GET" && url.searchParams.get("check")) {
    const r = await fal("https://rest.alpha.fal.ai/tokens/", auth.key, {
      method: "POST",
      body: JSON.stringify({ allowed_apps: ["fal-ai/flux"], token_expiration: 60 })
    });
    if (r.status === 401 || r.status === 403) return json({ error: "That key was refused by fal." }, 403);
    return json({ ok: true, mode: auth.mode });
  }

  // Poll an in-flight job.
  if (req.method === "GET") {
    const model = url.searchParams.get("model");
    const id = url.searchParams.get("id");
    const bad = checkModel(model);
    if (bad) return json({ error: bad }, 400);
    if (!id || !/^[\w-]{6,80}$/.test(id)) return json({ error: "Missing or malformed job id." }, 400);

    const st = await fal(`${FAL_QUEUE}${model}/requests/${id}/status`, auth.key);
    if (!st.ok) return json({ error: st.body?.detail || st.body?.error || `fal returned ${st.status}` }, st.status);

    if (st.body.status !== "COMPLETED") return json(st.body);

    const res = await fal(`${FAL_QUEUE}${model}/requests/${id}`, auth.key);
    if (!res.ok) return json({ error: res.body?.detail || `fal returned ${res.status}` }, res.status);
    return json({ status: "COMPLETED", done: true, result: res.body });
  }

  // Start a job.
  if (req.method === "POST") {
    let payload;
    try { payload = await req.json(); } catch { return json({ error: "Malformed request." }, 400); }

    const bad = checkModel(payload?.model);
    if (bad) return json({ error: bad }, 400);
    if (!payload.input || typeof payload.input !== "object") return json({ error: "Missing input." }, 400);

    const r = await fal(`${FAL_QUEUE}${payload.model}`, auth.key, {
      method: "POST",
      body: JSON.stringify(payload.input)
    });
    if (!r.ok) return json({ error: r.body?.detail || r.body?.error || `fal returned ${r.status}` }, r.status);
    return json(r.body);
  }

  return json({ error: "Method not allowed." }, 405);
};
