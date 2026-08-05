/* ============================================================
   Read-aloud for the MET-prep test engine.

   Browser speech (SpeechSynthesis) only — no network, no keys,
   works offline once Android/Chrome has the voice downloaded.

   Exposes window.Speak:
     Speak.ok                  -> is speech supported here
     Speak.say(text)           -> stop whatever is talking, read this
     Speak.stop()              -> silence
     Speak.speaking()          -> "" | the tag passed to say()
     Speak.say(text, "q")      -> tag it so the UI knows which
                                  button is the live one
     Speak.onstate(fn)         -> called whenever start/stop happens
     Speak.text(html)          -> HTML -> speakable plain text
     Speak.auto()              -> auto-read every question? (bool)
     Speak.rate()              -> current speed multiplier
     Speak.mount("speakMount") -> settings button + panel

   Two things make this behave on Android Chrome:
     1. long text is split into ~170-char chunks, all queued at
        once (a single long utterance gets cut off after ~15s on
        Chrome), and
     2. speech only ever starts from a real tap, or after one.

   Three more make it behave in SAMSUNG INTERNET, which is what he
   actually uses:
     3. the first speak() must run inside the tap's own task. Any
        setTimeout between the tap and speak() loses the gesture and
        Samsung silently refuses. So cancel() (and its 70ms Chrome
        gap) is only used when something is already talking.
     4. its voice list arrives late, sometimes only after the first
        utterance. We poll getVoices() until it fills, and when it
        is still empty we leave lang unset instead of forcing en-IN
        — a language the engine does not have reads as silence.
     5. onend is not reliable there, so a watchdog advances the
        chunk queue when the engine has clearly stopped talking.
   ============================================================ */
