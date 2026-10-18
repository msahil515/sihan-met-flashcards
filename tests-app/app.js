/* Tests app: every mock on the site, grouped by college, played game-style.
   Data comes straight from ../take/data-*.js (same files take/screen.html uses),
   so the app and the site never drift. Untimed, +1 / -0.25 everywhere. */
(function () {
  "use strict";
  var P = window.PREVIEW_MOCKS || {}, DEEP = window.PREVIEW_DEEP || {}, SRCS = window.PREVIEW_SRC || {};
  var REG = {}; (window.MOCKS || []).forEach(function (m) { REG[m.id] = m; });
  var GROUPS = (window.GROUPS || []).map(function (g) {
    return { id: g.id, title: g.title, sub: g.sub, archived: !!g.archived, members: g.members.filter(function (id) { return P[id]; }) };
  }).filter(function (g) { return g.members.length; });
  var L = ["a", "b", "c", "d"];
  var DAILY_GOAL = 20;
  var app = document.getElementById("app");

  /* ---------- storage ---------- */
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var meta = Object.assign({ xp: 0, days: {}, best: {}, last: null, sound: true, haptic: true, bestCombo: 0 }, load("tapp-meta-v1") || {});
  function saveMeta() { store("tapp-meta-v1", meta); }
  function runKey(id) { return "tapp-run-" + id + "-v1"; }
  function getRun(id) { return Object.assign({ i: 0, ans: {}, mode: "practice", done: false, redo: null, xp: 0 }, load(runKey(id)) || {}); }
  function saveRun(id, r) { store(runKey(id), r); }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function dayKey(off) { var d = new Date(); d.setDate(d.getDate() - off); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function streak() {
    var n = 0, off = meta.days[today()] ? 0 : 1;
    while (meta.days[dayKey(off + n)]) n++;
    return n;
  }
  function level() { return 1 + Math.floor(Math.sqrt(meta.xp / 60)); }
  var TITLES = ["Fresher", "Aspirant", "Trainee", "Intern", "Resident", "Senior Resident", "Fellow", "Consultant", "Topper"];
  function title() { return TITLES[Math.min(TITLES.length - 1, Math.floor((level() - 1) / 2))]; }
  function title_of(id) { return (REG[id] && REG[id].title) || P[id].fullTitle || P[id].title || id; }
  function score(id, r) {
    var Q = P[id].questions, right = 0, wrong = 0;
    for (var k in r.ans) { if (!Q[+k]) continue; if (r.ans[k] === Q[+k].correct) right++; else wrong++; }
    var N = Q.length;
    return { N: N, right: right, wrong: wrong, skipped: N - right - wrong, marks: right - 0.25 * wrong, answered: right + wrong };
  }
  function starsFor(pct) { return pct >= 90 ? 3 : pct >= 75 ? 2 : pct >= 60 ? 1 : 0; }
  function starHTML(n) { var h = ""; for (var i = 0; i < 3; i++) h += '<span class="' + (i < n ? "on" : "") + '">★</span>'; return h; }
  function fmt(x) { return (Math.round(x * 100) / 100).toString(); }
  function toast(t) {
    var el = document.createElement("div"); el.className = "toast"; el.textContent = t;
    document.getElementById("toasts").appendChild(el); setTimeout(function () { el.remove(); }, 2200);
  }
  function buzz(p) {
    if (!meta.haptic) return;
    try { if (window.NLNative) NLNative.vibrate(p.join(",")); else if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
  }
  var actx = null;
  function tone(freqs) {
    if (!meta.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.09;
        o.type = "triangle"; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.start(t); o.stop(t + 0.2);
      });
    } catch (e) {}
  }
  function floater(t) {
    var el = document.createElement("div"); el.className = "floater"; el.textContent = t;
    app.appendChild(el); setTimeout(function () { el.remove(); }, 1000);
  }
  function copyText(t) {
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("Copied"); } catch (e) { toast("Copy failed"); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast("Copied"); }, fallback);
    else fallback();
  }


  /* ---------- live starfield + confetti (neon game skin) ---------- */
  var CALM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FX = (function () {
    var sky = document.getElementById("sky"), fxc = document.getElementById("fx");
    var sx = sky.getContext("2d"), fx = fxc.getContext("2d"), W = 0, H = 0, DPR = Math.min(2, window.devicePixelRatio || 1);
    var stars = [], bits = [], warp = 0, shoot = null, fxOn = false;
    var HUES = ["#22e5ff", "#ff3df2", "#a78bfa", "#ffd23f", "#39ff88", "#ffffff"];
    function size() {
      W = window.innerWidth; H = window.innerHeight;
      [sky, fxc].forEach(function (c) { c.width = W * DPR; c.height = H * DPR; c.getContext("2d").setTransform(DPR, 0, 0, DPR, 0, 0); });
      var n = Math.round(Math.min(220, W * H / 3200));
      stars = [];
      for (var i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 1.7, t: Math.random() * 6.3, c: Math.random() < 0.18 ? HUES[i % 3] : "#fff" });
    }
    function drawSky(dt) {
      sx.clearRect(0, 0, W, H);
      var sp = (0.012 + warp * 0.5) * dt;
      warp = Math.max(0, warp - dt * 0.0012);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.y += sp * s.z; s.t += dt * 0.002 * s.z;
        if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
        var a = 0.35 + 0.65 * Math.abs(Math.sin(s.t)), r = s.z * 0.8;
        sx.globalAlpha = a; sx.fillStyle = s.c;
        if (warp > 0.05) { sx.fillRect(s.x - r / 2, s.y - warp * 18 * s.z, r, warp * 18 * s.z + r); }
        else { sx.beginPath(); sx.arc(s.x, s.y, r, 0, 6.283); sx.fill(); }
      }
      if (!shoot && Math.random() < dt / 7000) shoot = { x: Math.random() * W * 0.8, y: Math.random() * H * 0.4, l: 0 };
      if (shoot) {
        shoot.l += dt * 0.9;
        var g = sx.createLinearGradient(shoot.x + shoot.l - 90, shoot.y + (shoot.l - 90) * 0.45, shoot.x + shoot.l, shoot.y + shoot.l * 0.45);
        g.addColorStop(0, "rgba(34,229,255,0)"); g.addColorStop(1, "rgba(255,255,255,.95)");
        sx.globalAlpha = 1; sx.strokeStyle = g; sx.lineWidth = 2; sx.beginPath();
        sx.moveTo(shoot.x + shoot.l - 90, shoot.y + (shoot.l - 90) * 0.45); sx.lineTo(shoot.x + shoot.l, shoot.y + shoot.l * 0.45); sx.stroke();
        if (shoot.l > W) shoot = null;
      }
      sx.globalAlpha = 1;
    }
    function drawFx(dt) {
      fx.clearRect(0, 0, W, H);
      for (var i = bits.length - 1; i >= 0; i--) {
        var b = bits[i];
        b.vy += 0.0009 * dt; b.vx *= 0.995; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt; b.life -= dt;
        if (b.life <= 0 || b.y > H + 20) { bits.splice(i, 1); continue; }
        fx.save(); fx.globalAlpha = Math.min(1, b.life / 400); fx.translate(b.x, b.y); fx.rotate(b.r);
        fx.fillStyle = b.c; fx.shadowColor = b.c; fx.shadowBlur = 8;
        fx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)) + 1); fx.restore();
      }
      if (!bits.length) { fx.clearRect(0, 0, W, H); fxOn = false; }
    }
    var last = 0;
    function frame(t) {
      var dt = Math.min(50, t - (last || t)); last = t;
      if (!document.hidden) { drawSky(dt); if (fxOn) drawFx(dt); }
      requestAnimationFrame(frame);
    }
    size(); window.addEventListener("resize", size);
    if (CALM) drawSky(0); else requestAnimationFrame(frame);
    function confetti(n, x, y) {
      if (CALM) return;
      x = x == null ? W / 2 : x; y = y == null ? H * 0.35 : y;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, v = 0.25 + Math.random() * 0.75;
        bits.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.55, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02,
          w: 5 + Math.random() * 6, h: 8 + Math.random() * 8, c: HUES[i % HUES.length], life: 1600 + Math.random() * 1200 });
      }
      fxOn = true;
    }
    return { confetti: confetti, boost: function (k) { warp = Math.min(1.4, warp + (k || 1)); } };
  })();
  function flash(kind) {
    var el = document.createElement("div"); el.className = "flash " + kind;
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 520);
  }
  function banner(big, small) {
    var el = document.createElement("div"); el.className = "banner"; el.innerHTML = big + (small ? "<small>" + small + "</small>" : "");
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 1350);
  }
  function levelUp() {
    var el = document.createElement("div"); el.className = "lvup";
    el.innerHTML = '<div class="lv-card"><div class="lv-k">LEVEL UP</div><div class="lv-n">' + level() + '</div><div class="lv-t">' + title() + '</div><div class="lv-s">tap to keep going</div></div>';
    el.onclick = function () { el.remove(); };
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2600);
    FX.confetti(140); FX.boost(1.2); buzz([30, 50, 30, 50, 80]);
  }

  /* ---------- explanation renderer (ported from take/screen.html) ---------- */
  var STOP_LEAD = /^(The|This|That|These|Those|Option|Options|Both|When|Because|While|Although|However|Since|Rather|Unlike|Its|Their|His|Her|Your|If|In|At|As|On|By|For|Not|Equal|Each|Every|Here|There|Latin|Greek|Thus|Hence)\b/;
  function boldFig(seg) {
    if (!seg || /[<>]/.test(seg)) return seg;
    seg = seg.replace(/\b([A-Z][a-z]{2,}(?:'|’)s)\b/g, "<strong>$1</strong>");
    return seg.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g, function (m) { return STOP_LEAD.test(m) ? m : "<strong>" + m + "</strong>"; });
  }
  function findFigure(text) {
    if (!text) return null;
    var m = String(text).match(/\b([A-Z][a-z]{2,})(?:'|’)s\b/);
    if (m && !/^(This|That|These|Those|Option|Both|Here|There|Latin|Greek|Its|Their|Each|Every|Thus|Hence)$/.test(m[1])) return m[1];
    m = String(text).match(/\b(?:by|after|per|from|of)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
    if (m && !STOP_LEAD.test(m[1])) return m[1];
    return null;
  }
  function paras(text) {
    if (!text) return [];
    var parts = String(text).replace(/([.!?])\s+(?=[A-Z(<"'‘“])/g, "$1␟").split("␟"), out = [];
    for (var i = 0; i < parts.length; i += 2) out.push(parts.slice(i, i + 2).join(" ").trim());
    return out.filter(Boolean);
  }
  function answerBlock(q, figSource) {
    var fig = findFigure(figSource);
    return '<div class="exp-answer"><span class="ak">' + q.correct.toUpperCase() + '</span><span class="abody"><span class="alabel">Correct answer</span>' +
      '<span class="atext">' + (q.options[q.correct] || "") + "</span></span>" +
      (fig ? '<span class="exp-fig">Key figure: <strong>' + fig + "</strong></span>" : "") + "</div>";
  }
  function pblock(arr) { return arr.map(function (p) { return "<p>" + boldFig(p) + "</p>"; }).join(""); }
  function explainHTML(id, q, idx) {
    var d = DEEP[id] && DEEP[id][idx];
    var ok = d && !(d.q && q.q && d.q.trim() !== q.q.trim()) && d.concept;
    var h = '<div class="exp">';
    if (ok) {
      h += answerBlock(q, d.concept);
      var def = d.concept, why = "", cut = d.concept.search(/[.!?]\s+Options?\s+[a-d]\b/);
      if (cut > 40) { def = d.concept.slice(0, cut + 1).trim(); why = d.concept.slice(cut + 1).trim(); }
      h += '<div class="exp-sec"><div class="exp-h">The concept</div>' + pblock(paras(def)) + "</div>";
      if (why) h += '<div class="exp-sec"><div class="exp-h">Why ' + q.correct.toUpperCase() + " is right</div>" + pblock(paras(why)) + "</div>";
      var traps = d.traps || {};
      var wrong = L.filter(function (k) { return q.options[k] && k !== q.correct && traps[k]; });
      if (wrong.length) {
        h += '<div class="exp-sec"><div class="exp-h">Why the other options are wrong</div><div class="exp-traps">' + wrong.map(function (k) {
          return '<div class="exp-trap"><span class="tk">' + k + '</span><span class="tb"><span class="to">' + q.options[k] +
            '</span><p class="tw"><span class="tflag">The trap</span>' + boldFig(traps[k]) + "</p></span></div>";
        }).join("") + "</div></div>";
      }
    } else {
      h += answerBlock(q, q.explanation || "");
      var body = paras(q.explanation || "");
      if (body.length) h += '<div class="exp-sec"><div class="exp-h">Why ' + q.correct.toUpperCase() + " is right</div>" + pblock(body) + "</div>";
    }
    return h + "</div>";
  }
  var normStem = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  function srcOf(id, q) { var m = SRCS[id]; return m ? (m[normStem(q.q)] || null) : null; }

  /* ---------- navigation ---------- */
  var cur = { s: "home", id: null };
  function go(s, id) { if (window.Speak && Speak.stop) Speak.stop(); cur = { s: s, id: id || cur.id }; render(); }
  function render() {
    ({ home: home, lobby: lobby, play: play, finish: finish, review: review })[cur.s]();
  }
  window.nlBack = function () {
    var sh = app.querySelector(".sheet");
    if (sh) { closeSheet(); return true; }
    var up = { lobby: "home", play: "lobby", finish: "lobby", review: "finish" }[cur.s];
    if (!up) return false;
    go(up); return true;
  };
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-go]");
    if (b) go(b.getAttribute("data-go"), b.getAttribute("data-id"));
  });

  function hud() {
    var lv = level(), lo = 60 * Math.pow(lv - 1, 2), hi = 60 * Math.pow(lv, 2), pct = Math.round(100 * (meta.xp - lo) / (hi - lo));
    var s = streak();
    return '<div class="hud"><div class="crest">' + lv + '</div><div class="hud-mid"><div class="hud-t">' + title() + " · " + meta.xp + " XP</div>" +
      '<div class="xpbar"><i style="width:' + pct + '%"></i><span>' + (hi - meta.xp) + " XP to level " + (lv + 1) + "</span></div></div>" +
      '<div class="streak' + (s ? " lit" : "") + '"><span class="fl">🔥</span>' + s + "</div></div>";
  }

  /* ---------- home ---------- */
  function mockCard(id) {
    var r = getRun(id), sc = score(id, r), best = meta.best[id], pct = Math.round(100 * sc.answered / sc.N);
    var st = best != null ? starsFor(best) : 0;
    var status = r.done ? "Finished · " + fmt(sc.marks) + " / " + sc.N : sc.answered ? pct + "% done · " + sc.right + " right" : "Not started";
    return '<button class="mock' + (r.done ? " done" : "") + '" data-go="lobby" data-id="' + id + '"><span class="mi">' + sc.N + '</span><span class="mb"><span class="mt">' +
      esc(title_of(id)) + '</span><span class="ms">' + status + (best != null ? " · best " + best + "%" : "") + '</span><span class="mbar"><i style="width:' + pct +
      '%"></i></span></span><span class="stars">' + starHTML(st) + "</span></button>";
  }
  function groupHTML(g) {
    return '<h2 class="sh">' + esc(g.title) + '</h2><p class="gsub">' + esc(g.sub) + "</p>" + g.members.map(mockCard).join("");
  }
  function home() {
    var done = meta.days[today()] || 0, frac = Math.min(1, done / DAILY_GOAL), C = 2 * Math.PI * 26;
    var open = GROUPS.filter(function (g) { return !g.archived; }), closed = GROUPS.filter(function (g) { return g.archived; });
    var nQ = 0, nM = 0; GROUPS.forEach(function (g) { g.members.forEach(function (id) { nM++; nQ += P[id].questions.length; }); });
    var last = meta.last && P[meta.last] ? meta.last : null;
    var h = '<div class="screen">' + hud() + '<div class="scroll">' +
      '<div class="hero">MOCK <span>ARENA</span></div><div class="hero-s">' + nM + " missions · pick one, rack up XP</div>" +
      '<div class="today"><div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7"/>' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="' + (frac >= 1 ? "#39ff88" : "#22e5ff") + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + C +
      '" stroke-dashoffset="' + C * (1 - frac) + '"/></svg><b>' + done + "</b></div>" +
      '<div class="today-t"><h3>' + (frac >= 1 ? "Daily goal done" : "Daily goal: " + DAILY_GOAL + " questions") + "</h3><p>" +
      (frac >= 1 ? "Streak safe for today. Keep the combo going." : (DAILY_GOAL - done) + " to go today") + "</p></div></div>" +
      (last ? '<div class="cont"><button class="btn" data-go="play" data-id="' + last + '">Continue: ' + esc(title_of(last)) + "</button></div>" : "") +
      open.map(groupHTML).join("") +
      (closed.length ? '<details class="closed"><summary>Closed cycles (still playable)<small>' + closed.map(function (g) { return g.title; }).join(", ") +
        "</small></summary>" + closed.map(groupHTML).join("") + "</details>" : "") +
      '<div class="toggles"><button class="tg' + (meta.sound ? " on" : "") + '" id="tgS">Sound ' + (meta.sound ? "on" : "off") + '</button><button class="tg' +
      (meta.haptic ? " on" : "") + '" id="tgH">Vibration ' + (meta.haptic ? "on" : "off") + "</button></div>" +
      '<div class="foot">' + nM + " mocks · " + nQ.toLocaleString() + " questions · untimed · +1 / −0.25</div></div></div>";
    app.innerHTML = h;
    document.getElementById("tgS").onclick = function () { meta.sound = !meta.sound; saveMeta(); home(); };
    document.getElementById("tgH").onclick = function () { meta.haptic = !meta.haptic; saveMeta(); home(); };
  }

  /* ---------- lobby ---------- */
  function lobby() {
    var id = cur.id, M = P[id], R = REG[id] || {}, r = getRun(id), sc = score(id, r);
    var wrongN = sc.wrong;
    var h = '<div class="screen"><div class="ptop"><button class="xbtn" data-go="home">‹</button><div style="flex:1"></div></div><div class="scroll">' +
      '<h1 class="lob-h">' + esc(title_of(id)) + '</h1><p class="lob-s">' + esc(R.sub || M.sub || "") + "</p>" +
      (R.blurb ? '<div class="blurb clip" id="blurb">' + esc(R.blurb) + "</div>" : "") +
      '<div class="stats"><div class="stat"><b>' + sc.answered + "/" + sc.N + '</b><span>Answered</span></div><div class="stat"><b>' + fmt(sc.marks) +
      '</b><span>Score</span></div><div class="stat"><b>' + (meta.best[id] != null ? meta.best[id] + "%" : "–") + "</b><span>Best</span></div></div>" +
      '<div class="seg"><button data-m="practice" class="' + (r.mode === "practice" ? "on" : "") + '">Practice</button><button data-m="full" class="' +
      (r.mode === "full" ? "on" : "") + '">Full run</button></div><p class="hint">' +
      (r.mode === "practice" ? "Answer shows instantly with the full explanation. Combos and XP on every right answer." :
        "Answers stay hidden till you finish, like the real paper. Change answers freely, then review everything at the end.") + "</p>" +
      '<button class="btn" id="bPlay">' + (r.done ? "Play again" : sc.answered ? "Continue (Q" + (r.i + 1) + ")" : "Start") + "</button>" +
      (r.done || sc.answered ? '<button class="btn ghost" data-go="' + (r.done ? "finish" : "review") + '" data-id="' + id + '">' + (r.done ? "Last result" : "Review answers") + "</button>" : "") +
      (wrongN ? '<button class="btn bad" id="bRedo">Redo the ' + wrongN + " wrong</button>" : "") +
      (sc.answered ? '<button class="btn ghost" id="bReset">Reset this mock</button>' : "") + "</div></div>";
    app.innerHTML = h;
    var bl = document.getElementById("blurb"); if (bl) bl.onclick = function () { bl.classList.toggle("clip"); };
    app.querySelectorAll(".seg button").forEach(function (b) {
      b.onclick = function () { r.mode = b.getAttribute("data-m"); saveRun(id, r); lobby(); };
    });
    document.getElementById("bPlay").onclick = function () {
      if (r.done) { r = { i: 0, ans: {}, mode: r.mode, done: false, redo: null, xp: 0 }; saveRun(id, r); }
      go("play", id);
    };
    var bR = document.getElementById("bRedo");
    if (bR) bR.onclick = function () {
      var Q = M.questions, list = [];
      for (var k in r.ans) if (r.ans[k] !== Q[+k].correct) list.push(+k);
      list.sort(function (a, b) { return a - b; });
      list.forEach(function (k) { delete r.ans[k]; });
      r.redo = list; r.i = list[0]; r.done = false; r.mode = "practice"; r.xp = 0; saveRun(id, r);
      go("play", id);
    };
    var bX = document.getElementById("bReset");
    if (bX) bX.onclick = function () {
      if (!confirm("Wipe your answers on this mock and start fresh?")) return;
      saveRun(id, { i: 0, ans: {}, mode: r.mode, done: false, redo: null, xp: 0 }); lobby();
    };
  }

  /* ---------- play ---------- */
  var combo = 0;
  function play() {
    var id = cur.id, M = P[id], Q = M.questions, N = Q.length, r = getRun(id);
    meta.last = id; saveMeta();
    if (r.i >= N || r.i < 0) r.i = 0;
    var list = r.redo && r.redo.length ? r.redo : null;
    var pos = list ? Math.max(0, list.indexOf(r.i)) : r.i, len = list ? list.length : N;
    var q = Q[r.i], a = r.ans[r.i], practice = r.mode === "practice", shown = practice && a != null;
    var sec = (M.sectionLabels || {})[q.section], src = srcOf(id, q);
    var opts = L.filter(function (k) { return q.options[k] != null; }).map(function (k) {
      var cls = "opt";
      if (shown) cls += k === q.correct ? " right" : k === a ? " wrong" : " fade";
      else if (a === k) cls += " pick";
      return '<button class="' + cls + '" data-k="' + k + '"><span class="k">' + k + '</span><span class="ot">' + q.options[k] + "</span></button>";
    }).join("");
    var lastStep = pos >= len - 1;
    var nextLbl = a == null ? (lastStep ? "Finish" : "Skip") : lastStep ? "Finish" : "Continue";
    app.innerHTML = '<div class="screen"><div class="ptop"><button class="xbtn" id="pX">✕</button><div class="pbar"><i style="width:' + Math.round(100 * (pos + (a != null ? 1 : 0)) / len) +
      '%"></i></div>' + (practice ? '<div class="combo' + (combo >= 3 ? " hot" : "") + '">🔥 ' + combo + "</div>" : '<div class="score">' + score(id, r).answered + "/" + N + "</div>") + "</div>" +
      '<div class="scroll" id="ps"><div class="qmeta"><span class="chip qn">' + (list ? "Redo " + (pos + 1) + "/" + len + " · " : "") + "Q" + (r.i + 1) + " of " + N + "</span>" +
      (sec ? '<span class="chip">' + esc(sec) + "</span>" : "") + (src ? '<span class="chip src">' + esc(src) + "</span>" : "") +
      (window.Speak && Speak.ok ? '<button class="chip spk" id="spk">🔊 Listen</button>' : "") + "</div>" +
      '<div class="qcard">' + q.q + '</div><div class="opts' + (shown ? " locked" : "") + '" id="opts">' + opts + '</div><div id="after">' + (shown ? afterHTML(id, q, r.i, a) : "") + "</div></div>" +
      '<div class="pfoot"><button class="nav" id="pPrev">‹</button><button class="grid" id="pGrid">☰ ' + (r.i + 1) + '</button><button class="btn' + (shown ? (a === q.correct ? " ok" : " bad") : a != null ? "" : " ghost") +
      '" id="pNext">' + nextLbl + "</button></div></div>";
    saveRun(id, r);

    document.getElementById("pX").onclick = function () { go("lobby", id); };
    document.getElementById("pPrev").onclick = function () { step(-1); };
    document.getElementById("pNext").onclick = function () { step(1); };
    document.getElementById("pGrid").onclick = function () { gridSheet(id); };
    var spk = document.getElementById("spk");
    if (spk) {
      var paint = function () { var on = Speak.speaking() === "q"; spk.classList.toggle("on", on); spk.textContent = on ? "■ Stop" : "🔊 Listen"; };
      spk.onclick = function () { if (Speak.speaking() === "q") Speak.stop(); else Speak.say("Question " + (r.i + 1) + ". " + Speak.text(q.q), "q"); paint(); };
      if (Speak.onstate) Speak.onstate(paint);
    }
    app.querySelectorAll("#opts .opt").forEach(function (b) {
      b.onclick = function () { answer(id, b.getAttribute("data-k")); };
    });

    function step(dir) {
      var rr = getRun(id);
      if (list) {
        var p = list.indexOf(rr.i) + dir;
        if (p < 0) return;
        if (p >= list.length) { finishRun(id); return; }
        rr.i = list[p];
      } else {
        var ni = rr.i + dir;
        if (ni < 0) return;
        if (ni >= N) { finishRun(id); return; }
        rr.i = ni;
      }
      saveRun(id, rr); play();
      document.getElementById("ps").scrollTop = 0;
    }
  }
  function afterHTML(id, q, idx, a) {
    var ok = a === q.correct;
    return '<div class="verdict ' + (ok ? "ok" : "bad") + '">' + (ok ? "✓ Correct" : "✗ Not quite, it's " + q.correct.toUpperCase()) +
      "<small>" + (ok ? "+1" : "−0.25") + "</small></div>" + explainHTML(id, q, idx);
  }
  function answer(id, k) {
    var r = getRun(id), q = P[id].questions[r.i];
    var practice = r.mode === "practice";
    if (practice && r.ans[r.i] != null) return;
    var fresh = r.ans[r.i] == null;
    r.ans[r.i] = k;
    if (fresh) { meta.days[today()] = (meta.days[today()] || 0) + 1; }
    if (!practice) { saveRun(id, r); saveMeta(); buzz([12]); play(); return; }
    var ok = k === q.correct, gain = 0, lvBefore = level();
    if (ok) {
      combo++; gain = 10 + (combo >= 3 ? 5 : 0) + (combo >= 10 ? 5 : 0);
      meta.xp += gain; r.xp = (r.xp || 0) + gain; meta.bestCombo = Math.max(meta.bestCombo || 0, combo);
    } else combo = 0;
    saveRun(id, r); saveMeta();
    play();
    var opts = document.getElementById("opts");
    var hit = opts.querySelector('[data-k="' + k + '"]');
    if (ok) {
      hit.classList.add("pop"); buzz([18]); tone(combo >= 3 ? [660, 880, 1100] : [660, 880]); floater("+" + gain + " XP" + (combo >= 3 ? "  🔥" + combo : ""));
      flash("ok"); FX.boost(0.6);
      var rc = hit.getBoundingClientRect(); FX.confetti(combo >= 3 ? 34 : 18, rc.left + rc.width / 2, rc.top + rc.height / 2);
      if (combo === 3 || combo === 5 || combo % 10 === 0) {
        banner("COMBO x" + combo, combo >= 10 ? "UNSTOPPABLE" : combo >= 5 ? "ON FIRE" : "HEATING UP");
        FX.confetti(combo >= 5 ? 110 : 60); tone([784, 988, 1175, 1568]); buzz([20, 30, 20, 30, 40]);
      }
    }
    else { opts.classList.add("shake"); flash("bad"); buzz([40, 60, 40]); tone([300, 220]); }
    if (level() > lvBefore) setTimeout(function () { levelUp(); tone([523, 659, 784, 1047]); }, 700);
    var ps = document.getElementById("ps"), after = document.getElementById("after");
    setTimeout(function () { ps.scrollTo({ top: Math.max(0, after.offsetTop - 160), behavior: "smooth" }); }, 250);
  }
  function finishRun(id) {
    var r = getRun(id), sc = score(id, r);
    if (r.mode === "full" && !r.done) {
      var Q = P[id].questions, gain = 0;
      for (var k in r.ans) if (r.ans[k] === Q[+k].correct) gain += 10;
      meta.xp += gain; r.xp = gain;
    }
    r.done = true; r.redo = null;
    var pct = Math.max(0, Math.round(100 * sc.marks / sc.N));
    if (meta.best[id] == null || pct > meta.best[id]) meta.best[id] = pct;
    saveRun(id, r); saveMeta(); combo = 0;
    go("finish", id);
    tone([523, 659, 784, 1047]); buzz([20, 40, 20, 40, 60]);
    var st = starsFor(pct);
    FX.confetti(60 + st * 70); FX.boost(1);
    if (st) setTimeout(function () { FX.confetti(st * 60, window.innerWidth * 0.2, window.innerHeight * 0.3); FX.confetti(st * 60, window.innerWidth * 0.8, window.innerHeight * 0.3); }, 450);
  }

  /* ---------- question grid sheet ---------- */
  function closeSheet() { app.querySelectorAll(".sheet,.sheet-bg").forEach(function (n) { n.remove(); }); }
  function gridSheet(id) {
    var r = getRun(id), Q = P[id].questions, practice = r.mode === "practice";
    var cells = Q.map(function (q, i) {
      var a = r.ans[i], c = "gq";
      if (a != null) c += practice ? (a === q.correct ? " r" : " w") : " p";
      if (i === r.i) c += " cur";
      return '<button class="' + c + '" data-i="' + i + '">' + (i + 1) + "</button>";
    }).join("");
    var bg = document.createElement("div"); bg.className = "sheet-bg"; bg.onclick = closeSheet;
    var sh = document.createElement("div"); sh.className = "sheet";
    sh.innerHTML = "<h3>Jump to a question</h3>" + (practice ? '<div class="legend"><span style="color:var(--ok)">■ right</span><span style="color:var(--bad)">■ wrong</span><span>■ not done</span></div>' :
      '<div class="legend"><span style="color:var(--pick)">■ answered</span><span>■ not done</span></div>') + '<div class="gridq">' + cells + "</div>" +
      '<button class="btn gold" style="margin-top:12px" id="gFin">Finish and see score</button>';
    app.appendChild(bg); app.appendChild(sh);
    sh.querySelectorAll(".gq").forEach(function (b) {
      b.onclick = function () { var rr = getRun(id); rr.i = +b.getAttribute("data-i"); rr.redo = null; saveRun(id, rr); closeSheet(); play(); };
    });
    document.getElementById("gFin").onclick = function () { closeSheet(); finishRun(id); };
  }

  /* ---------- finish ---------- */
  function finish() {
    var id = cur.id, M = P[id], Q = M.questions, r = getRun(id), sc = score(id, r);
    var pct = Math.max(0, Math.round(100 * sc.marks / sc.N)), st = starsFor(pct);
    var head = st === 3 ? "Topper run" : st === 2 ? "Strong run" : st === 1 ? "Solid, keep going" : "Building up";
    var secs = {}, labels = M.sectionLabels || {};
    Q.forEach(function (q, i) {
      var s = q.section || "all"; secs[s] = secs[s] || { n: 0, r: 0 }; secs[s].n++;
      if (r.ans[i] === q.correct) secs[s].r++;
    });
    var keys = Object.keys(secs);
    var secHTML = keys.length > 1 ? '<div class="secs">' + keys.map(function (s) {
      var x = secs[s], p = Math.round(100 * x.r / x.n);
      return '<div class="secrow' + (p < 50 ? " weak" : "") + '"><div class="sl"><span>' + esc(labels[s] || s) + "</span><span>" + x.r + "/" + x.n + '</span></div><div class="sb"><i style="width:' + p + '%"></i></div></div>';
    }).join("") + "</div>" : "";
    app.innerHTML = '<div class="screen"><div class="ptop"><button class="xbtn" data-go="home">✕</button><div style="flex:1"></div></div><div class="scroll">' +
      '<div class="fin-stars">' + starHTML(st) + '</div><div class="fin-h">' + head + '</div><div class="fin-s">' + esc(title_of(id)) + "</div>" +
      '<div class="big">' + fmt(sc.marks) + "<small> / " + sc.N + "</small></div>" +
      '<div class="stats"><div class="stat"><b style="color:var(--ok)">' + sc.right + '</b><span>Right</span></div><div class="stat"><b style="color:var(--bad)">' + sc.wrong +
      '</b><span>Wrong</span></div><div class="stat"><b>' + sc.skipped + "</b><span>Skipped</span></div></div>" +
      '<div class="stats" style="grid-template-columns:1fr 1fr"><div class="stat"><b>' + pct + '%</b><span>Score</span></div><div class="stat"><b style="color:var(--gold)">+' + (r.xp || 0) +
      "</b><span>XP earned</span></div></div>" + secHTML +
      '<button class="btn gold" id="fCopy">Copy results</button>' +
      '<button class="btn" data-go="review" data-id="' + id + '">Review every answer</button>' +
      (sc.wrong ? '<button class="btn bad" id="fRedo">Redo the ' + sc.wrong + " wrong</button>" : "") +
      '<button class="btn ghost" data-go="home">Back to all tests</button></div></div>';
    document.getElementById("fCopy").onclick = function () { copyText(resultText(id)); };
    var fr = document.getElementById("fRedo");
    if (fr) fr.onclick = function () {
      var list = [];
      for (var k in r.ans) if (r.ans[k] !== Q[+k].correct) list.push(+k);
      list.sort(function (a, b) { return a - b; });
      list.forEach(function (k) { delete r.ans[k]; });
      r.redo = list; r.i = list[0]; r.done = false; r.mode = "practice"; r.xp = 0; saveRun(id, r);
      go("play", id);
    };
  }
  function strip(s) { var d = document.createElement("div"); d.innerHTML = s; return d.textContent.trim(); }
  function resultText(id) {
    var M = P[id], Q = M.questions, r = getRun(id), sc = score(id, r), labels = M.sectionLabels || {};
    var out = [title_of(id), "Score: " + fmt(sc.marks) + " / " + sc.N + " (+1 / -0.25)", "Right " + sc.right + " · Wrong " + sc.wrong + " · Skipped " + sc.skipped, ""];
    Q.forEach(function (q, i) {
      var a = r.ans[i];
      if (a === q.correct) return;
      out.push("Q" + (i + 1) + (labels[q.section] ? " [" + labels[q.section] + "]" : "") + ": " + strip(q.q));
      out.push("  You: " + (a ? a.toUpperCase() + ") " + strip(q.options[a]) : "skipped") + "  |  Correct: " + q.correct.toUpperCase() + ") " + strip(q.options[q.correct]));
    });
    return out.join("\n");
  }

  /* ---------- review ---------- */
  var rvFilter = "miss";
  function review() {
    var id = cur.id, Q = P[id].questions, r = getRun(id);
    var items = Q.map(function (q, i) { return { q: q, i: i, a: r.ans[i] }; }).filter(function (x) {
      return rvFilter === "all" ? true : rvFilter === "miss" ? x.a !== x.q.correct : x.a === x.q.correct;
    });
    app.innerHTML = '<div class="screen"><div class="ptop"><button class="xbtn" data-go="lobby" data-id="' + id + '">‹</button><div style="flex:1;font-weight:900">Review</div></div><div class="scroll">' +
      '<div class="seg"><button data-f="miss" class="' + (rvFilter === "miss" ? "on" : "") + '">Missed</button><button data-f="right" class="' + (rvFilter === "right" ? "on" : "") +
      '">Right</button><button data-f="all" class="' + (rvFilter === "all" ? "on" : "") + '">All</button></div><p class="hint">' + items.length + " questions. Tap one to open the explanation.</p>" +
      items.map(function (x) {
        var c = x.a == null ? "" : x.a === x.q.correct ? " r" : " w";
        return '<details class="rv' + c + '" data-i="' + x.i + '"><summary><span class="rn">' + (x.i + 1) + '</span><span class="rq">' + x.q.q + "</span></summary>" +
          '<div class="rbody"></div></details>';
      }).join("") + "</div></div>";
    app.querySelectorAll(".seg button").forEach(function (b) { b.onclick = function () { rvFilter = b.getAttribute("data-f"); review(); }; });
    app.querySelectorAll("details.rv").forEach(function (d) {
      d.addEventListener("toggle", function () {
        var body = d.querySelector(".rbody");
        if (!d.open || body.innerHTML) return;
        var i = +d.getAttribute("data-i"), q = Q[i], a = r.ans[i];
        body.innerHTML = '<div class="ryou">' + (a == null ? "You skipped this one" : a === q.correct ? "You got it right" : "You picked <b>" + a.toUpperCase() + ") " + q.options[a] + "</b>") + "</div>" + explainHTML(id, q, i);
      });
    });
  }

  render();
  window.TAPP = { go: go, fx: FX, getRun: getRun, meta: function () { return meta; } };
})();
