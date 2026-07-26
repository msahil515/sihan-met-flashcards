/* =====================================================================
   CROSS-DEVICE RESULT SYNC  ("sync code")
   =====================================================================
   Every mock attempt on this site lives in localStorage, which means it
   lives on ONE device. This file makes phone / tablet / laptop share one
   combined history.

   How it works
   ------------
   - You set the same short code on every device (see /sync/).
   - The code is hashed (SHA-256 + salt) into an unguessable storage slot
     on a tiny free key-value host. The code itself never leaves the device.
   - On load / on tab switch / every 90s, this script PULLS the remote blob,
     MERGES it into localStorage, then PUSHES the merged result back.

   Merge, not overwrite
   --------------------
   Nothing is ever deleted by a sync. Answers are merged per question,
   snapshots are unioned by timestamp, and only a genuine conflict on the
   SAME question falls back to "the device that wrote it later wins".
   That means an offline attempt on the tablet still survives a sync that
   happened on the phone first.

   Safety rule: if the remote blob can't be read (corrupt / unreadable),
   we ABORT the whole cycle instead of pushing over it. A bad read must
   never destroy the other device's work.

   Fallback: the manual backup code on /results/ still works and needs no
   network. If this host ever dies, local data is untouched.
   ===================================================================== */
(function () {
  if (window.__sihanSyncInit) return;
  window.__sihanSyncInit = true;

  var API = "https://textdb.dev/api/data/";
  var SALT = "sihan-met-sync-v1|";
  var CODE_KEY = "sync-code-v1";
  var META_KEY = "sync-meta-v1";
  var STATE_KEY = "sync-state-v1";
  var DEVICE_KEY = "sync-device-v1";
  var POLL_MS = 90 * 1000;

  /* ---------- tiny helpers ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function readJSON(k, fb) { try { var r = lsGet(k); return r ? JSON.parse(r) : fb; } catch (e) { return fb; } }
  function writeJSON(k, v) { lsSet(k, JSON.stringify(v)); }
  function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function now() { return Date.now(); }

  /* djb2 — cheap change-detector, not a security hash */
  function quickHash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + ":" + s.length;
  }

  /* ---------- which localStorage keys are "my results" ---------- */
  function isSyncKey(k) {
    if (!k) return false;
    if (k === CODE_KEY || k === META_KEY || k === STATE_KEY || k === DEVICE_KEY) return false;
    return /-(results|notes|progress|snapshots)-v\d+$/.test(k)   /* classic quiz pages */
      || /^revamp-preview-.+-v\d+$/.test(k)                      /* take/ engine state */
      || /^take-summary-/.test(k)                                /* take/ per-mock summary */
      || k === "results-history-v1"                              /* snapshot history */
      || k === "results-journal-v1"                              /* per-mock journal */
      || k === "tests-done-v1"                                   /* mark-done on tests/ */
      || /^sihan-.*-checklist-v\d+$/.test(k);                    /* study-plan checklists */
  }
  function syncKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (isSyncKey(k)) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  /* ---------- code + endpoint ---------- */
  var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; /* no 0/O/1/I */
  function normCode(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function prettyCode(c) { c = normCode(c); return c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : c; }
  function getCode() { var c = normCode(lsGet(CODE_KEY)); return c.length >= 6 ? c : null; }
  function setCode(c) {
    c = normCode(c);
    if (c.length < 6) return null;
    lsSet(CODE_KEY, c);
    return c;
  }
  function clearCode() { lsDel(CODE_KEY); lsDel(META_KEY); lsDel(STATE_KEY); }
  function makeCode() {
    var buf = new Uint8Array(8), out = "";
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(buf) : buf.forEach(function (_, i) { buf[i] = Math.floor(Math.random() * 256); });
    for (var i = 0; i < 8; i++) out += ALPHABET[buf[i] % ALPHABET.length];
    return out;
  }

  function hex(buf) {
    var b = new Uint8Array(buf), s = "";
    for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
    return s;
  }
  function endpointFor(code) {
    var data = new TextEncoder().encode(SALT + code);
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle.digest("SHA-256", data).then(function (buf) {
        return "sihanmet-" + hex(buf).slice(0, 24);
      });
    }
    /* insecure context (file://) — deterministic but weaker */
    return Promise.resolve("sihanmet-" + quickHash(SALT + code).replace(/[^a-z0-9]/g, ""));
  }

  /* ---------- device identity (so the UI can say where data came from) ---------- */
  function device() {
    var d = readJSON(DEVICE_KEY, null);
    if (d && d.id) return d;
    var ua = navigator.userAgent || "";
    var name = /iPad/.test(ua) ? "iPad"
      : /iPhone/.test(ua) ? "iPhone"
      : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet")
      : /Macintosh/.test(ua) ? "Mac"
      : /Windows/.test(ua) ? "Windows"
      : "Browser";
    d = { id: makeCode().toLowerCase(), name: name };
    writeJSON(DEVICE_KEY, d);
    return d;
  }

  /* ---------- payload encode / decode (gzip when the browser has it) ---------- */
  function b64FromBuf(buf) {
    var b = new Uint8Array(buf), s = "", CH = 0x8000;
    for (var i = 0; i < b.length; i += CH) s += String.fromCharCode.apply(null, b.subarray(i, i + CH));
    return btoa(s);
  }
  function bufFromB64(s) {
    var bin = atob(s), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  function encodePayload(obj) {
    var json = JSON.stringify(obj);
    if (typeof CompressionStream === "function") {
      try {
        var stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
        return new Response(stream).arrayBuffer().then(function (buf) { return "GZ1:" + b64FromBuf(buf); });
      } catch (e) {}
    }
    return Promise.resolve("RAW:" + json);
  }
  function decodePayload(text) {
    text = String(text == null ? "" : text).trim();
    if (!text) return Promise.resolve(null); /* nothing stored yet — not an error */
    if (text.indexOf("RAW:") === 0) return Promise.resolve(JSON.parse(text.slice(4)));
    if (text.indexOf("GZ1:") === 0) {
      if (typeof DecompressionStream !== "function") {
        return Promise.reject(new Error("This browser can't read compressed sync data"));
      }
      var stream = new Blob([bufFromB64(text.slice(4))]).stream().pipeThrough(new DecompressionStream("gzip"));
      return new Response(stream).text().then(function (json) { return JSON.parse(json); });
    }
    return Promise.resolve(JSON.parse(text)); /* legacy plain JSON */
  }

  /* ---------- merge ----------
     Two rules make this safe to run on two devices at once:
       1. The merge is COMMUTATIVE — phone-merges-tablet and
          tablet-merges-phone produce byte-identical output. Ties are broken
          by a rule both devices compute the same way, never by "mine wins",
          otherwise the two keep overwriting each other forever.
       2. The output is CANONICAL (sorted keys, sorted unions), so a merge
          that changed nothing real also changes no bytes: no pointless
          re-uploads and no "pulled new results" nudge for a no-op. */
  function stableStringify(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
    var keys = Object.keys(v).sort(), parts = [];
    for (var i = 0; i < keys.length; i++) {
      if (v[keys[i]] === undefined) continue;
      parts.push(JSON.stringify(keys[i]) + ":" + stableStringify(v[keys[i]]));
    }
    return "{" + parts.join(",") + "}";
  }
  function canonRaw(raw) {
    if (raw == null) return raw;
    try { return stableStringify(JSON.parse(raw)); } catch (e) { return raw; }
  }
  function sigOf(x) {
    if (x && typeof x === "object") {
      if (x.ts != null && x.mock != null) return "a:" + x.mock + "|" + x.ts;
      if (x.ts != null) return "b:" + x.ts + "|" + (x.score != null ? x.score : "");
      return "j:" + stableStringify(x);
    }
    return "p:" + String(x);
  }
  function unionArray(a, b) {
    var seen = {}, out = [];
    [].concat(a || [], b || []).forEach(function (x) {
      var s = sigOf(x);
      if (!seen[s]) { seen[s] = 1; out.push({ x: x, s: s }); }
    });
    /* sort by timestamp when there is one, then by signature, so both
       devices end up with the same order and the same bytes */
    out.sort(function (p, q) {
      var pt = p.x && p.x.ts ? (new Date(p.x.ts).getTime() || 0) : 0;
      var qt = q.x && q.x.ts ? (new Date(q.x.ts).getTime() || 0) : 0;
      if (pt !== qt) return pt - qt;
      return p.s < q.s ? -1 : p.s > q.s ? 1 : 0;
    });
    return out.map(function (o) { return o.x; });
  }
  /* mode: "remote" | "local" | "tie". A tie must resolve identically on both
     devices, so it prefers a real answer over a blank one and otherwise falls
     back to a plain string comparison. */
  function pickVal(a, b, mode) {
    if (mode === "remote") return b;
    if (mode === "local") return a;
    var aAns = isObj(a) && a.selected != null, bAns = isObj(b) && b.selected != null;
    if (aAns !== bAns) return aAns ? a : b;
    var as = stableStringify(a), bs = stableStringify(b);
    return bs > as ? b : a;
  }
  function mergeObj(l, r, mode) {
    var out = {}, k;
    for (k in l) if (Object.prototype.hasOwnProperty.call(l, k)) out[k] = l[k];
    for (k in r) {
      if (!Object.prototype.hasOwnProperty.call(r, k)) continue;
      if (!(k in out)) { out[k] = r[k]; continue; }
      if (stableStringify(out[k]) === stableStringify(r[k])) continue;
      if (isObj(out[k]) && isObj(r[k])) { out[k] = mergeObj(out[k], r[k], mode); continue; }
      if (Array.isArray(out[k]) && Array.isArray(r[k])) { out[k] = unionArray(out[k], r[k]); continue; }
      out[k] = pickVal(out[k], r[k], mode);
    }
    return out;
  }
  /* take/ engine state: {i, answers, flags, marks, revealed, visited, filter, wrongSet} */
  function mergeTakeState(l, r, mode) {
    var out = mergeObj(l, r, mode);
    ["answers", "flags", "marks", "revealed", "visited"].forEach(function (f) {
      if (isObj(l[f]) || isObj(r[f])) out[f] = mergeObj(l[f] || {}, r[f] || {}, mode);
    });
    return out;
  }
  /* take-summary-*: derived counts — the more-attempted one is the truth */
  function pickSummary(l, r) {
    var la = (l && l.answered) || 0, ra = (r && r.answered) || 0;
    if (ra !== la) return ra > la ? r : l;
    var lt = (l && l.ts) || 0, rt = (r && r.ts) || 0;
    if (rt !== lt) return rt > lt ? r : l;
    return pickVal(l, r, "tie");
  }
  function mergeValue(key, lRaw, rRaw, lT, rT) {
    if (lRaw == null) return canonRaw(rRaw);
    if (rRaw == null) return canonRaw(lRaw);
    var mode = rT > lT ? "remote" : (lT > rT ? "local" : "tie");
    var l, r;
    try { l = JSON.parse(lRaw); r = JSON.parse(rRaw); }
    catch (e) { return pickVal(lRaw, rRaw, mode); }
    var merged;
    if (Array.isArray(l) && Array.isArray(r)) merged = unionArray(l, r);
    else if (/^take-summary-/.test(key)) merged = pickSummary(l, r);
    else if (/^revamp-preview-/.test(key)) merged = mergeTakeState(l, r, mode);
    else if (isObj(l) && isObj(r)) merged = mergeObj(l, r, mode);
    else merged = pickVal(l, r, mode);
    return stableStringify(merged);
  }

  /* ---------- local change clock ----------
     meta[key] = {h: hash, t: ms}. t only moves when the VALUE actually
     changed on this device, so it is a real "last edited here" stamp.

     First run on a device is special: attempts already sitting in this
     browser are of UNKNOWN age, so they get t=0 ("old"). A conflict on the
     same question then resolves in favour of the side that carries a real
     stamp, instead of a week-old answer masquerading as brand new. Every
     answer written after that gets a true timestamp and wins normally.
     Nothing is lost either way — different questions always union. */
  function stampLocal() {
    var initialized = lsGet(META_KEY) != null;
    var meta = readJSON(META_KEY, {}), changed = false;
    syncKeys().forEach(function (k) {
      var raw = lsGet(k);
      if (raw == null) return;
      var h = quickHash(raw);
      if (!meta[k]) { meta[k] = { h: h, t: initialized ? now() : 0 }; changed = true; }
      else if (meta[k].h !== h) { meta[k] = { h: h, t: now() }; changed = true; }
    });
    if (!initialized || changed) writeJSON(META_KEY, meta);
    return meta;
  }

  /* ---------- status ---------- */
  function status() { return readJSON(STATE_KEY, { state: "idle" }); }
  function setStatus(s) {
    s.at = new Date().toISOString();
    writeJSON(STATE_KEY, s);
    try { window.dispatchEvent(new CustomEvent("sihan-sync", { detail: s })); } catch (e) {}
    return s;
  }

  /* ---------- the cycle ---------- */
  var running = null;
  function syncNow(reason) {
    if (running) return running;
    var code = getCode();
    if (!code) return Promise.resolve(setStatus({ state: "off", msg: "No sync code set on this device" }));
    if (!navigator.onLine) return Promise.resolve(setStatus({ state: "error", msg: "Offline — will retry" }));

    running = endpointFor(code).then(function (ep) {
      var meta = stampLocal();
      return fetch(API + ep + "/?t=" + now(), { cache: "no-store" })
        .then(function (res) {
          if (!res.ok) throw new Error("Server said HTTP " + res.status);
          return res.text();
        })
        .then(decodePayload)
        .then(function (remote) {
          var pulled = [], rMeta = (remote && remote.meta) || {}, rStore = (remote && remote.store) || {};

          /* 1. merge remote INTO local */
          Object.keys(rStore).forEach(function (k) {
            if (!isSyncKey(k)) return;
            var lRaw = lsGet(k);
            var lT = (meta[k] && meta[k].t) || 0;
            var rT = rMeta[k] || 0;
            var mergedRaw = mergeValue(k, lRaw, rStore[k], lT, rT);
            if (mergedRaw == null) return;
            /* compare against the CANONICAL local value: a pure key-order
               difference is not new results and must not raise the nudge */
            var reallyNew = mergedRaw !== canonRaw(lRaw);
            if (mergedRaw !== lRaw && lsSet(k, mergedRaw)) {
              if (reallyNew) pulled.push(k);
              meta[k] = { h: quickHash(mergedRaw), t: Math.max(lT, rT) };
            } else if (!meta[k]) {
              meta[k] = { h: quickHash(mergedRaw), t: Math.max(lT, rT) };
            }
          });
          writeJSON(META_KEY, meta);

          /* 2. build the merged blob and push it back (canonical, so two
             devices that agree upload byte-identical blobs) */
          var store = {}, outMeta = {}, keys = syncKeys();
          keys.forEach(function (k) {
            var raw = canonRaw(lsGet(k));
            if (raw == null) return;
            store[k] = raw;
            outMeta[k] = meta[k] ? meta[k].t : 0;
          });
          var dev = device();
          var devices = (remote && remote.devices) || {};
          devices[dev.id] = { name: dev.name, ts: new Date().toISOString() };

          return encodePayload({ v: 1, updated: new Date().toISOString(), devices: devices, meta: outMeta, store: store })
            .then(function (body) {
              return fetch(API + ep + "/", {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: body
              }).then(function (res) {
                if (!res.ok) throw new Error("Push failed, HTTP " + res.status);
                return { pulled: pulled, pushed: keys.length, bytes: body.length, devices: devices };
              });
            });
        })
        .then(function (r) {
          if (r.pulled.length) notifyPulled(r.pulled.length);
          return setStatus({
            state: "ok", msg: "Synced", reason: reason || "",
            pulled: r.pulled.length, pushed: r.pushed, bytes: r.bytes, devices: r.devices
          });
        });
    }).catch(function (err) {
      return setStatus({ state: "error", msg: (err && err.message) || "Sync failed", reason: reason || "" });
    }).then(function (s) {
      running = null;
      return s;
    });

    return running;
  }

  /* ---------- "new results arrived" nudge ---------- */
  function notifyPulled(n) {
    /* pages that render from localStorage already listen for "storage" */
    try { window.dispatchEvent(new Event("storage")); } catch (e) {}
    if (!document.body || document.getElementById("syncToast")) return;
    var t = document.createElement("div");
    t.id = "syncToast";
    t.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:2147483000;max-width:calc(100vw - 28px);" +
      "background:rgba(18,24,33,.94);color:#e6edf3;border:1px solid rgba(255,255,255,.14);border-radius:10px;" +
      "padding:10px 12px;font:500 13px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.45);" +
      "display:flex;align-items:center;gap:10px";
    t.innerHTML = '<span>Pulled ' + n + ' item' + (n === 1 ? '' : 's') + ' from your other device</span>' +
      '<button type="button" style="background:#1f6feb;color:#fff;border:0;border-radius:6px;padding:6px 10px;font:600 12px system-ui;cursor:pointer">Refresh</button>' +
      '<button type="button" style="background:none;color:#8b949e;border:0;font:600 16px system-ui;cursor:pointer;padding:0 4px">&times;</button>';
    var btns = t.querySelectorAll("button");
    btns[0].onclick = function () { location.reload(); };
    btns[1].onclick = function () { t.remove(); };
    document.body.appendChild(t);
    setTimeout(function () { if (t.isConnected) t.remove(); }, 12000);
  }

  /* ---------- triggers ---------- */
  var lastPush = 0;
  function maybeSync(reason) {
    if (!getCode()) return;
    if (now() - lastPush < 4000) return;
    lastPush = now();
    syncNow(reason);
  }
  function boot() {
    if (!getCode()) return;
    setTimeout(function () { maybeSync("load"); }, 800);
    setInterval(function () { if (!document.hidden) maybeSync("poll"); }, POLL_MS);
    document.addEventListener("visibilitychange", function () {
      maybeSync(document.hidden ? "hide" : "show");
    });
    window.addEventListener("pagehide", function () { maybeSync("leave"); });
    window.addEventListener("online", function () { maybeSync("online"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ---------- public API (used by /sync/) ---------- */
  window.SihanSync = {
    getCode: getCode,
    setCode: setCode,
    clearCode: clearCode,
    makeCode: makeCode,
    prettyCode: prettyCode,
    normCode: normCode,
    syncNow: syncNow,
    status: status,
    keys: syncKeys,
    device: device,
    isSyncKey: isSyncKey
  };
})();