(function () {
  "use strict";

  var synth = window.speechSynthesis;
  var OK = !!(synth && window.SpeechSynthesisUtterance);
  var K = "met-speak-v1";
  var SAMSUNG = /SamsungBrowser/i.test(navigator.userAgent || "");

  var prefs = { rate: 1.2, auto: 0, voice: "" };
  try {
    var raw = localStorage.getItem(K);
    if (raw) { var p = JSON.parse(raw); for (var k in prefs) if (p[k] !== undefined) prefs[k] = p[k]; }
  } catch (e) {}
  // Samsung Internet blocks speech that is not started by a tap, so auto-read
  // there would just fail silently. Force it off rather than lie about it.
  if (SAMSUNG) prefs.auto = 0;
  function savePrefs() { try { localStorage.setItem(K, JSON.stringify(prefs)); } catch (e) {} }

  /* ---------- voices ---------- */
  var voices = [];
  function loadVoices() {
    if (!OK) return;
    var all = synth.getVoices() || [];
    voices = all.filter(function (v) { return /^en/i.test(v.lang || ""); });
    if (!voices.length) voices = all;
  }
  function pickVoice() {
    if (!voices.length) loadVoices();
    if (!voices.length) return null;
    var i;
    if (prefs.voice) {
      for (i = 0; i < voices.length; i++) if (voices[i].voiceURI === prefs.voice) return voices[i];
    }
    var order = [/en[-_]IN/i, /en[-_]GB/i, /en[-_]US/i, /^en/i];
    for (var o = 0; o < order.length; o++)
      for (i = 0; i < voices.length; i++) if (order[o].test(voices[i].lang || "")) return voices[i];
    return voices[0];
  }
  /* Chrome fills getVoices() almost at once and fires voiceschanged. Samsung
     Internet does neither reliably: the list can stay empty for a second or
     two, and on some One UI builds it only fills after the first utterance.
     So poll for ~6s from load instead of trusting the event. */
  var voiceTries = 0;
  function warmVoices() {
    if (!OK) return;
    loadVoices();
    if (voices.length) { refreshPanel(); return; }
    if (voiceTries++ > 24) return;
    setTimeout(warmVoices, 250);
  }
  if (OK) {
    loadVoices();
    try { synth.addEventListener("voiceschanged", function () { loadVoices(); refreshPanel(); }); } catch (e) {}
    if (!voices.length) setTimeout(warmVoices, 200);
  }

  /* ---------- HTML -> speakable text ---------- */
  var scratch = null;
  function text(html) {
    if (html == null) return "";
    var s = String(html);
    // block-ish tags become sentence breaks so it doesn't run words together
    s = s.replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, ". ");
    if (!scratch) scratch = document.createElement("div");
    scratch.innerHTML = s;
    var out = scratch.textContent || "";
    out = out.replace(/_{2,}/g, " blank ")        // fill-in-the-blank rules
             .replace(/→/g, " leads to ")     // →
             .replace(/(?:\s*\.){2,}/g, ". ")   // empty tags leave ". ." runs
             .replace(/\s+/g, " ")
             .replace(/^[.\s]+/, "")
             .replace(/[.\s]+$/, ".")
             .trim();
    return out;
  }

  /* ---------- chunking ---------- */
  function chunk(str, max) {
    var words = str.split(" "), out = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (cur && (cur.length + 1 + w.length) > max) { out.push(cur); cur = w; }
      else cur = cur ? cur + " " + w : w;
      if (/[.?!]$/.test(w) && cur.length > max * 0.55) { out.push(cur); cur = ""; }
    }
    if (cur) out.push(cur);
    return out;
  }

  /* ---------- engine ---------- */
  var listeners = [];
  var liveTag = "";      // "" when silent
  var token = 0;         // invalidates callbacks from a cancelled run
  var gestured = false;  // has the user tapped anything yet

  function fire() { listeners.forEach(function (fn) { try { fn(liveTag); } catch (e) {} }); }

  function stop() {
    token++;
    liveTag = "";
    // cancel() on an idle engine is a no-op on Chrome but can wedge Samsung's,
    // so only reach for it when something is actually queued or talking
    if (OK && busy()) { try { synth.cancel(); } catch (e) {} }
    fire();
  }

  function busy() {
    try { return !!(synth.speaking || synth.pending); } catch (e) { return false; }
  }

  /* Speak every chunk of one run. All of them are queued in the SAME task, on
     purpose: the old build chained chunk N+1 off chunk N's onend, which only
     works if the browser keeps user activation alive for the whole page (Chrome
     does). Samsung Internet is stricter, so anything queued from a later timer
     can be refused and the question stops dead after the first ~170 chars.
     Queue them all inside the tap and the engine plays them back to back. */
  function runChunks(parts, mine, retry) {
    if (mine !== token) return;
    if (!parts.length) { liveTag = ""; fire(); return; }
    if (!voices.length) loadVoices();   // Samsung sometimes fills the list only now
    var rate = Math.max(0.5, Math.min(2, prefs.rate));
    var v = pickVoice();

    var settled = false, started = false, waited = 0, wd = 0;
    function finish() {
      if (settled) return;
      settled = true;
      if (wd) clearInterval(wd);
      if (mine === token) { liveTag = ""; fire(); }
    }

    for (var i = 0; i < parts.length; i++) {
      var u = new SpeechSynthesisUtterance(parts[i]);
      // No voice resolved: leave lang alone. Forcing a tag the engine does not
      // ship (en-IN on most Samsung builds) makes it stay silent instead of
      // falling back to the default voice.
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = rate;
      u.pitch = 1;
      u.onstart = function () { started = true; };
      if (i === parts.length - 1) { u.onend = finish; u.onerror = finish; }
      try { synth.speak(u); } catch (e) { finish(); return; }
    }

    /* watchdog: Samsung drops onend often enough that the pills would stay
       stuck on "Stop" forever, so poll the engine as well */
    wd = setInterval(function () {
      if (settled || mine !== token) { clearInterval(wd); return; }
      waited += 150;
      if (busy()) { started = true; return; }
      if (started) { finish(); return; }      // it spoke and stopped, onend never came
      // Never started. On Chrome that means cancel() ate the utterances queued
      // in the same tick, so re-issue once (we queue in the gesture's own task
      // for Samsung's sake, which is exactly when that bug bites).
      if (retry && waited >= 750) {
        settled = true; clearInterval(wd);
        runChunks(parts, mine, false);
      } else if (waited >= 4000) finish();    // give up, reset the UI
    }, 150);
  }

  function say(str, tag) {
    if (!OK) return;
    var body = String(str || "").trim();
    var wasBusy = busy();
    token++;                               // invalidate anything in flight
    liveTag = "";
    if (wasBusy) { try { synth.cancel(); } catch (e) {} }
    if (!body) { fire(); return; }
    gestured = true;
    liveTag = tag || "on";
    var mine = token;
    fire();
    try { if (synth.paused) synth.resume(); } catch (e) {}
    // Always start inside the tap's own task: Samsung Internet only permits
    // speech begun in the gesture, and a setTimeout here loses it. When we did
    // have to cancel first, the watchdog re-issues once for Chrome's sake.
    runChunks(chunk(body, 170), mine, wasBusy);
  }

  /* ---------- settings panel ---------- */
  var RATES = [0.8, 1, 1.2, 1.4, 1.6, 1.8];
  var panel = null, mountBtn = null;

  function chipCss(on) {
    return "flex:1;min-width:0;border:1px solid var(--line,#ddd);border-radius:9px;padding:8px 0;cursor:pointer;" +
      "font:700 12.5px/1 var(--font-ui,system-ui,sans-serif);" +
      "background:" + (on ? "var(--ink,#111)" : "var(--surface,#fff)") + ";color:" + (on ? "var(--surface,#fff)" : "var(--muted,#888)") + ";";
  }

  function buildPanel() {
    var wrap = document.createElement("div");
    wrap.id = "speakPanel";
    wrap.style.cssText = "position:fixed;z-index:211;right:14px;bottom:74px;width:270px;max-width:calc(100vw - 28px);" +
      "background:var(--surface,#fff);color:var(--ink,#111);border:1px solid var(--line,#ddd);border-radius:16px;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.28);padding:14px;display:none;font-family:var(--font-ui,system-ui,sans-serif)";

    var head = '<div style="font:700 11px/1 var(--font-ui,system-ui,sans-serif);letter-spacing:.09em;' +
      'text-transform:uppercase;color:var(--muted,#888);margin-bottom:9px">Read aloud</div>';

    if (!OK) {
      wrap.innerHTML = head + '<div style="font:500 13px/1.5 var(--font-ui,system-ui,sans-serif);color:var(--muted,#888)">' +
        "This browser has no speech engine. Open the site in Chrome on Android and it will work.</div>";
      return wrap;
    }

    var speed = '<div style="font:600 12px/1 var(--font-ui,system-ui,sans-serif);color:var(--muted,#888);margin-bottom:7px">Speed</div>' +
      '<div style="display:flex;gap:5px;margin-bottom:14px">' +
      RATES.map(function (r) {
        return '<button data-rate="' + r + '" style="' + chipCss(Math.abs(prefs.rate - r) < 0.001) + '">' + r + "×</button>";
      }).join("") + "</div>";

    var note = "";
    if (SAMSUNG) {
      note = '<div style="border:1px solid var(--line,#ddd);border-radius:12px;padding:10px 11px;margin-bottom:12px;' +
        'font:500 11.5px/1.45 var(--font-ui,system-ui,sans-serif);color:var(--muted,#888)">' +
        '<b style="color:var(--ink,#111)">Samsung Internet · tap to play</b><br>' +
        "Auto-read is off here. This browser blocks speech that starts on its own, so it would fail silently. " +
        "Tap 🔊 Listen to play, tap again to stop.<br>" +
        "If the voice sounds robotic, open this same page in Chrome once and compare. Samsung ships its own engine " +
        "and on some One UI builds it is noticeably worse." +
        "</div>";
    }

    var auto = SAMSUNG ? "" : '<button id="spkAuto" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;cursor:pointer;' +
      "border:1px solid " + (prefs.auto ? "var(--primary,#088)" : "var(--line,#ddd)") + ";" +
      "background:" + (prefs.auto ? "var(--primary-wash,#eef)" : "transparent") + ';border-radius:12px;padding:10px 11px;margin-bottom:12px">' +
      '<span style="flex:none;width:34px;height:20px;border-radius:99px;position:relative;background:' +
      (prefs.auto ? "var(--primary,#088)" : "var(--line,#ccc)") + '"><i style="position:absolute;top:2px;' +
      (prefs.auto ? "left:16px" : "left:2px") + ';width:16px;height:16px;border-radius:99px;background:#fff"></i></span>' +
      '<span style="min-width:0"><span style="display:block;font:600 13px/1.2 var(--font-ui,system-ui,sans-serif);color:var(--ink,#111)">' +
      "Auto-read every question</span>" +
      '<span style="display:block;font:500 11px/1.35 var(--font-ui,system-ui,sans-serif);color:var(--muted,#888);margin-top:2px">' +
      (prefs.auto ? "Starts talking as each question loads" : "Off — it only reads when you tap") + "</span></span></button>";

    var vsel = "";
    if (voices.length > 1) {
      vsel = '<div style="font:600 12px/1 var(--font-ui,system-ui,sans-serif);color:var(--muted,#888);margin-bottom:6px">Voice</div>' +
        '<select id="spkVoice" style="width:100%;border:1px solid var(--line,#ddd);border-radius:10px;padding:8px 9px;' +
        'background:var(--surface,#fff);color:var(--ink,#111);font:500 12.5px/1.2 var(--font-ui,system-ui,sans-serif)">' +
        '<option value="">Automatic</option>' +
        voices.map(function (v) {
          return '<option value="' + v.voiceURI.replace(/"/g, "&quot;") + '"' + (prefs.voice === v.voiceURI ? " selected" : "") +
            ">" + (v.name || v.voiceURI) + " (" + (v.lang || "") + ")</option>";
        }).join("") + "</select>";
    }

    var test = '<button id="spkTest" style="width:100%;margin-top:12px;border:1px solid var(--line,#ddd);border-radius:10px;' +
      'padding:9px 0;cursor:pointer;background:var(--surface-2,#f2f2f2);color:var(--ink,#111);' +
      'font:600 12.5px/1 var(--font-ui,system-ui,sans-serif)">Test the voice</button>';

    wrap.innerHTML = head + speed + note + auto + vsel + test;
    return wrap;
  }

  function bindPanel() {
    if (!panel) return;
    panel.querySelectorAll("[data-rate]").forEach(function (b) {
      b.onclick = function () { prefs.rate = parseFloat(b.getAttribute("data-rate")); savePrefs(); refreshPanel(); };
    });
    var a = panel.querySelector("#spkAuto");
    if (a) a.onclick = function () { prefs.auto = prefs.auto ? 0 : 1; savePrefs(); refreshPanel(); fire(); };
    var v = panel.querySelector("#spkVoice");
    if (v) v.onchange = function () { prefs.voice = v.value; savePrefs(); };
    var t = panel.querySelector("#spkTest");
    if (t) t.onclick = function () { say("This is how the questions will sound at " + prefs.rate + " times speed.", "test"); };
  }
  function refreshPanel() {
    if (!panel) return;
    var np = buildPanel();
    np.style.display = panel.style.display;
    panel.replaceWith(np);
    panel = np;
    bindPanel();
  }
  function togglePanel() {
    if (!panel) { panel = buildPanel(); document.body.appendChild(panel); bindPanel(); }
    panel.style.display = (panel.style.display === "block") ? "none" : "block";
  }

  function mount(hostId) {
    var host = document.getElementById(hostId || "speakMount");
    if (!host) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.id = "speakSettingsBtn";
    btn.title = "Read-aloud settings: speed, auto-read, voice";
    btn.innerHTML = '🔊 <span style="font-weight:600">Read aloud</span>';
    host.appendChild(btn);
    mountBtn = btn;
    btn.addEventListener("click", function (e) { e.stopPropagation(); gestured = true; togglePanel(); });
    document.addEventListener("click", function (e) {
      if (panel && panel.style.display === "block" && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target))
        panel.style.display = "none";
    });
  }

  /* speech dies with the page anyway, but Chrome can keep talking on a
     back-navigation if we do not cancel explicitly */
  window.addEventListener("pagehide", stop);
  window.addEventListener("beforeunload", stop);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); });
  document.addEventListener("pointerdown", function () { gestured = true; }, true);

  window.Speak = {
    ok: OK,
    say: say,
    stop: stop,
    speaking: function () { return liveTag; },
    onstate: function (fn) { listeners.push(fn); },
    text: text,
    auto: function () { return !!prefs.auto; },
    rate: function () { return prefs.rate; },
    gestured: function () { return gestured; },
    mount: mount
  };
})();
