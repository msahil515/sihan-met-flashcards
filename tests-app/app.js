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
  /* meta can arrive from another device via sync, and it goes into innerHTML: keep the numbers numbers */
  function loadMeta() {
    var m = Object.assign({ xp: 0, days: {}, best: {}, last: null, sound: true, haptic: true, bestCombo: 0, autoAdd: true }, load("tapp-meta-v1") || {});
    m.xp = +m.xp || 0; m.bestCombo = +m.bestCombo || 0;
    ["days", "best"].forEach(function (f) { var o = m[f] && typeof m[f] === "object" ? m[f] : {}; m[f] = {}; for (var k in o) m[f][k] = +o[k] || 0; });
    return m;
  }
  var meta = loadMeta();
  function saveMeta() { store("tapp-meta-v1", meta); }
  function runKey(id) { return "tapp-run-" + id + "-v1"; }
  /* One mode (Sihan, 20 Nov 2026): the answer and explanation show right after each pick. A Full run left
     half-done gets its held-back XP (+10 per right) and files its misses in To study once, then carries on. */
  function getRun(id) {
    var r = Object.assign({ i: 0, ans: {}, mode: "practice", done: false, redo: null, xp: 0 }, load(runKey(id)) || {});
    if (r.mode !== "practice") {
      var Q = P[id].questions, g = 0, miss = [];
      if (!r.done) for (var k in r.ans) { if (!Q[+k] || r.ans[k] == null) continue; if (r.ans[k] === Q[+k].correct) g += 10; else miss.push(+k); }
      meta.xp += g; r.xp = (r.xp || 0) + g; r.mode = "practice";
      saveRun(id, r); saveMeta();
      /* after saving: filing a miss re-renders home, which reads this run again */
      miss.forEach(function (i) { studyWrong(id, i); });
    }
    return r;
  }
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
  /* ---------- procedural sound (Web Audio, no audio files), all behind the Sound toggle ---------- */
  var actx = null, nbuf = null;
  function audio() {
    if (!meta.sound) return null;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); return actx; } catch (e) { return null; }
  }
  function voice(a, type, f0, f1, t, dur, peak, dest) {
    var o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function hiss(a, t, dur, peak, type, freq, q) {
    if (!nbuf) { nbuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.6), a.sampleRate); var d = nbuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = nbuf; f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  function tone(freqs) {
    var a = audio(); if (!a) return;
    try { freqs.forEach(function (f, i) { voice(a, "triangle", f, 0, a.currentTime + i * 0.09, 0.18, 0.18); }); } catch (e) {}
  }
  var SFX = {
    /* metallic mechanical click: option press, prev / next / grid */
    click: function () { var a = audio(); if (!a) return; try { var t = a.currentTime; hiss(a, t, 0.035, 0.3, "bandpass", 3400, 5); voice(a, "square", 2200, 1100, t, 0.03, 0.035); } catch (e) {} },
    /* harmonic chime, a semitone higher for every right answer in the current run */
    chime: function (c) {
      var a = audio(); if (!a) return;
      try {
        var t = a.currentTime, f = 523.25 * Math.pow(2, Math.min(Math.max(c, 1) - 1, 15) / 12);
        [[1, 0.13], [2, 0.05], [3, 0.025]].forEach(function (h) { voice(a, "sine", f * h[0], 0, t, 0.42, h[1]); voice(a, "sine", f * 1.5 * h[0], 0, t + 0.07, 0.5, h[1] * 0.8); });
      } catch (e) {}
    },
    /* heavy metal slam when a wanted star locks in */
    slam: function () {
      var a = audio(); if (!a) return;
      try {
        var t = a.currentTime;
        voice(a, "sine", 140, 42, t, 0.38, 0.5); hiss(a, t, 0.16, 0.35, "lowpass", 1100, 0.7);
        [317, 541, 829, 1173].forEach(function (f, i) { voice(a, "sine", f, 0, t + 0.005, 0.7 - i * 0.1, 0.045); });
      } catch (e) {}
    },
    /* distorted sub-bass thud plus a burst of radio static on a miss */
    thud: function () {
      var a = audio(); if (!a) return;
      try {
        var t = a.currentTime, ws = a.createWaveShaper(), cv = new Float32Array(256);
        for (var i = 0; i < 256; i++) cv[i] = Math.tanh(4 * (i / 128 - 1));
        ws.curve = cv; ws.connect(a.destination);
        voice(a, "sine", 82, 36, t, 0.42, 0.55, ws);
        [0.02, 0.07, 0.12].forEach(function (d) { hiss(a, t + d, 0.035, 0.16, "bandpass", 1900, 1.4); });
      } catch (e) {}
    }
  };
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


  /* ---------- night pursuit world (heist look, Sihan's spec section 1) ----------
     #city: skyline, road and horizon haze, drawn once per resize. #sky, every frame: rain, lane
     dashes, street lamps sweeping past, traffic light trails, speed lines, overdrive embers.
     #fx: spark bursts over the UI. Heat follows the live combo (setHeat): 0 cool night,
     1 police lights (3-7 in a row), 2 overdrive (8+). Cinematic FX Low (this device only,
     tapp-fx-v1): no rain, no glass blur, fewer lights, 30 fps. */
  var CALM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FXQ = load("tapp-fx-v1") === "low" ? "low" : "high";
  document.documentElement.classList.toggle("fx-low", FXQ === "low");
  function heatOf(c) { return c >= 8 ? 2 : c >= 3 ? 1 : 0; }
  var FX = (function () {
    var city = document.getElementById("city"), sky = document.getElementById("sky"), fxc = document.getElementById("fx");
    var cc = city.getContext("2d"), sx = sky.getContext("2d"), fx = fxc.getContext("2d");
    var W = 0, H = 0, VX = 0, VY = 0, DPR = Math.min(2, window.devicePixelRatio || 1);
    var heat = 0, speed = 1, warp = 0, paused = false, dash = 0, emberAt = 0;
    var bits = [], fxOn = false, rain = [], lamps = [], cars = [], lines = [], embers = [];
    var PAL = { gold: ["#FFF3C4", "#FFD25E", "#FFB627", "#FF8A1F", "#FFFFFF"], bad: ["#FF3B5C", "#FF7A8E", "#C9D3E0", "#7E8A9C", "#FF2E4D"] };
    function glow(r, rgb) {
      var c = document.createElement("canvas"); c.width = c.height = r * 2;
      var g = c.getContext("2d"), gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, "rgba(" + rgb + ",1)"); gr.addColorStop(0.2, "rgba(" + rgb + ",.5)"); gr.addColorStop(1, "rgba(" + rgb + ",0)");
      g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
    }
    var LAMP = glow(64, "255,168,70"), HEAD = glow(32, "200,235,255"), TAIL = glow(32, "255,45,70");
    function low() { return FXQ === "low"; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    /* depth z: 0 at the horizon, 1 at the viewer. lateral x: road edges at -1 and +1 */
    function py(z) { return VY + (H * 1.06 - VY) * z * z; }
    function px(x, z) { return VX + x * W * 0.95 * z * z; }
    /* oncoming traffic on the left (headlights, fast), cars we're passing on the right (tail lights, slow) */
    function car(z) { var on = Math.random() < 0.5; return { on: on, x: on ? (Math.random() < 0.5 ? -0.75 : -0.28) : (Math.random() < 0.5 ? 0.28 : 0.75), z: z, v: on ? rnd(0.5, 0.8) : rnd(0.12, 0.25) }; }
    function size() {
      W = window.innerWidth; H = window.innerHeight; VX = W / 2; VY = Math.round(H * 0.3);
      var cd = Math.min(1.5, DPR), sd = low() ? 1 : Math.min(1.5, DPR);
      city.width = W * cd; city.height = H * cd; cc.setTransform(cd, 0, 0, cd, 0, 0);
      sky.width = W * sd; sky.height = H * sd; sx.setTransform(sd, 0, 0, sd, 0, 0);
      fxc.width = W * DPR; fxc.height = H * DPR; fx.setTransform(DPR, 0, 0, DPR, 0, 0);
      drawCity();
      var nr = low() ? 0 : Math.round(Math.min(150, W * H / 8000)), nl = low() ? 4 : 7, nc = low() ? 4 : 10;
      rain = []; lamps = []; cars = []; lines = []; embers = [];
      for (var i = 0; i < nr; i++) rain.push({ x: Math.random() * W, y: Math.random() * H, l: rnd(10, 26), v: rnd(0.7, 1.2) });
      for (var j = 0; j < nl; j++) lamps.push({ z: j / nl * 1.2, side: j % 2 ? 1 : -1 });
      for (var k = 0; k < nc; k++) cars.push(car(rnd(0.05, 1)));
      for (var m = 0; m < 24; m++) lines.push({ a: rnd(0, 6.283), r: rnd(0, Math.max(W, H)) });
      if (CALM) drawSky(0);
    }
    function drawCity() {
      cc.clearRect(0, 0, W, H);
      var hz = cc.createRadialGradient(VX, VY, 0, VX, VY, Math.max(W, H) * 0.7);
      hz.addColorStop(0, "rgba(255,140,60,.26)"); hz.addColorStop(0.22, "rgba(80,110,200,.12)"); hz.addColorStop(1, "rgba(0,0,0,0)");
      cc.fillStyle = hz; cc.fillRect(0, 0, W, H);
      var seed = 11; function sr() { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }
      [[0.55, "#0C1528", 0.09], [1, "#060A14", 0.14]].forEach(function (row) {
        var x = -12, hmax = H * 0.2 * row[0] + 30;
        while (x < W + 12) {
          var bw = 16 + sr() * 48, bh = 18 + sr() * hmax;
          cc.fillStyle = row[1]; cc.fillRect(x, VY - bh, bw + 1, bh + 2);
          for (var wy = VY - bh + 6; wy < VY - 5; wy += 7) for (var wx = x + 4; wx < x + bw - 4; wx += 6) {
            if (sr() < row[2]) { cc.fillStyle = sr() < 0.72 ? "rgba(255,190,110,.6)" : "rgba(120,220,255,.55)"; cc.fillRect(wx, wy, 2, 3); }
          }
          if (sr() < 0.18) { cc.fillStyle = "rgba(255,50,70,.8)"; cc.fillRect(x + bw / 2 - 1, VY - bh - 4, 2, 2); }
          x += bw + sr() * 5;
        }
      });
      cc.fillStyle = "#04070D"; cc.fillRect(0, VY, W, H - VY);
      var rg = cc.createLinearGradient(0, VY, 0, H);
      rg.addColorStop(0, "#111A2C"); rg.addColorStop(0.5, "#0A111E"); rg.addColorStop(1, "#060A12");
      cc.fillStyle = rg; cc.beginPath(); cc.moveTo(VX - 3, VY); cc.lineTo(VX + 3, VY); cc.lineTo(px(1.15, 1), py(1)); cc.lineTo(px(-1.15, 1), py(1)); cc.closePath(); cc.fill();
      cc.lineWidth = 2; cc.strokeStyle = "rgba(255,180,80,.22)";
      [-1, 1].forEach(function (s) { cc.beginPath(); cc.moveTo(VX, VY); cc.lineTo(px(s, 1), py(1)); cc.stroke(); });
      cc.strokeStyle = "rgba(255,196,60,.2)";
      [-0.025, 0.025].forEach(function (s) { cc.beginPath(); cc.moveTo(VX, VY); cc.lineTo(px(s, 1), py(1)); cc.stroke(); });
      var hl = cc.createLinearGradient(0, 0, W, 0);
      hl.addColorStop(0, "rgba(255,150,60,0)"); hl.addColorStop(0.5, "rgba(255,170,80,.55)"); hl.addColorStop(1, "rgba(255,150,60,0)");
      cc.fillStyle = hl; cc.fillRect(0, VY - 1, W, 2);
    }
    function drawSky(dt) {
      var target = [1, 1.8, 2.8][heat] + warp * 2;
      speed += (target - speed) * Math.min(1, dt * 0.003); warp = Math.max(0, warp - dt * 0.0012);
      sx.clearRect(0, 0, W, H);
      sx.globalCompositeOperation = "lighter";
      var i, z, p, s, c;
      for (i = 0; i < lamps.length; i++) {
        c = lamps[i]; c.z += speed * dt * 0.00042; if (c.z > 1.2) c.z -= 1.2;
        z = c.z; p = z * z; s = 6 + 90 * p;
        sx.globalAlpha = Math.min(1, z * 3) * 0.85;
        sx.drawImage(LAMP, px(c.side * 1.35, z) - s, VY - (VY + H * 0.15) * p - s, s * 2, s * 2);
        sx.globalAlpha = Math.min(1, z * 3) * 0.2;
        sx.drawImage(LAMP, px(c.side, z) - s * 0.5, py(z) - s * 0.25, s, s * 3.2);
      }
      dash = (dash + speed * dt * 0.00042) % 1;
      sx.globalAlpha = 1; sx.strokeStyle = "rgba(190,215,255,.32)";
      for (i = 0; i < 14; i++) {
        z = (i / 14 + dash) % 1; var z2 = Math.min(1.1, z + 0.035);
        sx.lineWidth = 1 + 6 * z * z;
        sx.beginPath(); sx.moveTo(px(-0.5, z), py(z)); sx.lineTo(px(-0.5, z2), py(z2)); sx.moveTo(px(0.5, z), py(z)); sx.lineTo(px(0.5, z2), py(z2)); sx.stroke();
      }
      for (i = 0; i < cars.length; i++) {
        c = cars[i]; c.z += c.v * speed * dt * 0.00035; if (c.z > 1.15) cars[i] = c = car(0.01);
        z = c.z; p = z * z; s = 2 + 26 * p;
        var zt = Math.max(0, z - 0.07 - 0.05 * speed), spr = c.on ? HEAD : TAIL;
        sx.globalAlpha = Math.min(1, z * 4);
        sx.strokeStyle = c.on ? "rgba(200,235,255,.22)" : "rgba(255,45,70,.26)"; sx.lineWidth = Math.max(1, s * 0.3);
        sx.beginPath();
        [-0.05, 0.05].forEach(function (o) { sx.moveTo(px(c.x + o, zt), py(zt)); sx.lineTo(px(c.x + o, z), py(z)); });
        sx.stroke();
        sx.drawImage(spr, px(c.x - 0.05, z) - s, py(z) - s, s * 2, s * 2);
        sx.drawImage(spr, px(c.x + 0.05, z) - s, py(z) - s, s * 2, s * 2);
      }
      var nLines = heat ? (heat === 2 ? 22 : 10) + Math.round(warp * 6) : Math.round(warp * 8), maxR = Math.max(W, H) * 1.1;
      if (nLines) {
        sx.globalAlpha = 1; sx.lineWidth = heat === 2 ? 2 : 1.4; sx.strokeStyle = heat === 2 ? "rgba(255,200,90,.24)" : "rgba(210,230,255,.12)";
        sx.beginPath();
        for (i = 0; i < Math.min(nLines, lines.length); i++) {
          c = lines[i]; c.r += dt * (0.5 + 0.45 * speed) * (0.4 + c.r / maxR);
          if (c.r > maxR) { c.r = H * 0.12; c.a = rnd(0, 6.283); }
          if (c.r < H * 0.18) continue;
          var ca = Math.cos(c.a), sa = Math.sin(c.a), len = c.r * 0.22;
          sx.moveTo(VX + ca * c.r, VY + sa * c.r); sx.lineTo(VX + ca * (c.r + len), VY + sa * (c.r + len));
        }
        sx.stroke();
      }
      if (heat === 2 && !low()) {
        emberAt -= dt;
        if (emberAt <= 0) { emberAt = 55; var lf = Math.random() < 0.5; embers.push({ x: lf ? rnd(0, W * 0.2) : rnd(W * 0.8, W), y: H + 4, vx: (lf ? 1 : -1) * rnd(0.6, 2.4), vy: -rnd(7, 12), l: 1 }); }
      }
      if (embers.length) {
        sx.fillStyle = "#FFC24B";
        for (i = embers.length - 1; i >= 0; i--) {
          c = embers[i]; var f = dt / 16.7; c.x += c.vx * f; c.y += c.vy * f; c.vy += 0.16 * f; c.l -= 0.012 * f;
          if (c.l <= 0 || c.y > H + 10) { embers.splice(i, 1); continue; }
          sx.globalAlpha = c.l; sx.fillRect(c.x, c.y, 2.2, 2.2); sx.fillRect(c.x - c.vx, c.y - c.vy, 1.4, 1.4);
        }
      }
      sx.globalCompositeOperation = "source-over";
      if (rain.length) {
        sx.globalAlpha = 1; sx.lineWidth = 1; sx.strokeStyle = "rgba(170,200,235,.2)"; sx.beginPath();
        for (i = 0; i < rain.length; i++) {
          c = rain[i]; c.y += c.v * dt * (1 + 0.25 * speed); c.x -= c.v * dt * 0.12;
          if (c.y > H + 30) { c.y = -30; c.x = Math.random() * (W + 60); }
          sx.moveTo(c.x, c.y); sx.lineTo(c.x + c.l * 0.18, c.y - c.l);
        }
        sx.stroke();
      }
      sx.globalAlpha = 1;
    }
    function drawFx(dt) {
      var f = dt / 16.7;
      fx.clearRect(0, 0, W, H);
      for (var i = bits.length - 1; i >= 0; i--) {
        var b = bits[i];
        b.x += b.vx * f; b.y += b.vy * f; b.vy += 0.22 * f; b.vx *= Math.pow(0.98, f); b.life -= b.fade * f;
        if (b.life <= 0 || b.y > H + 30) { bits.splice(i, 1); continue; }
        fx.globalAlpha = Math.max(0, Math.min(1, b.life)); fx.fillStyle = b.c;
        if (b.shard) {
          fx.save(); fx.translate(b.x, b.y); fx.rotate(b.life * 8); fx.fillRect(-b.r, -b.r * 0.3, b.r * 2, b.r * 0.6); fx.restore();
        } else {
          fx.strokeStyle = b.c; fx.lineWidth = b.r * 0.7; fx.beginPath(); fx.moveTo(b.x, b.y); fx.lineTo(b.x - b.vx * 2.2, b.y - b.vy * 2.2); fx.stroke();
        }
      }
      fx.globalAlpha = 1;
      if (!bits.length) { fx.clearRect(0, 0, W, H); fxOn = false; }
    }
    var last = 0, odd = false;
    function frame(t) {
      requestAnimationFrame(frame);
      if (document.hidden || paused) { last = t; return; }
      if (low() && (odd = !odd)) return;
      var dt = Math.min(50, t - (last || t)); last = t;
      drawSky(dt); if (fxOn) drawFx(dt);
    }
    size(); window.addEventListener("resize", size);
    if (!CALM) requestAnimationFrame(frame);
    /* spark burst from (x, y): gold on a hit, crimson and steel shards on a miss. Same name revenge.js calls */
    function confetti(n, x, y, pal) {
      if (CALM) return;
      x = x == null ? W / 2 : x; y = y == null ? H * 0.35 : y;
      var pc = PAL[pal] || PAL.gold;
      n = Math.min(n, 420 - bits.length);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, v = 3 + Math.random() * (n > 60 ? 10 : 7);
        bits.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 1, fade: 0.016 + Math.random() * 0.01,
          r: 1.6 + Math.random() * 2.6, c: pc[i % pc.length], shard: pal === "bad" ? i % 2 === 0 : i % 5 === 0 });
      }
      fxOn = true;
    }
    return {
      confetti: confetti,
      boost: function (k) { warp = Math.min(1.4, warp + (k || 1)); },
      setHeat: function (h) { if (h === heat && document.body.getAttribute("data-heat") === String(h)) return; heat = h; document.body.setAttribute("data-heat", h); if (CALM) drawSky(0); },
      pause: function (p) { paused = !!p; },
      quality: function (q) { FXQ = q; store("tapp-fx-v1", q); document.documentElement.classList.toggle("fx-low", q === "low"); size(); }
    };
  })();
  /* one-shot screen light: warm at the tapped option on a hit, rose at the edges on a miss */
  function flash(kind, rc) {
    var el = document.createElement("div"); el.className = "flash " + kind;
    if (rc) { el.style.setProperty("--fx", Math.round(rc.left + rc.width / 2) + "px"); el.style.setProperty("--fy", Math.round(rc.top + rc.height / 2) + "px"); }
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 650);
  }
  function banner(big, small) {
    var el = document.createElement("div"); el.className = "banner"; el.innerHTML = big + (small ? "<small>" + small + "</small>" : "");
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 1350);
  }
  var I = {
    flame: '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path fill="url(#g-flame)" d="M12.6 2.2c.6 3.2 4.9 5.3 4.9 10.6a5.6 5.6 0 0 1-11.2.3c0-2.4 1.2-4.1 2.4-5.2.1 2 1 3.2 2.1 3.5-.4-3.3-.3-6.4 1.8-9.2z"/><path fill="#FFF1C2" opacity=".85" d="M12.2 13.4c1.6 1.4 2.6 2.6 2.6 4.2a2.8 2.8 0 0 1-5.6 0c0-1.3.9-2.2 1.6-2.8.1.9.6 1.4 1.1 1.5-.2-1.1-.1-2 .3-2.9z"/></svg>',
    spark: '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path fill="url(#g-star)" d="M12 1.5l2.4 7.9 8 2.6-8 2.6L12 22.5l-2.4-7.9-8-2.6 8-2.6z"/></svg>',
    next: '<svg viewBox="0 0 24 24" class="ico nx" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>',
    wstar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l2.9 6.2 6.7.8-5 4.6 1.4 6.7L12 17.1l-6 3.4 1.4-6.7-5-4.6 6.7-.8z"/></svg>',
    star: function (on) { return '<svg viewBox="0 0 24 24" class="' + (on ? "on" : "off") + '" aria-hidden="true"><path fill="' + (on ? "url(#g-star)" : "rgba(255,240,220,.16)") + '" stroke="' + (on ? "#FFF3C9" : "rgba(255,240,220,.3)") + '" stroke-width="1" d="M12 2.2l2.9 6.2 6.7.8-5 4.6 1.4 6.7L12 17.1l-6 3.4 1.4-6.7-5-4.6 6.7-.8z"/></svg>'; }
  };
  function levelUp() {
    var lv = level(), t = title(), newTitle = Math.floor((lv - 2) / 2) !== Math.floor((lv - 1) / 2);
    var el = document.createElement("div"); el.className = "lvup";
    el.innerHTML = '<div class="bg"></div><div class="rays"></div><div class="inner"><div class="disc"><b>' + lv + "</b></div><h2>Level up</h2>" +
      "<p>Level " + lv + " · " + t + "</p>" + '<div class="chips">' + (newTitle ? '<span class="chip sun">' + I.spark + " New title: " + t + "</span>" : "") +
      '<span class="chip">' + meta.xp.toLocaleString("en-IN") + " XP</span></div>" + '<button class="btn">Keep going ' + I.next + "</button></div>";
    el.onclick = function () { el.remove(); };
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 4200);
    setTimeout(function () { FX.confetti(110, window.innerWidth / 2, window.innerHeight * 0.38); }, 250);
    FX.boost(1.2); buzz([30, 50, 30, 50, 80]);
  }
  function countUp(el, to, ms) {
    var dec = Math.round(to * 100) % 100 ? 2 : 0, end = fmt(to);
    if (CALM || !el) { if (el) el.textContent = end; return; }
    var t0 = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? (to * e).toFixed(dec) : end;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
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
    var parts = String(text).replace(/([.!?])\s+(?=[A-Z(<"'‘“])/g, "$1␟").split("␟"), sents = [], out = [];
    // re-join splits made after an initial or abbreviation (G. Frederic Kuder, B. F. Skinner, e.g.)
    for (var k = 0; k < parts.length; k++) {
      if (sents.length && /(?:^|[\s(])(?:[A-Z]|Dr|Mr|Mrs|Ms|St|Jr|Sr|vs|e\.g|i\.e|cf|al)\.$/.test(sents[sents.length - 1])) sents[sents.length - 1] += " " + parts[k];
      else sents.push(parts[k]);
    }
    for (var i = 0; i < sents.length; i += 2) out.push(sents.slice(i, i + 2).join(" ").trim());
    return out.filter(Boolean);
  }
  function answerBlock(q, figSource) {
    // a question can name its own key figure (q.fig, "" hides the line); otherwise guess from the text
    var fig = q.fig != null ? q.fig : findFigure(figSource);
    return '<div class="exp-answer"><span class="ak">' + q.correct.toUpperCase() + '</span><span class="abody"><span class="alabel">Correct answer</span>' +
      '<span class="atext">' + (q.options[q.correct] || "") + "</span></span>" +
      (fig ? '<span class="exp-fig">Key figure: <strong>' + fig + "</strong></span>" : "") + "</div>";
  }
  function pblock(arr) { return arr.map(function (p) { return "<p>" + boldFig(p) + "</p>"; }).join(""); }
  /* each section folds (open by default); o.noAnswer / o.skipFirst when the debrief card above already shows the answer + first lines */
  function expSec(title, inner) { return '<details class="exp-sec" open><summary class="exp-h">' + title + "</summary>" + inner + "</details>"; }
  function deepOf(id, q, idx) { var d = DEEP[id] && DEEP[id][idx]; return d && !(d.q && q.q && d.q.trim() !== q.q.trim()) && d.concept ? d : null; }
  function conceptSplit(concept) {
    var cut = concept.search(/[.!?]\s+Options?\s+[a-d]\b/);
    return cut > 40 ? [concept.slice(0, cut + 1).trim(), concept.slice(cut + 1).trim()] : [concept, ""];
  }
  function explainHTML(id, q, idx, o) {
    o = o || {};
    var d = deepOf(id, q, idx), LN = window.LEARN;
    var h = '<div class="exp">';
    if (d) {
      if (!o.noAnswer) h += answerBlock(q, d.concept);
      var cs = conceptSplit(d.concept), def = paras(cs[0]).slice(o.skipFirst ? 1 : 0);
      if (def.length) h += expSec("The concept", pblock(def));
      if (cs[1]) h += expSec("Why " + q.correct.toUpperCase() + " is right", pblock(paras(cs[1])));
      var traps = d.traps || {};
      var wrong = L.filter(function (k) { return q.options[k] && k !== q.correct && traps[k]; });
      if (wrong.length) {
        h += expSec("Why the other options are wrong", '<div class="exp-traps">' + wrong.map(function (k) {
          return '<div class="exp-trap"><span class="tk">' + k + '</span><span class="tb"><span class="to">' + q.options[k] +
            '</span><p class="tw"><span class="tflag">The trap</span>' + boldFig(traps[k]) + "</p>" + (LN ? LN.trapTag(id, idx, k) : "") + "</span></div>";
        }).join("") + "</div>");
      }
    } else {
      if (!o.noAnswer) h += answerBlock(q, q.explanation || "");
      var body = paras(q.explanation || "").slice(o.skipFirst ? 1 : 0);
      if (body.length) h += expSec("Why " + q.correct.toUpperCase() + " is right", pblock(body));
    }
    return h + "</div>";
  }
  /* the first lines of the concept, for the debrief card */
  function takeaway(id, q, idx) {
    var d = deepOf(id, q, idx);
    return paras(d ? conceptSplit(d.concept)[0] : q.explanation || "")[0] || "";
  }
  var normStem = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  function srcOf(id, q) { var m = SRCS[id]; return m ? (m[normStem(q.q)] || null) : null; }

  /* ---------- "Study this" (../study.js, the list Name Lock shares) ---------- */
  var SL = window.StudyList, SI = {};
  if (SL && SL.setLabels) SL.setLabels("★ In the Safehouse", "☆ Study this");
  function autoTopic(q) {
    var a = strip(q.options[q.correct] || "");
    if (a && a.split(/\s+/).length <= 6 && !/^(all|none|both|only|neither)\b|above|\ba and b\b|^(true|false)$/i.test(a)) return a;
    var w = strip(q.q).split(/\s+/);
    return w.slice(0, 9).join(" ") + (w.length > 9 ? "…" : "");
  }
  function studyItem(id, q, idx) {
    var sid = "m:" + id + ":" + idx, lab = (P[id].sectionLabels || {})[q.section] || q.section || "";
    SI[sid] = { id: sid, t: q.topic || autoTopic(q), a: SL.areaOf((q.section || "") + " " + lab), f: title_of(id) + " · Q" + (idx + 1), q: strip(q.q), r: sid };
    return SI[sid];
  }
  function studyBtn(id, q, idx) {
    if (!SL) return "";
    return SL.buttonHTML(studyItem(id, q, idx).id);
  }
  function addWrongQuestion(id, q, idx) {
    if (!SL) return;
    SL.addWrong(studyItem(id, q, idx));
  }
  function studyWrong(id, idx) {
    addWrongQuestion(id, P[id].questions[idx], idx);
  }

  /* ---------- navigation ---------- */
  var cur = { s: "home", id: null };
  function go(s, id) { if (window.Speak && Speak.stop) Speak.stop(); if (window.LEARN) LEARN.leave(); cur = { s: s, id: id || cur.id }; render(); }
  function render() {
    document.body.setAttribute("data-s", cur.s);
    if (cur.s !== "play") FX.setHeat(0);
    FX.pause(cur.s === "brief");
    var LN = window.LEARN;
    ({ home: home, lobby: lobby, play: play, finish: finish, review: review, study: LN ? LN.safehouse : study, brief: LN ? LN.brief : study, drill: LN ? LN.drill : study,
      revenge: function () { window.REVENGE.enter(); } })[cur.s]();
  }
  window.nlBack = function () {
    var sh = app.querySelector(".sheet");
    if (sh) { closeSheet(); return true; }
    if (cur.s === "revenge") { if (!window.REVENGE.back()) go("home"); return true; }
    var up = { lobby: "home", play: "lobby", finish: "lobby", review: "finish", study: "home", brief: "study", drill: "study" }[cur.s];
    if (!up) return false;
    go(up); return true;
  };
  app.addEventListener("click", function (e) {
    if (window.LEARN && LEARN.click(e)) return;
    var sb = e.target.closest("[data-study]");
    if (sb && SL) {
      var it = SI[sb.getAttribute("data-study")]; if (!it) return;
      var on = SL.toggle(it); SL.paintButtons(app); buzz([12]);
      toast(on ? "Intel logged → Safehouse: " + it.t : "Taken out of the Safehouse");
      return;
    }
    var b = e.target.closest("[data-go]");
    if (b) go(b.getAttribute("data-go"), b.getAttribute("data-id"));
  });

  function hud() {
    var lv = level(), lo = 60 * Math.pow(lv - 1, 2), hi = 60 * Math.pow(lv, 2), pct = Math.round(100 * (meta.xp - lo) / (hi - lo));
    var s = streak();
    return '<div class="hud"><div class="crest" style="--p:' + pct + '%"><b>' + lv + '</b></div><div class="hud-mid"><div class="hud-t"><b>' + title() + "</b><span>" +
      meta.xp.toLocaleString("en-IN") + ' XP</span></div><div class="xpbar"><i style="width:' + pct + '%"></i></div><div class="xpnote">' + (hi - meta.xp).toLocaleString("en-IN") +
      " XP to level " + (lv + 1) + '</div></div><div class="pill streak' + (s ? " lit" : "") + '" title="Day streak">' + I.flame + "<b>" + s + "</b><small>" + (s === 1 ? "day" : "days") + "</small></div></div>";
  }

  /* ---------- home ---------- */
  var STUB = ["linear-gradient(180deg,#22C6E8,#0A6E96)", "linear-gradient(180deg,#FFB627,#B86E08)", "linear-gradient(180deg,#FF5C7A,#B3132F)",
    "linear-gradient(180deg,#9D8CFF,#5A3FD1)", "linear-gradient(180deg,#2BE4C8,#0B7F6E)"];
  function mockCard(id, c) {
    var r = getRun(id), sc = score(id, r), best = meta.best[id], pct = Math.round(100 * sc.answered / sc.N);
    var st = best != null ? starsFor(best) : 0;
    var status = r.done ? "Finished · " + fmt(sc.marks) + " / " + sc.N : sc.answered ? pct + "% done · " + sc.right + " right" : "Not started";
    return '<button class="mock ticket' + (r.done ? " done" : "") + '" data-go="lobby" data-id="' + id + '"><span class="stub" style="--c:' + c + '">' + sc.N + "<small>Qs</small></span>" +
      '<span class="mb"><span class="mt">' + esc(title_of(id)) + '</span><span class="ms">' + status + '</span><span class="mbar"><i style="width:' + pct + '%"></i></span></span>' +
      '<span class="best">' + (best != null ? best + "%<small>best</small>" : "<small>new</small>") + '<span class="stars">' + starHTML(st) + "</span></span></button>";
  }
  /* Paper picker (Sihan, 21 Nov 2026: "instead of an endless wall of paper list and colleges"): one short row per
     college with done / total, tap it to open its papers. Search and the status filter redraw only #cat, so the
     keyboard stays up; the state lives here, so coming back from a paper finds the same college open. */
  var pick = { q: "", f: "all", open: {}, cl: false, y: 0 };
  function statusOf(id) { var r = getRun(id); return r.done ? "done" : score(id, r).answered ? "prog" : "new"; }
  function matches(g, id) {
    var hay = (g.title + " " + id + " " + title_of(id)).toLowerCase();
    return pick.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function collegeHTML(g, gi, st, auto) {
    var ids = g.members.filter(function (id) { return (pick.f === "all" || st[id] === pick.f) && matches(g, id); });
    if (!ids.length) return "";
    var n = g.members.length, done = 0, prog = 0, c = STUB[gi % STUB.length];
    g.members.forEach(function (id) { if (st[id] === "done") done++; else if (st[id] === "prog") prog++; });
    var open = pick.open[g.id] != null ? pick.open[g.id] : auto, narrowed = ids.length < n;
    return '<section class="college' + (open ? " open" : "") + '"><button class="crow" data-col="' + esc(g.id) + '" aria-expanded="' + open + '" style="--c:' + c + '">' +
      '<span class="cn"><b>' + esc(g.title) + "</b><small>" + (narrowed ? ids.length + " of " + n + " papers" : n + (n === 1 ? " paper" : " papers")) + (prog ? " · " + prog + " in progress" : "") + "</small></span>" +
      '<span class="cdone' + (done === n ? " all" : "") + '"><b>' + done + "</b>/" + n + "<small>done</small></span>" +
      '<span class="chev">›</span><span class="cprog"><i style="width:' + Math.round(100 * done / n) + '%"></i></span></button>' +
      '<div class="cpapers mgrid">' + ids.map(function (id) { return mockCard(id, c); }).join("") + "</div></section>";
  }
  function renderCat(st) {
    var box = document.getElementById("cat"); if (!box) return;
    var filtered = !!pick.q.trim() || pick.f !== "all", hits = 0;
    if (filtered) GROUPS.forEach(function (g) { g.members.forEach(function (id) { if ((pick.f === "all" || st[id] === pick.f) && matches(g, id)) hits++; }); });
    var auto = filtered && hits <= 8;   /* a short result opens straight away; a long one stays as college rows */
    var open = "", closed = "";
    GROUPS.forEach(function (g, gi) { var h = collegeHTML(g, gi, st, auto); if (g.archived) closed += h; else open += h; });
    var names = GROUPS.filter(function (g) { return g.archived; }).map(function (g) { return g.title; }).join(", ");
    box.innerHTML = (open || closed ? open : '<p class="hint">No paper matches. Clear the search or pick All.</p>') +
      (closed ? '<details class="closed"' + (pick.cl || (filtered && !open) ? " open" : "") + "><summary>Closed colleges (still playable)<small>" + esc(names) + "</small></summary>" + closed + "</details>" : "");
    var d = box.querySelector("details.closed"); if (d) d.ontoggle = function () { pick.cl = d.open; };
    box.querySelectorAll(".crow").forEach(function (b) {
      b.onclick = function () {
        var s = b.parentNode, on = !s.classList.contains("open");
        s.classList.toggle("open", on); b.setAttribute("aria-expanded", on); pick.open[b.getAttribute("data-col")] = on; SFX.click();
      };
    });
  }
  /* nearest open exam with a date in its group title, e.g. "St John's Bengaluru (25 Nov)" */
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function nextExam() {
    var now = new Date(), best = null; now.setHours(0, 0, 0, 0);
    GROUPS.forEach(function (g) {
      var m = !g.archived && /\((\d{1,2})\s+([A-Za-z]{3})[a-z]*\)/.exec(g.title), mo = m && MON[m[2].toLowerCase()];
      if (!m || mo == null) return;
      var d = new Date(now.getFullYear(), mo, +m[1]), days = Math.round((d - now) / 864e5);
      if (days < -180) { d.setFullYear(d.getFullYear() + 1); days = Math.round((d - now) / 864e5); }
      if (days < 0 || days > 120 || (best && best.days <= days)) return;
      best = { g: g, days: days, name: g.title.replace(/\s*\(.*?\)\s*/, " ").trim() };
    });
    return best;
  }
  function home() {
    var done = meta.days[today()] || 0, frac = Math.min(1, done / DAILY_GOAL);
    var nQ = 0, nM = 0; GROUPS.forEach(function (g) { g.members.forEach(function (id) { nM++; nQ += P[id].questions.length; }); });
    var ex = nextExam(), st = {}, cnt = { "new": 0, prog: 0, done: 0 }, half = [];
    GROUPS.forEach(function (g) { g.members.forEach(function (id) { var s = st[id] = statusOf(id); cnt[s]++; if (s === "prog") half.push(id); }); });
    half.sort(function (a, b) { return (b === meta.last) - (a === meta.last); });   /* the last one played leads */
    var last = half[0] || null;
    var poster = ex ? '<section class="poster"><div class="kick">Next job</div><h1>' + esc(ex.name) + '<span class="soft">' +
        (ex.days === 0 ? "today" : ex.days === 1 ? "tomorrow" : "in " + ex.days + " days") + "</span></h1><p>" + esc(String(ex.g.sub).split(/\.\s/)[0].replace(/\.$/, "")) + ".</p></section>"
      : '<section class="poster"><h1>Tests<span class="soft">' + nM + " mocks ready</span></h1><p>" + nQ.toLocaleString() + " questions. Untimed, +1 / −0.25.</p></section>";
    var resume;
    if (last) {
      var lr = getRun(last), ls = score(last, lr), lp = Math.round(100 * ls.answered / ls.N);
      resume = '<h2 class="sec">Continue</h2><section class="glass resume"><div class="ring" style="--p:' + lp + '"><b>' + ls.answered + "<small>of " + ls.N + "</small></b></div>" +
        "<div><h3>" + esc(title_of(last)) + "</h3><p>" + (lr.done ? "Finished · " + fmt(ls.marks) + " / " + ls.N : ls.answered ? "Score so far " + fmt(ls.marks) + ", " + ls.right + " right" : "Not started yet") +
        (meta.best[last] != null ? " · best " + meta.best[last] + "%" : "") + "</p></div>" +
        '<button class="btn primary-action" data-go="play" data-id="' + last + '">Continue ' + I.next + "</button></section>" +
        (half.length > 1 ? '<p class="gsub more">Also half done</p><div class="mgrid">' + half.slice(1).map(function (id) { return mockCard(id, STUB[1]); }).join("") + "</div>" : "");
    } else {
      resume = '<section class="glass resume none"><div><h3>Pick a paper</h3><p>' + nM + " mocks, " + nQ.toLocaleString() + ' questions. Every right answer feeds your combo.</p></div><a class="btn primary-action" href="#catalog">Choose a test ' + I.next + "</a></section>";
    }
    var upnext = "";
    if (ex) {
      var exDone = ex.g.members.filter(function (id) { return st[id] === "done"; }).length;
      upnext = '<h2 class="sec">Up next</h2><p class="gsub">' + esc(ex.g.title) + " · " + exDone + "/" + ex.g.members.length + ' done</p><div class="mgrid">' +
        ex.g.members.map(function (id) { return mockCard(id, STUB[0]); }).join("") + "</div>";
    }
    var FL = [["all", "All", nM], ["new", "Not started", cnt["new"]], ["prog", "In progress", cnt.prog], ["done", "Done", cnt.done]];
    var h = '<div class="screen home-screen">' + hud() + '<div class="scroll home-scroll"><div class="home-layout"><aside class="briefing">' + poster + resume + upnext +
      '<div class="today' + (frac >= 1 ? " met" : "") + '"><b>' + (frac >= 1 ? "Daily goal done" : done + " of " + DAILY_GOAL + " today") + "</b>" +
      (meta.bestCombo ? '<span class="chip sun">' + I.spark + " Best combo " + meta.bestCombo + "</span>" : "") +
      '<div class="bar"><i style="width:' + Math.round(100 * frac) + '%"></i></div><p>' + (frac >= 1 ? "Streak safe for today. Keep the combo going." : (DAILY_GOAL - done) + " to go today") + "</p></div>" +
      '<div class="secondary-tools">' + (window.REVENGE ? window.REVENGE.cta() : "") +
      (SL ? '<button class="btn ghost" data-go="study">Safehouse · ' + SL.counts().open + " to study</button>" : "") + '</div></aside><main class="catalog" id="catalog"><h2 class="sec">All colleges</h2>' +
      '<input id="pq" class="pq" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search a college or year" value="' + esc(pick.q) + '">' +
      '<div class="seg fseg" id="pf">' + FL.map(function (f) { return '<button data-f="' + f[0] + '" class="' + (pick.f === f[0] ? "on" : "") + '">' + f[1] + "<small>" + f[2] + "</small></button>"; }).join("") + "</div>" +
      '<div id="cat"></div></main></div>' +
      '<div class="toggles"><button class="tg' + (meta.sound ? " on" : "") + '" id="tgS">Sound ' + (meta.sound ? "on" : "off") + '</button><button class="tg' +
      (meta.haptic ? " on" : "") + '" id="tgH">Vibration ' + (meta.haptic ? "on" : "off") + '</button></div><div class="toggles" style="margin-top:8px"><button class="tg' + (syncCode() ? " on" : "") + '" id="tgY">Sync ' + (syncCode() || "off") + " ›</button>" +
      '<button class="tg' + (meta.autoAdd !== false ? " on" : "") + '" id="tgA">Misses to Safehouse ' + (meta.autoAdd !== false ? "on" : "off") + "</button></div>" +
      '<div class="toggles" style="margin-top:8px"><button class="tg' + (FXQ === "high" ? " on" : "") + '" id="tgF">Cinematic FX: ' + (FXQ === "high" ? "High" : "Low (battery saver)") + "</button></div>" +
      '<div class="foot">' + nM + " mocks · " + nQ.toLocaleString() + " questions · untimed · +1 / −0.25</div></div></div>";
    app.innerHTML = h;
    renderCat(st);
    var pq = document.getElementById("pq");
    pq.oninput = function () { pick.q = pq.value; pick.open = {}; renderCat(st); };
    pq.onkeydown = function (e) { if (e.key === "Enter") pq.blur(); };
    document.getElementById("pf").onclick = function (e) {
      var b = e.target.closest("[data-f]"); if (!b) return;
      pick.f = b.getAttribute("data-f"); pick.open = {}; SFX.click();
      this.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
      renderCat(st);
    };
    var hs = app.querySelector(".home-scroll"); hs.scrollTop = pick.y; hs.onscroll = function () { pick.y = hs.scrollTop; };
    document.getElementById("tgS").onclick = function () { meta.sound = !meta.sound; saveMeta(); home(); };
    document.getElementById("tgH").onclick = function () { meta.haptic = !meta.haptic; saveMeta(); home(); };
    document.getElementById("tgY").onclick = syncSheet;
    document.getElementById("tgF").onclick = function () { FX.quality(FXQ === "high" ? "low" : "high"); home(); toast(FXQ === "high" ? "Cinematic FX on full" : "Battery saver: lighter effects, same look"); };
    document.getElementById("tgA").onclick = function () { meta.autoAdd = meta.autoAdd === false; saveMeta(); home(); toast(meta.autoAdd ? "Every miss goes to the Safehouse" : "Misses stay out unless you tap ☆ Study this"); };
  }

  /* ---------- cross-device sync (../sync.js, same code as /sync/ on the site) ---------- */
  function syncCode() { var Y = window.SihanSync, c = Y && Y.getCode(); return c ? Y.prettyCode(c) : ""; }
  function syncSheet() {
    var Y = window.SihanSync, Q = window.SihanQR; if (!Y) { toast("Sync isn't loaded. Open the app once with internet."); return; }
    closeSheet();
    var c = Y.getCode(), st = Y.status(), when = st.at ? new Date(st.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "", other = Q ? Q.otherApp() : "";
    var bg = document.createElement("div"); bg.className = "sheet-bg"; bg.onclick = closeSheet;
    var sh = document.createElement("div"); sh.className = "sheet"; sh.style.overflowY = "auto";
    sh.innerHTML = "<h3>Sync with my other device</h3><p class=\"hint\" style=\"margin:0 4px 12px\">Same code on your phone and tab = same XP, streak, level, bests and every answer.</p>" +
      (c ? '<p class="hint" style="margin:0 4px 12px">This device is on <b>' + Y.prettyCode(c) + "</b>. " + (st.state === "ok" ? "Last synced " + when + "." : st.state === "error" ? "Last try failed: " + esc(st.msg) + "." : "") + "</p>" +
        (Q ? '<div id="syQr"></div><p class="hint" style="margin:10px 4px 14px;text-align:center">On your other device: Sync › <b>Scan QR</b>, point it here. Done once, linked for good.</p>' : "") +
        (other ? '<button class="btn" id="syOth">Link ' + esc(other) + " on this device too</button>" : "") +
        '<button class="btn" id="syNow">Sync now</button><button class="btn" id="syOff">Turn sync off here</button>'
      : (Q && Q.canScan() ? '<p class="hint" style="margin:0 4px 12px">Already synced on your other device? Open Sync there, it shows a QR. Scan it from here.</p><button class="btn" id="syScan" style="margin-bottom:16px">📷 Scan QR</button>' : "") +
        '<p class="hint" style="margin:0 4px 12px">Or type the code. First device? Make a new one.</p>' +
        '<input id="syIn" maxlength="9" placeholder="ABCD-EFGH" autocapitalize="characters" style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1.5px solid var(--line);background:var(--s1);color:var(--tx);font:800 17px inherit;letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px">' +
        '<button class="btn" id="syOk">Link this device</button><button class="btn" id="syNew">Make a new code</button>');
    app.appendChild(bg); app.appendChild(sh);
    function link(code) {
      if (!Y.setCode(code)) { toast("Code needs 6+ letters"); return; }
      toast("Syncing…");
      Y.syncNow("setup").then(function (s) { Y.start(); home(); syncSheet(); toast(s.state === "ok" ? "Linked. Same code on your other device." : "Sync failed: " + s.msg); });
    }
    if (c) {
      if (Q) Q.render(document.getElementById("syQr"), c);
      if (other) document.getElementById("syOth").onclick = function () { Q.linkOther(c); };
      document.getElementById("syNow").onclick = function () { toast("Syncing…"); Y.syncNow("manual").then(function (s) { toast(s.state === "ok" ? "Synced" : "Sync failed: " + s.msg); closeSheet(); home(); }); };
      document.getElementById("syOff").onclick = function () { Y.clearCode(); closeSheet(); home(); toast("Sync off on this device. Progress stays here."); };
    } else {
      document.getElementById("syOk").onclick = function () { link(document.getElementById("syIn").value); };
      document.getElementById("syNew").onclick = function () { link(Y.makeCode()); };
      var scanB = document.getElementById("syScan");
      if (scanB) scanB.onclick = function () { Q.scan().then(function (code) { if (code) link(code); }, function (e) { toast(e.message); }); };
    }
  }
  /* the other device's progress just landed: reload XP/streak so the next save can't write a stale copy back */
  window.addEventListener("sihan-sync", function (e) {
    if (!e.detail || !e.detail.pulled) return;
    meta = loadMeta();
    var ae = document.activeElement;
    if ((cur.s === "study" || cur.s === "home") && ae && app.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
    if (cur.s === "home" || cur.s === "lobby" || cur.s === "study") render();
  });

  /* ---------- lobby ---------- */
  /* registry subs are shared with the site: drop their old mode notes ("untimed Practice + Full run", "90-minute timer") here */
  function subOf(s) { return String(s || "").split(" · ").filter(function (x) { return !/^untimed\b|\btimer\b|full run/i.test(x); }).join(" · "); }
  function lobby() {
    var id = cur.id, M = P[id], R = REG[id] || {}, r = getRun(id), sc = score(id, r);
    var wrongN = sc.wrong;
    var h = '<div class="screen lobby-screen"><div class="ptop"><button class="xbtn" data-go="home" aria-label="Back to all tests">' + I.back + '</button><div style="flex:1"></div></div><div class="scroll narrow">' +
      '<h1 class="lob-h">' + esc(title_of(id)) + '</h1><p class="lob-s">' + esc(subOf(R.sub || M.sub)) + "</p>" +
      (R.blurb ? '<div class="blurb clip" id="blurb">' + esc(R.blurb) + "</div>" : "") +
      '<section class="glass lob-card"><div class="stats"><div class="stat"><b>' + sc.answered + "/" + sc.N + '</b><span>Answered</span></div><div class="stat"><b>' + fmt(sc.marks) +
      '</b><span>Score</span></div><div class="stat"><b>' + (meta.best[id] != null ? meta.best[id] + "%" : "–") + "</b><span>Best</span></div></div>" +
      '<p class="hint">The answer and full explanation show right after each pick. +1 right, −0.25 wrong. Combos and XP on every right answer.</p>' +
      '<button class="btn" id="bPlay">' + (r.done ? "Play again" : sc.answered ? "Continue (Q" + (r.i + 1) + ")" : "Start") + "</button>" +
      (r.done || sc.answered ? '<button class="btn ghost" data-go="' + (r.done ? "finish" : "review") + '" data-id="' + id + '">' + (r.done ? "Last result" : "Review answers") + "</button>" : "") +
      (wrongN ? '<button class="btn bad" id="bRedo">Redo the ' + wrongN + " wrong</button>" : "") +
      (sc.answered ? '<button class="btn ghost" id="bReset">Reset this mock</button>' : "") + "</section></div></div>";
    app.innerHTML = h;
    var bl = document.getElementById("blurb"); if (bl) bl.onclick = function () { bl.classList.toggle("clip"); };
    document.getElementById("bPlay").onclick = function () {
      if (r.done) { r = { i: 0, ans: {}, mode: "practice", done: false, redo: null, xp: 0, rs: Date.now() }; saveRun(id, r); }
      go("play", id);
    };
    var bR = document.getElementById("bRedo");
    if (bR) bR.onclick = function () {
      var Q = M.questions, list = [];
      for (var k in r.ans) if (r.ans[k] !== Q[+k].correct) list.push(+k);
      list.sort(function (a, b) { return a - b; });
      list.forEach(function (k) { delete r.ans[k]; });
      r.redo = list; r.i = list[0]; r.done = false; r.mode = "practice"; r.xp = 0; r.rs = Date.now(); saveRun(id, r);
      go("play", id);
    };
    var bX = document.getElementById("bReset");
    if (bX) bX.onclick = function () {
      if (!confirm("Wipe your answers on this mock and start fresh?")) return;
      saveRun(id, { i: 0, ans: {}, mode: "practice", done: false, redo: null, xp: 0, rs: Date.now() }); lobby();
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
    var q = Q[r.i], a = r.ans[r.i], shown = a != null;
    var sec = (M.sectionLabels || {})[q.section], src = srcOf(id, q);
    var opts = L.filter(function (k) { return q.options[k] != null; }).map(function (k) {
      var cls = "opt";
      if (shown) cls += k === q.correct ? " right" : k === a ? " wrong" : " fade";
      return '<button class="' + cls + ' has-tag" data-k="' + k + '"><span class="k">' + k + '</span><span class="ot">' + q.options[k] + "</span>" +
        (window.LEARN ? LEARN.otag(id, r.i, k) : "") + "</button>";
    }).join("");
    var lastStep = pos >= len - 1, sc = score(id, r);
    var nextLbl = a == null ? (lastStep ? "Finish" : "Skip · override") : lastStep ? "Finish" : "Continue";
    FX.setHeat(heatOf(combo));
    app.innerHTML = '<div class="screen play-screen"><div class="ptop play-top"><button class="xbtn" id="pX" aria-label="Back to the paper">' + I.close + '</button><div class="pmid"><b>' + esc(title_of(id)) +
      "</b><span>Score " + fmt(sc.marks) + " · " + sc.right + " right · " + sc.wrong + " wrong</span></div>" +
      '<div class="pill xpp" id="xpp">' + I.spark + '<span id="xpn">' + meta.xp.toLocaleString("en-IN") + "</span></div></div>" +
      '<div class="pstrip"><div id="heat">' + wanted(combo) + "</div></div>" +
      '<div class="scroll" id="ps"><div class="qmeta">' +
      (sec ? '<span class="chip">' + esc(sec) + "</span>" : "") + (src ? '<span class="chip src">' + esc(src) + "</span>" : "") +
      (window.Speak && Speak.ok ? '<button class="chip spk" id="spk">🔊 Listen</button>' : "") + studyBtn(id, q, r.i) + "</div>" +
      '<div class="qcard"><div class="tele"><span class="live">Heist: ' + esc(title_of(id)) + "</span><b>" + (list ? "Redo " + (pos + 1) + "/" + len + " // " : "") +
      "Q" + pad2(r.i + 1) + " of " + N + "</b></div>" + q.q + '</div><div class="opts' + (shown ? " locked" : "") + '" id="opts">' + opts + '</div><div id="after">' + (shown ? afterHTML(id, q, r.i, a) : "") + "</div></div>" +
      '<div class="pfoot"><div class="hstrip"><div class="pbar"><i style="width:' + Math.round(100 * (pos + (a != null ? 1 : 0)) / len) + '%"></i></div><span class="pct">' +
      (list ? pos + (a != null ? 1 : 0) + " / " + len + " redone" : sc.answered + " / " + N + " cracked") + "</span></div>" +
      '<button class="nav" id="pPrev" aria-label="Previous question">‹</button><button class="grid" id="pGrid">☰ ' + (r.i + 1) + '</button><button class="btn' + (shown ? (a === q.correct ? " ok" : " bad") : lastStep ? " ghost" : " hazard") +
      '" id="pNext">' + nextLbl + "</button></div></div>";
    saveRun(id, r);

    document.getElementById("pX").onclick = function () { go("lobby", id); };
    document.getElementById("pPrev").onclick = function () { SFX.click(); step(-1); };
    document.getElementById("pNext").onclick = function () { SFX.click(); step(1); };
    document.getElementById("pGrid").onclick = function () { SFX.click(); gridSheet(id); };
    var spk = document.getElementById("spk");
    if (spk) {
      var paint = function () { var on = Speak.speaking() === "q"; spk.classList.toggle("on", on); spk.textContent = on ? "■ Stop" : "🔊 Listen"; };
      spk.onclick = function () { if (Speak.speaking() === "q") Speak.stop(); else Speak.say("Question " + (r.i + 1) + ". " + Speak.text(q.q), "q"); paint(); };
      if (Speak.onstate) Speak.onstate(paint);
    }
    app.querySelectorAll("#opts .opt").forEach(function (b) {
      b.onclick = function (e) { if (e.target.closest(".otag")) return; SFX.click(); answer(id, b.getAttribute("data-k")); };
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
  function pad2(n) { return n < 10 ? "0" + n : String(n); }
  /* 5-star wanted level: a star for every 3 in a row, HEAT MAX at 5 stars (15 in a row, 2x XP).
     broke = stars lit when a miss ended the run (-1: a run under 3); they shatter */
  function stars(c) { return Math.min(5, Math.floor(c / 3)); }
  function wanted(c, broke) {
    var n = broke ? Math.max(0, broke) : stars(c), h = "";
    for (var i = 0; i < 5; i++) h += '<i class="ws' + (i < n ? " on" : "") + '">' + I.wstar + "</i>";
    var lbl = broke ? "Busted · heat lost" : c >= 15 ? "Heat max · 2x XP" : c ? c + " in a row" : "3 in a row = 1 star";
    return '<div class="wanted' + (c >= 15 ? " max" : "") + (broke ? " shatter" : "") + '"><span class="wl">' + lbl + "</span>" +
      '<span class="wstars" role="img" aria-label="Wanted level ' + n + ' of 5">' + h + "</span></div>";
  }
  /* debrief: answer + the first lines + where to read it + note, then the full explanation (folds) */
  function afterHTML(id, q, idx, a) {
    var ok = a === q.correct, tk = takeaway(id, q, idx), LN = window.LEARN, d = deepOf(id, q, idx);
    var nudge = !ok && SL && !SL.has("m:" + id + ":" + idx);
    return '<div class="verdict ' + (ok ? "ok" : "bad") + '">' + (ok ? "✓ Hack successful" : "✗ Busted. It's " + q.correct.toUpperCase()) +
      "<small>" + (ok ? "+1" : "−0.25") + "</small></div>" +
      '<div class="db">' + answerBlock(q, d ? d.concept : q.explanation || "") + (tk ? '<div class="db-take"><span class="db-l">In short</span><p>' + boldFig(tk) + "</p></div>" : "") +
      (LN ? LN.debriefBadge(id, idx) : "") +
      '<div class="db-ac' + (nudge ? " nudge" : "") + '">' + studyBtn(id, q, idx) + (LN ? '<button class="db-b" data-qnote="' + esc(id + "|" + idx) + '">✎ Quick note</button>' : "") + "</div>" +
      (LN ? LN.noteRow(id, idx) : "") + "</div>" + explainHTML(id, q, idx, { noAnswer: 1, skipFirst: !!tk });
  }
  function answer(id, k) {
    var r = getRun(id), q = P[id].questions[r.i];
    if (r.ans[r.i] != null) return;
    r.ans[r.i] = k;
    meta.days[today()] = (meta.days[today()] || 0) + 1;
    if (k !== q.correct && meta.autoAdd !== false) studyWrong(id, r.i);
    var ok = k === q.correct, gain = 0, lvBefore = level(), hadCombo = combo;
    if (ok) {
      combo++; gain = 10 + (combo >= 3 ? 5 : 0) + (combo >= 10 ? 5 : 0);
      if (combo >= 15) gain *= 2; /* HEAT MAX: five stars, double XP */
      meta.xp += gain; r.xp = (r.xp || 0) + gain; meta.bestCombo = Math.max(meta.bestCombo || 0, combo);
    } else combo = 0;
    saveRun(id, r); saveMeta();
    play();
    app.querySelector(".play-screen").classList.add("settled"); /* same question re-drawn: no fade-in, the hit effects carry it */
    var card = app.querySelector("#ps .qcard"), opts = document.getElementById("opts");
    var hit = opts.querySelector('[data-k="' + k + '"]'), rc = hit.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
    /* camera moves go on #app (no entry animation to restart when the class comes off); the card's glitch class
       stays until the next render, since taking it off would replay the card's rise-in */
    function jolt(cls, ms) { if (CALM) return; app.classList.remove("punch", "jolt"); void app.offsetWidth; app.classList.add(cls); setTimeout(function () { app.classList.remove(cls); }, ms); }
    if (ok) {
      jolt("punch", 120); hit.classList.add("pop"); buzz([18]); SFX.chime(combo);
      var lk = document.createElement("span"); lk.className = "lockon"; lk.textContent = "Target locked"; hit.appendChild(lk);
      var gn = document.createElement("span"); gn.className = "gain"; gn.textContent = "+" + gain + " XP"; hit.appendChild(gn);
      var xpn = document.getElementById("xpn"), xpp = document.getElementById("xpp");
      if (xpn) {
        xpn.textContent = (meta.xp - gain).toLocaleString("en-IN");
        setTimeout(function () { xpn.textContent = meta.xp.toLocaleString("en-IN"); xpp.classList.remove("bump"); void xpp.offsetWidth; xpp.classList.add("bump"); }, 480);
      }
      flash("ok", rc); FX.boost(0.6);
      FX.confetti(combo >= 3 ? 44 : 30, cx, cy, "gold");
      if (combo % 3 === 0 && combo <= 15) {
        var st = stars(combo), ws = app.querySelectorAll("#heat .ws")[st - 1];
        if (ws) ws.classList.add("slam");
        setTimeout(function () { SFX.slam(); }, 120); buzz([20, 30, 20, 30, 40]);
        banner(st === 5 ? "HEAT MAX" : "★ " + st + (st > 1 ? " STARS" : " STAR"), st === 5 ? "OVERDRIVE · 2x XP" : "WANTED LEVEL UP");
        FX.confetti(st === 5 ? 140 : 50, null, null, "gold"); if (st === 5) FX.boost(1.4);
      } else if (combo > 15 && combo % 10 === 0) {
        banner("HEAT MAX x" + combo, "UNSTOPPABLE"); FX.confetti(110, null, null, "gold"); setTimeout(function () { SFX.slam(); }, 120);
      }
    }
    else {
      jolt("jolt", 260); if (!CALM) card.classList.add("glitch"); hit.classList.add("shake");
      flash("bad", rc); buzz([40, 60, 40]); SFX.thud();
      FX.confetti(24, cx, cy, "bad");
      var ht = document.getElementById("heat"); if (ht && hadCombo) ht.innerHTML = wanted(0, stars(hadCombo) || -1);
    }
    if (level() > lvBefore) setTimeout(function () { levelUp(); tone([523, 659, 784, 1047]); }, 700);
    var ps = document.getElementById("ps"), after = document.getElementById("after");
    setTimeout(function () { ps.scrollTo({ top: Math.max(0, after.offsetTop - 160), behavior: "smooth" }); }, 250);
  }
  function finishRun(id) {
    var r = getRun(id), sc = score(id, r);
    r.done = true; r.redo = null;
    var pct = Math.max(0, Math.round(100 * sc.marks / sc.N));
    if (meta.best[id] == null || pct > meta.best[id]) meta.best[id] = pct;
    saveRun(id, r); saveMeta(); combo = 0;
    go("finish", id);
    countUp(document.getElementById("fBig"), sc.marks, 1100);
    tone([523, 659, 784, 1047]); buzz([20, 40, 20, 40, 60]);
    var st = starsFor(pct);
    FX.confetti(60 + st * 50, window.innerWidth / 2, window.innerHeight * 0.24); FX.boost(1);
    if (st) setTimeout(function () { FX.confetti(st * 60, window.innerWidth * 0.2, window.innerHeight * 0.3); FX.confetti(st * 60, window.innerWidth * 0.8, window.innerHeight * 0.3); }, 450);
  }

  /* ---------- question grid sheet ---------- */
  function closeSheet() { app.querySelectorAll(".sheet,.sheet-bg").forEach(function (n) { n.remove(); }); }
  function gridSheet(id) {
    var r = getRun(id), Q = P[id].questions;
    var cells = Q.map(function (q, i) {
      var a = r.ans[i], c = "gq";
      if (a != null) c += a === q.correct ? " r" : " w";
      if (i === r.i) c += " cur";
      return '<button class="' + c + '" data-i="' + i + '">' + (i + 1) + "</button>";
    }).join("");
    var bg = document.createElement("div"); bg.className = "sheet-bg"; bg.onclick = closeSheet;
    var sh = document.createElement("div"); sh.className = "sheet";
    sh.innerHTML = "<h3>Jump to a question</h3>" + '<div class="legend"><span style="color:var(--ok)">■ right</span><span style="color:var(--bad)">■ wrong</span><span>■ not done</span></div>' + '<div class="gridq">' + cells + "</div>" +
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
      return '<div class="secrow' + (p < 50 ? " weak" : p >= 75 ? " strong" : "") + '"><div class="sl"><span>' + esc(labels[s] || s) + "</span><span>" + x.r + "/" + x.n + '</span></div><div class="sb"><i style="width:' + p + '%"></i></div></div>';
    }).join("") + "</div>" : "";
    app.innerHTML = '<div class="screen finish-screen"><div class="ptop"><button class="xbtn" data-go="home" aria-label="Back to all tests">' + I.close + '</button><div style="flex:1"></div></div><div class="scroll narrow">' +
      '<div class="fin-s">' + esc(title_of(id)) + '</div><div class="big"><span id="fBig">' + fmt(sc.marks) + "</span><small>out of " + sc.N + "</small></div>" +
      '<div class="fin-stars">' + I.star(st > 0) + I.star(st > 1) + I.star(st > 2) + '</div><div class="fin-h">' + head + "</div>" +
      '<div class="stats"><div class="stat"><b style="color:var(--ok)">' + sc.right + '</b><span>Right</span></div><div class="stat"><b style="color:var(--bad)">' + sc.wrong +
      '</b><span>Wrong</span></div><div class="stat"><b>' + sc.skipped + "</b><span>Skipped</span></div></div>" +
      '<div class="stats" style="grid-template-columns:1fr 1fr"><div class="stat"><b>' + pct + '%</b><span>Score</span></div><div class="stat"><b style="color:var(--gold)">+' + (r.xp || 0) +
      "</b><span>XP earned</span></div></div>" + secHTML +
      '<button class="btn gold" id="fCopy">Copy results</button>' +
      '<button class="btn" data-go="review" data-id="' + id + '">Review every answer</button>' +
      (sc.wrong ? '<button class="btn bad" id="fRedo">Redo the ' + sc.wrong + " wrong</button>" : "") +
      (SL && sc.wrong ? '<button class="btn ghost" id="fStudy">📌 Add missed questions to To study</button>' : "") +
      '<button class="btn ghost" data-go="home">Back to all tests</button></div></div>';
    document.getElementById("fCopy").onclick = function () { copyText(resultText(id)); };
    var fs = document.getElementById("fStudy");
    if (fs) fs.onclick = function () {
      var added = 0;
      Q.forEach(function (q, i) { if (r.ans[i] == null || r.ans[i] === q.correct) return; studyBtn(id, q, i); if (!SL.has("m:" + id + ":" + i)) { SL.add(SI["m:" + id + ":" + i]); added++; } });
      toast(added ? added + " missed questions added to To study" : "Missed questions are already saved in To study"); fs.remove();
    };
    var fr = document.getElementById("fRedo");
    if (fr) fr.onclick = function () {
      var list = [];
      for (var k in r.ans) if (r.ans[k] !== Q[+k].correct) list.push(+k);
      list.sort(function (a, b) { return a - b; });
      list.forEach(function (k) { delete r.ans[k]; });
      r.redo = list; r.i = list[0]; r.done = false; r.mode = "practice"; r.xp = 0; r.rs = Date.now(); saveRun(id, r);
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

  /* ---------- To study (shared with Name Lock via study.js + sync) ---------- */
  function study() {
    app.innerHTML = '<div class="screen"><div class="ptop"><button class="xbtn" data-go="home" aria-label="Back">' + I.back + '</button><div style="flex:1"></div></div><div class="scroll narrow" id="stl"></div></div>';
    SL.render(document.getElementById("stl"), {
      canOpen: function (x) { var m = /^m:(.+):(\d+)$/.exec(x.r); return !!(m && P[m[1]] && P[m[1]].questions[+m[2]]); },
      open: function (x) { var m = /^m:(.+):(\d+)$/.exec(x.r); questionSheet(m[1], +m[2]); }
    });
  }
  function questionSheet(id, i) {
    var q = P[id].questions[i];
    closeSheet();
    var bg = document.createElement("div"); bg.className = "sheet-bg"; bg.onclick = closeSheet;
    var sh = document.createElement("div"); sh.className = "sheet"; sh.style.overflowY = "auto";
    sh.innerHTML = '<p class="hint" style="margin:0 4px 8px">' + esc(title_of(id)) + " · Q" + (i + 1) + '</p><div class="qcard">' + q.q + "</div>" +
      L.filter(function (k) { return q.options[k] != null; }).map(function (k) { return '<div class="opt has-tag' + (k === q.correct ? " right" : " fade") + '"><span class="k">' + k + '</span><span class="ot">' + q.options[k] + "</span>" +
        (window.LEARN ? LEARN.otag(id, i, k) : "") + "</div>"; }).join("") +
      explainHTML(id, q, i);
    app.appendChild(bg); app.appendChild(sh);
  }
  window.addEventListener("study-change", function () { if (cur.s === "home") home(); });

  /* ---------- review ---------- */
  var rvFilter = "miss";
  function review() {
    var id = cur.id, Q = P[id].questions, r = getRun(id);
    var items = Q.map(function (q, i) { return { q: q, i: i, a: r.ans[i] }; }).filter(function (x) {
      return rvFilter === "all" ? true : rvFilter === "miss" ? x.a !== x.q.correct : x.a === x.q.correct;
    });
    app.innerHTML = '<div class="screen"><div class="ptop"><button class="xbtn" data-go="lobby" data-id="' + id + '" aria-label="Back">' + I.back + '</button><div class="ptitle">Review</div></div><div class="scroll narrow">' +
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
        body.innerHTML = '<div class="ryou">' + (a == null ? "You skipped this one" : a === q.correct ? "You got it right" : "You picked <b>" + a.toUpperCase() + ") " + q.options[a] + "</b>") + "</div>" +
          (SL ? '<div style="margin:0 0 10px">' + studyBtn(id, q, i) + "</div>" : "") + explainHTML(id, q, i);
      });
    });
  }

  /* XP from outside a mock run (Revenge mode): counts toward the daily goal, fires level-up */
  function gain(n) {
    var lvBefore = level();
    meta.xp += n; meta.days[today()] = (meta.days[today()] || 0) + 1; saveMeta();
    if (level() > lvBefore) setTimeout(function () { levelUp(); tone([523, 659, 784, 1047]); }, 700);
  }
  window.TAPP = { go: go, fx: FX, icons: I, countUp: countUp, getRun: getRun, meta: function () { return meta; },
    P: P, DEEP: DEEP, app: app, load: load, store: store, esc: esc, explainHTML: explainHTML, boldFig: boldFig, title_of: title_of, hud: hud,
    toast: toast, flash: flash, banner: banner, tone: tone, buzz: buzz, floater: floater, gain: gain, addWrongQuestion: addWrongQuestion, studyWrong: studyWrong, closeSheet: closeSheet,
    questionSheet: questionSheet, studyItem: studyItem, copyText: copyText, cur: function () { return cur; } };
  render();
})();
