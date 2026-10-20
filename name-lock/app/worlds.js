/* Name Lock world select. Intro (logo built out of firing neurons), profile HUD,
   swipeable planets with progress rings, padlocks that shatter on unlock,
   camera dive into a world, per-world ambient music. Reads the same
   namelock-progress-v1 / namelock-app-settings as the game (app.js). */
(function(){
"use strict";
var $ = function(s, r){ return (r || document).querySelector(s); };
var KEY = "namelock-progress-v1", SKEY = "namelock-app-settings", SEEN = "namelock-worlds-seen";
var DEMO = /[?&]demo=unlock/.test(location.search);

/* ================= state (read-only mirror of app.js) ================= */
function readJ(k){ try { return JSON.parse(localStorage.getItem(k)) || {}; } catch(e){ return {}; } }
var P = readJ(KEY), g = P.g || {}, boss = g.boss || {}, best = g.best || {}, days = g.days || {};
var S = Object.assign({sound: true, haptics: true, name: "Sihan"}, readJ(SKEY));
var seen = readJ(SEEN);
function saveS(){ var s = readJ(SKEY); s.sound = S.sound; localStorage.setItem(SKEY, JSON.stringify(s)); }

var LV = [0,150,350,600,900,1300,1800,2400,3100,4000,5000,6200,7600,9200,11000];
function rank(l){ return l <= 3 ? "Intern" : l <= 6 ? "Resident" : l <= 9 ? "Senior Resident" : l <= 12 ? "Consultant" : "NIMHANS Topper"; }
function level(xp){ var l = 1; for (var i = 1; i < LV.length; i++) if (xp >= LV[i]) l = i + 1; return l; }
function ymd(d){ return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function done(t){ var r = days[t]; return r && (+r.a || 0) >= (+g.goal || 10); }
function streak(){ var d = new Date(), n = 0; if (!done(ymd(d))) d.setDate(d.getDate() - 1);
  while (done(ymd(d))){ n++; d.setDate(d.getDate() - 1); } return n; }

/* boss order mirrors MAP in app.js */
var MAP = [["history","Structuralism","🏛️"],["perception","Gestalt","👁️"],["positive","Positive Psych","🌞"],["learning","Skinner Box","🐀"],
  ["memory","Ebbinghaus","🧠"],["cognitive","Heuristics","🧩"],["biological","Broca","⚡"],["developmental","Piaget","🧸"],
  ["personality","Freud","🛋️"],["social","Social Psych","👥"],["clinical","Ward Round","🩺"],["research","Placebo","🧪"],["all","NIMHANS Final","👑"]];
function won(k){ return !!(boss[k] && +boss[k].w); }
var wins = MAP.filter(function(m){ return won(m[0]); }).length;
var nextB = MAP.filter(function(m){ return !won(m[0]); })[0];
/* Biopsych levels mirror BIO in app.js */
var BIO = [["pinel-1","Origins","🧬"],["pinel-2","Neuron","⚡"],["pinel-3","Lab and Vision","👁️"],["pinel-4","Sensorimotor","🖐️"],["pinel-5","Plasticity","🌱"],
  ["pinel-6","H.M.","🧠"],["pinel-7","Hormone and Sleep","🌙"],["pinel-8","Split Brain","💊"],["pinel-9","Amygdala","😱"],["pinel-final","Pinel Final","👑"]];
var bioW = BIO.filter(function(m){ return won(m[0]); }).length;
var nextBio = BIO.filter(function(m){ return !won(m[0]); })[0];
/* Dissertation levels come from viva.js (same keys as app.js: "dis-" + level key) */
var DISL = ((window.NL_VIVA || {}).dis || {levels: []}).levels, gv = g.v || {};
var DIS = DISL.map(function(l){ return ["dis-" + l.k, l.name, l.icon]; });
var disW = DIS.filter(function(m){ return won(m[0]); }).length;
var nextDis = DIS.filter(function(m){ return !won(m[0]); })[0];
var disT = 0, disN = 0; DISL.forEach(function(l){ (l.cards || []).forEach(function(c){ disT++; if (gv[c.id] && +gv[c.id].k) disN++; }); });

var WORLDS = [
  {id: "wsw", kick: "WORLD 1", name: "Who Said What", tag: "A city of theorist statues",
    c: ["#fff3c4", "#ffc93c", "#7a4306"], pc: "#ffc93c", pd: "#a87a06", spin: 48, built: true, open: true,
    prog: wins / MAP.length, best: +best.combo ? best.combo + " in a row" : "--", next: nextB ? nextB[2] + " " + nextB[1] : "All won 🏆"},
  {id: "bio", kick: "WORLD 2", name: "Biopsych", tag: "A glowing brain with pulsing neurons",
    c: ["#ffd9f7", "#e548d3", "#35106a"], pc: "#ff5fe0", pd: "#a3249a", spin: 40, built: true, open: true,
    lockText: "", prog: bioW / BIO.length, best: +best.combo ? best.combo + " in a row" : "--", next: nextBio ? nextBio[2] + " " + nextBio[1] : "All won 🏆"},
  {id: "dis", kick: "WORLD 3", name: "Dissertation", tag: "Your own study, the way a viva panel walks it",
    c: ["#e3ffef", "#2fd47f", "#08402e"], pc: "#4dffa6", pd: "#16935a", spin: 60, built: true, open: true,
    lockText: "", prog: DIS.length ? disW / DIS.length : 0, best: disN + "/" + disT, bestK: "Nailed", next: nextDis ? nextDis[2] + " " + nextDis[1] : "All cleared 🏆", nextK: "Next level"},
  {id: "stats", kick: "WORLD 4", name: "Stats and Research", tag: "A lab world of data towers and graphs",
    c: ["#d6fbff", "#38c6ff", "#0a2a66"], pc: "#3de0ff", pd: "#1a78a8", spin: 56, built: false, open: won("pinel-final") || DEMO,
    lockText: "Beat the Pinel Final Boss to unlock", prog: 0, best: "--", next: "Normal Curve Boss"}
];
if (!seen.wsw){ seen.wsw = 1; localStorage.setItem(SEEN, JSON.stringify(seen)); }

/* ================= feel: haptics, audio ================= */
function buzz(p){ if (S.haptics === false) return;
  try { if (window.NLNative) NLNative.vibrate(p.join(",")); else if (navigator.vibrate) navigator.vibrate(p); } catch(e){} }

var AC = null, master = null, amb = null, ambFor = -1;
function audio(){
  if (AC) return AC;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return null; }
  master = AC.createGain(); master.gain.value = S.sound ? 1 : 0; master.connect(AC.destination);
  return AC;
}
function noiseBuf(sec){ var b = AC.createBuffer(1, AC.sampleRate * sec, AC.sampleRate), d = b.getChannelData(0);
  for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function env(gn, t, peak, a, dur){ gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(peak, t + a); gn.gain.exponentialRampToValueAtTime(.0001, t + dur); }
function tone(f, type, t, peak, dur, dest){ var o = AC.createOscillator(), gn = AC.createGain();
  o.type = type; o.frequency.value = f; env(gn, t, peak, .01, dur); o.connect(gn); gn.connect(dest || master); o.start(t); o.stop(t + dur + .05); }

/* each world: a drone pad + a sparse "texture" voice that sets the mood */
var MOODS = [
  {pad: [110, 164.81, 220, 277.18], type: "triangle", cut: 900, lfo: .07, step: 1.6, notes: [440, 554.37, 659.25, 739.99, 880], voice: "sine", vol: .05, dur: 2.2},
  {pad: [73.42, 110, 146.83, 220], type: "sine", cut: 1400, lfo: 1.05, step: .32, notes: [880, 1174.66, 1318.51, 1760, 2349.32], voice: "sine", vol: .025, dur: .18, sparse: .55},
  {pad: [98, 146.83, 196, 293.66], type: "sine", cut: 1100, lfo: .09, step: 1.3, notes: [587.33, 659.25, 783.99, 880, 987.77], voice: "triangle", vol: .03, dur: 1.6},
  {pad: [65.41, 130.81, 196, 261.63], type: "sawtooth", cut: 520, lfo: .12, step: .25, notes: [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25], voice: "square", vol: .012, dur: .12, seq: true}
];
function startAmb(ix){
  if (!AC || ambFor === ix) return;
  stopAmb(); ambFor = ix;
  var m = MOODS[ix], t = AC.currentTime, out = AC.createGain(), f = AC.createBiquadFilter(), lfo = AC.createOscillator(), lg = AC.createGain(), oscs = [];
  out.gain.setValueAtTime(.0001, t); out.gain.exponentialRampToValueAtTime(1, t + 1.5); out.connect(master);
  f.type = "lowpass"; f.frequency.value = m.cut; f.Q.value = 2; f.connect(out);
  lfo.frequency.value = m.lfo; lg.gain.value = m.cut * .45; lfo.connect(lg); lg.connect(ix === 1 ? out.gain : f.frequency);
  if (ix === 1){ lg.gain.value = .35; }
  m.pad.forEach(function(fr){ [-5, 5].forEach(function(c){ var o = AC.createOscillator(), gn = AC.createGain();
    o.type = m.type; o.frequency.value = fr; o.detune.value = c; gn.gain.value = .045 / m.pad.length * 2.2; o.connect(gn); gn.connect(f); o.start(t); oscs.push(o); }); });
  lfo.start(t); oscs.push(lfo);
  var k = 0, timer = setInterval(function(){
    if (!S.sound) return;
    if (m.sparse && Math.random() > m.sparse) return;
    var n = m.seq ? m.notes[k++ % m.notes.length] : m.notes[Math.floor(Math.random() * m.notes.length)];
    tone(n, m.voice, AC.currentTime + .02, m.vol, m.dur, out);
    if (ix === 1 && Math.random() < .3) tone(n * 1.5, "sine", AC.currentTime + .09, m.vol * .7, m.dur, out);
  }, m.step * 1000);
  amb = {out: out, oscs: oscs, timer: timer};
}
function stopAmb(){
  if (!amb) return;
  var a = amb, t = AC.currentTime; amb = null; ambFor = -1; clearInterval(a.timer);
  a.out.gain.cancelScheduledValues(t); a.out.gain.setValueAtTime(a.out.gain.value || .0001, t); a.out.gain.exponentialRampToValueAtTime(.0001, t + 1);
  a.oscs.forEach(function(o){ try { o.stop(t + 1.1); } catch(e){} });
}
function whoosh(){
  if (!audio()) return; var t = AC.currentTime, n = AC.createBufferSource(), bp = AC.createBiquadFilter(), gn = AC.createGain();
  n.buffer = noiseBuf(1.3); bp.type = "bandpass"; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(250, t); bp.frequency.exponentialRampToValueAtTime(3800, t + 1.1);
  env(gn, t, .5, .7, 1.25); n.connect(bp); bp.connect(gn); gn.connect(master); n.start(t);
  var o = AC.createOscillator(), og = AC.createGain(); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(38, t + 1.1);
  env(og, t, .35, .4, 1.2); o.connect(og); og.connect(master); o.start(t); o.stop(t + 1.3);
}
function shatterSfx(){
  if (!audio()) return; var t = AC.currentTime, n = AC.createBufferSource(), hp = AC.createBiquadFilter(), gn = AC.createGain();
  n.buffer = noiseBuf(.5); hp.type = "highpass"; hp.frequency.value = 2500; env(gn, t, .45, .005, .45);
  n.connect(hp); hp.connect(gn); gn.connect(master); n.start(t);
  [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach(function(f, i){ tone(f, "triangle", t + .12 + i * .08, .12, .9); });
}
function thunk(){ if (!audio()) return; var t = AC.currentTime; tone(110, "square", t, .08, .18); tone(82, "sine", t + .05, .2, .25); }

/* ================= planets (SVG) ================= */
function rng(seed){ return function(){ seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function surface(w){
  var r = rng(w.id.length * 977 + 13), h = "";
  if (w.id === "wsw"){
    /* rows of temples, columns and statues; darker gold, scrolling */
    [[-58, .8], [-14, 1], [32, 1.1], [74, .9]].forEach(function(row){
      var y = row[0], s = row[1], x = -200;
      h += '<rect x="-200" y="' + y + '" width="400" height="2.5" fill="#6b3c05" opacity=".45"/>';
      while (x < 190){
        var k = r(), wd;
        if (k < .3){ wd = 22 * s; var th = 12 * s;
          h += '<path d="M' + x + ' ' + (y - th) + 'l' + (wd / 2) + ' ' + (-7 * s) + 'l' + (wd / 2) + ' ' + (7 * s) + 'z" fill="#6b3c05" opacity=".6"/>';
          for (var c = 0; c < 4; c++) h += '<rect x="' + (x + 1.5 + c * (wd - 5) / 3) + '" y="' + (y - th) + '" width="2.2" height="' + th + '" fill="#6b3c05" opacity=".6"/>';
        } else if (k < .7){ wd = 10 * s; var bh = (14 + r() * 10) * s;
          h += '<rect x="' + x + '" y="' + (y - 4 * s) + '" width="' + (8 * s) + '" height="' + (4 * s) + '" fill="#6b3c05" opacity=".55"/>' +
            '<path d="M' + (x + 1.5 * s) + ' ' + (y - 4 * s) + 'l' + (1 * s) + ' ' + (-(bh - 9 * s)) + 'h' + (3 * s) + 'l' + (1 * s) + ' ' + (bh - 9 * s) + 'z" fill="#6b3c05" opacity=".6"/>' +
            '<circle cx="' + (x + 4 * s) + '" cy="' + (y - bh + 1) + '" r="' + (2.6 * s) + '" fill="#6b3c05" opacity=".6"/>';
        } else { wd = 6 * s; h += '<rect x="' + x + '" y="' + (y - (8 + r() * 14) * s) + '" width="' + (3 * s) + '" height="' + (22 * s) + '" fill="#6b3c05" opacity=".35"/>'; }
        x += wd + 3 + r() * 9;
      }
    });
    for (var i = 0; i < 18; i++) h += '<circle cx="' + (-200 + r() * 400) + '" cy="' + (-90 + r() * 180) + '" r="1.4" fill="#fff6d0" class="blink" style="animation-delay:-' + (r() * 2).toFixed(2) + 's"/>';
  } else if (w.id === "bio"){
    for (var y = -96; y <= 96; y += 13){
      var n = 14 + Math.floor(r() * 6), a = 3 + r() * 4, d = "M-200 " + y;
      for (var x2 = -200; x2 <= 200; x2 += 5) d += " L" + x2 + " " + (y + a * Math.sin((x2 + 200) / 400 * n * 2 * Math.PI)).toFixed(1);
      h += '<path d="' + d + '" fill="none" stroke="#ffd9f7" stroke-width="2.4" opacity=".22" stroke-linecap="round"/>';
    }
    h += '<path d="M0 -100 C 8 -60 -8 -20 4 20 S -6 70 0 100" fill="none" stroke="#2a0850" stroke-width="3" opacity=".55"/>';
    var pts = []; for (var j = 0; j < 16; j++) pts.push([-190 + r() * 380, -80 + r() * 160]);
    pts.forEach(function(p, ix){
      var nb = pts.map(function(q, qi){ return [qi, Math.hypot(q[0] - p[0], q[1] - p[1])]; }).filter(function(e){ return e[0] > ix && e[1] < 95; }).sort(function(a2, b){ return a2[1] - b[1]; }).slice(0, 2);
      nb.forEach(function(e){ var q = pts[e[0]], d2 = "M" + p[0].toFixed(1) + " " + p[1].toFixed(1) + " L" + q[0].toFixed(1) + " " + q[1].toFixed(1);
        h += '<path d="' + d2 + '" stroke="#fff" stroke-width="1" opacity=".25"/>' +
          '<path d="' + d2 + '" pathLength="100" class="fire" stroke="#fff" stroke-width="2.4" stroke-linecap="round" style="animation-delay:-' + (r() * 2.2).toFixed(2) + 's;animation-duration:' + (1.6 + r()).toFixed(2) + 's"/>'; });
    });
    pts.forEach(function(p){ var dl = (r() * 2.4).toFixed(2);
      h += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="9" fill="#ff8af0" opacity=".5" class="pulse" style="animation-delay:-' + dl + 's"/>' +
        '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.4" fill="#fff" class="pulse" style="animation-delay:-' + dl + 's"/>'; });
  } else if (w.id === "dis"){
    /* a library planet: shelves of book spines */
    for (var sy = -84; sy <= 96; sy += 30){
      h += '<rect x="-200" y="' + sy + '" width="400" height="3" fill="#06281d" opacity=".55"/>';
      for (var bk = -200; bk < 196;){ var bw = 5 + r() * 7, bt = 14 + r() * 12;
        h += '<rect x="' + bk.toFixed(1) + '" y="' + (sy - bt).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bt.toFixed(1) + '" rx="1" fill="' + ["#0b5a45", "#06281d", "#e3ffef", "#1f9d6b"][Math.floor(r() * 4)] + '" opacity="' + (.35 + r() * .35).toFixed(2) + '"/>';
        bk += bw + 1.5 + (r() < .12 ? 8 : 0); }
    }
    for (var di = 0; di < 14; di++) h += '<circle cx="' + (-200 + r() * 400).toFixed(1) + '" cy="' + (-96 + r() * 190).toFixed(1) + '" r="1.3" fill="#eafff3" class="blink" style="animation-delay:-' + (r() * 2).toFixed(2) + 's"/>';
  } else {
    for (var gx = -200; gx < 200; gx += 25) h += '<rect x="' + gx + '" y="-100" width=".8" height="200" fill="#d6fbff" opacity=".14"/>';
    for (var gy = -100; gy <= 100; gy += 25) h += '<rect x="-200" y="' + gy + '" width="400" height=".8" fill="#d6fbff" opacity=".14"/>';
    for (var bx = -196; bx < 196; bx += 21){ var bh2 = 14 + r() * 58;
      h += '<rect x="' + bx + '" y="' + (78 - bh2) + '" width="13" height="' + bh2 + '" rx="1.5" fill="#06204d" opacity=".62"/>' +
        '<rect x="' + bx + '" y="' + (78 - bh2) + '" width="13" height="2.5" fill="#9ef0ff" opacity=".8"/>';
      for (var wy = 78 - bh2 + 7; wy < 74; wy += 7) if (r() < .45) h += '<rect x="' + (bx + 4) + '" y="' + wy.toFixed(1) + '" width="5" height="2" fill="#bdf6ff" class="blink" style="animation-delay:-' + (r() * 2).toFixed(2) + 's"/>';
    }
    var ly = -34, pl = [];
    for (var lx = -200; lx <= 200; lx += 20){ pl.push(lx + "," + ly.toFixed(1)); ly = lx >= 180 ? -34 : Math.max(-70, Math.min(-6, ly + (r() - .5) * 26)); }
    h += '<polyline points="' + pl.join(" ") + '" fill="none" stroke="#e9fdff" stroke-width="2.4" stroke-linejoin="round"/>';
    pl.forEach(function(s2){ var q2 = s2.split(","); h += '<circle cx="' + q2[0] + '" cy="' + q2[1] + '" r="2.6" fill="#fff"/>'; });
    var bc = "M-160 -78"; for (var cx = -160; cx <= -60; cx += 4) bc += " L" + cx + " " + (-78 - 22 * Math.exp(-Math.pow((cx + 110) / 18, 2) / 2)).toFixed(1);
    h += '<path d="' + bc + '" fill="none" stroke="#ffe66b" stroke-width="2" opacity=".85"/>';
  }
  return h;
}
/* landmarks standing on the top of the planet (do not spin) */
function skyline(w){
  var h = "";
  if (w.id === "wsw") [[-30, 1], [0, 1.3], [30, 1]].forEach(function(s){ var k = s[1];
    h += '<g transform="rotate(' + s[0] + ')"><rect x="' + (-9 * k) + '" y="' + (-100 - 7 * k) + '" width="' + (18 * k) + '" height="' + (9 * k) + '" rx="1" fill="#4a2a05" stroke="#ffe28a" stroke-width=".8"/>' +
      '<path d="M' + (-6 * k) + ' ' + (-100 - 7 * k) + ' C' + (-7 * k) + ' ' + (-118 * 1) + ' ' + (-4 * k) + ' ' + (-100 - 20 * k) + ' 0 ' + (-100 - 21 * k) + ' C' + (4 * k) + ' ' + (-100 - 20 * k) + ' ' + (7 * k) + ' ' + (-100 - 14 * k) + ' ' + (6 * k) + ' ' + (-100 - 7 * k) + 'z" fill="#4a2a05" stroke="#ffe28a" stroke-width=".8"/>' +
      '<circle cy="' + (-100 - 25 * k) + '" r="' + (4.5 * k) + '" fill="#4a2a05" stroke="#ffe28a" stroke-width=".8"/></g>'; });
  else if (w.id === "stats") [[-26, 26], [6, 42], [32, 18]].forEach(function(s){
    h += '<g transform="rotate(' + s[0] + ')"><rect x="-6" y="' + (-98 - s[1]) + '" width="12" height="' + s[1] + '" fill="#06204d" stroke="#9ef0ff" stroke-width="1"/>' +
      '<rect x="-2" y="' + (-98 - s[1] + 6) + '" width="4" height="' + (s[1] - 10) + '" fill="#9ef0ff" opacity=".35"/>' +
      '<circle cy="' + (-101 - s[1]) + '" r="2.6" fill="#ff4d6d" class="blink"/></g>'; });
  else if (w.id === "dis") h += '<g transform="translate(0 -108)"><path d="M-26 0L0-11L26 0L0 11z" fill="#06281d" stroke="#b9ffd9" stroke-width="1.2"/>' +
    '<path d="M-14 4v9q14 8 28 0v-9" fill="#06281d" stroke="#b9ffd9" stroke-width="1.2"/><path d="M18 2v14" stroke="#ffd23f" stroke-width="1.6"/><circle cx="18" cy="17" r="2.4" fill="#ffd23f"/></g>';
  else h += '<g opacity=".9"><circle r="112" fill="none" stroke="#ff9cf0" stroke-width="1" stroke-dasharray="2 9" opacity=".6"/></g>';
  return h;
}
var LOCK = '<svg viewBox="0 0 100 120"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e7f2"/><stop offset="1" stop-color="#7d8499"/></linearGradient></defs>' +
  '<path d="M29 56V38a21 21 0 0 1 42 0v18" fill="none" stroke="#cfd5e6" stroke-width="11" stroke-linecap="round"/>' +
  '<rect x="13" y="52" width="74" height="60" rx="13" fill="url(#lg)" stroke="#5a6078" stroke-width="2"/>' +
  '<circle cx="50" cy="76" r="8" fill="#2c3145"/><rect x="46" y="78" width="8" height="17" rx="3" fill="#2c3145"/></svg>';

function planetSvg(w){
  var R = 128, C = 2 * Math.PI * R, id = w.id;
  return '<svg viewBox="-150 -150 300 300"><defs>' +
    '<radialGradient id="b-' + id + '" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="' + w.c[0] + '"/><stop offset=".45" stop-color="' + w.c[1] + '"/><stop offset="1" stop-color="' + w.c[2] + '"/></radialGradient>' +
    '<radialGradient id="s-' + id + '" cx="-40" cy="-46" r="175" gradientUnits="userSpaceOnUse"><stop offset=".45" stop-color="#000014" stop-opacity="0"/><stop offset="1" stop-color="#000014" stop-opacity=".78"/></radialGradient>' +
    '<radialGradient id="h-' + id + '" cx="-38" cy="-44" r="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    '<clipPath id="c-' + id + '"><circle r="100"/></clipPath></defs>' +
    '<circle r="' + R + '" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="5"/>' +
    '<circle class="ringfg" r="' + R + '" fill="none" stroke="' + w.pc + '" stroke-width="5" stroke-linecap="round" transform="rotate(-90)" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" data-off="' + (C * (1 - w.prog)).toFixed(1) + '"/>' +
    '<g class="glow" style="--pc:' + w.pc + '"><circle r="100" fill="url(#b-' + id + ')"/></g>' +
    '<g clip-path="url(#c-' + id + ')"><g class="spin" style="--spin:' + w.spin + 's">' + surface(w) + '<g transform="translate(400 0)">' + surface(w) + '</g></g>' +
    '<circle r="100" fill="url(#s-' + id + ')"/><circle r="100" fill="url(#h-' + id + ')"/></g>' +
    '<circle r="100" fill="none" stroke="' + w.c[0] + '" stroke-opacity=".45" stroke-width="1.5"/>' + skyline(w) + '</svg>';
}

/* ================= build the carousel ================= */
var track = $("#track"), dots = $("#dots");
function chips(w){
  if (!w.open) return '<div class="chip"><b>🔒</b><small>Locked</small></div><div class="chip"><b>--</b><small>Best</small></div><div class="chip"><b>' + w.next + '</b><small>Boss</small></div>';
  return '<div class="chip"><b>' + Math.round(w.prog * 100) + '%</b><small>Done</small></div><div class="chip"><b>' + w.best + '</b><small>' + (w.bestK || "Best combo") + '</small></div><div class="chip"><b>' + w.next + '</b><small>' + (w.nextK || "Next boss") + '</small></div>';
}
function btnText(w){ return !w.open ? "🔒 " + w.lockText : w.built ? "Enter world" : "Being built, next up"; }
WORLDS.forEach(function(w, i){
  var sl = document.createElement("section");
  sl.className = "slide" + (w.open && (seen[w.id] || i === 0) ? "" : " locked");
  sl.style.setProperty("--pc", w.pc); sl.style.setProperty("--pd", w.pd);
  sl.innerHTML = '<div class="stage"><div class="bob"><div class="planet" role="button" aria-label="' + w.name + '">' + planetSvg(w) + '</div>' +
    (sl.classList.contains("locked") ? '<div class="lock">' + LOCK + '</div>' : '') + '</div></div>' +
    '<div class="info"><div class="kick">' + w.kick + '</div><h1>' + w.name + '</h1><p>' + w.tag + '</p><div class="chips">' + chips(w) + '</div>' +
    '<button class="go">' + btnText(w) + '</button></div>';
  if (sl.classList.contains("locked") && w.open){ $(".chips", sl).innerHTML = chips({open: false, next: w.next}); $(".go", sl).textContent = "🔒 " + w.lockText; }
  track.appendChild(sl);
  dots.insertAdjacentHTML("beforeend", "<i></i>");
  $(".planet", sl).onclick = $(".go", sl).onclick = function(){ tapWorld(i); };
});
var slides = [].slice.call(track.children), CUR = -1;

function toast(t){ var el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(function(){ el.classList.remove("on"); }, 2600); }

function tapWorld(i){
  audio(); var w = WORLDS[i], sl = slides[i];
  if (i !== CUR){ go(i); return; }
  if (sl.classList.contains("locked")){
    sl.classList.remove("shake"); void sl.offsetWidth; sl.classList.add("shake"); thunk(); buzz([30, 40, 30]); toast("🔒 " + w.lockText); return; }
  if (!w.built){ buzz([12]); toast(w.name + " is being built. It's next on the list."); return; }
  dive(i);
}
function dive(i){
  var w = WORLDS[i];
  document.body.classList.add("diving"); $("#flash").style.background = w.pc; $("#flash").classList.add("on");
  WARP.on = true; whoosh(); stopAmb(); buzz([15, 40, 25, 40, 70]);
  setTimeout(function(){ location.href = "index.html#" + (w.id === "bio" || w.id === "dis" ? w.id : "map"); }, 1150);
}
window.addEventListener("pageshow", function(e){ if (e.persisted){ document.body.classList.remove("diving"); $("#flash").classList.remove("on"); WARP.on = false; WARP.v = 0; } });

function shatter(i){
  var sl = slides[i], w = WORLDS[i], lk = $(".lock", sl), stg = $(".stage", sl);
  if (!lk) return;
  seen[w.id] = 1; if (!DEMO) localStorage.setItem(SEEN, JSON.stringify(seen));
  setTimeout(function(){
    lk.remove(); var N = 11, a0 = Math.random() * 6;
    for (var k = 0; k < N; k++){
      var a = a0 + k * 2 * Math.PI / N, b = a + 2 * Math.PI / N, sh = document.createElement("div");
      sh.className = "shard"; sh.innerHTML = LOCK;
      sh.style.clipPath = "polygon(50% 62%," + (50 + 160 * Math.cos(a)).toFixed(1) + "% " + (62 + 160 * Math.sin(a)).toFixed(1) + "%," + (50 + 160 * Math.cos(b)).toFixed(1) + "% " + (62 + 160 * Math.sin(b)).toFixed(1) + "%)";
      var m = (a + b) / 2, dist = 90 + Math.random() * 120;
      sh.style.setProperty("--dx", (Math.cos(m) * dist).toFixed(0) + "px"); sh.style.setProperty("--dy", (Math.sin(m) * dist + 40).toFixed(0) + "px");
      sh.style.setProperty("--r", ((Math.random() - .5) * 540).toFixed(0) + "deg");
      stg.appendChild(sh); setTimeout(sh.remove.bind(sh), 1200);
    }
    var bu = document.createElement("div"); bu.className = "burst"; bu.style.setProperty("--pc", w.pc); stg.appendChild(bu); setTimeout(bu.remove.bind(bu), 950);
    sl.classList.remove("locked"); $(".chips", sl).innerHTML = chips(w); $(".go", sl).textContent = btnText(w);
    shatterSfx(); buzz([20, 30, 20, 30, 90]); toast("🔓 " + w.name + " unlocked");
  }, 500);
}

/* ================= carousel behaviour ================= */
function go(i){ track.scrollTo({left: i * track.clientWidth, behavior: "smooth"}); }
function setCur(i){
  if (i === CUR) return; CUR = i; var w = WORLDS[i];
  [].forEach.call(dots.children, function(d, k){ d.className = k === i ? "on" : ""; });
  slides.forEach(function(sl, k){ sl.classList.toggle("cur", k === i); });
  document.documentElement.style.setProperty("--w", w.pc);
  startAmb(i);
  if (READY && w.open && !seen[w.id]) shatter(i);
  try { sessionStorage.setItem("nl-world", i); } catch(e){}
}
function onScroll(){
  var W = track.clientWidth || 1, x = track.scrollLeft;
  slides.forEach(function(sl, k){ var off = (k * W - x) / W, a = Math.min(1, Math.abs(off));
    $(".stage", sl).style.transform = "translateX(" + (off * 38).toFixed(1) + "%) scale(" + (1 - a * .35).toFixed(3) + ") rotate(" + (off * 12).toFixed(1) + "deg)"; });
  STAR.px = x / W;
  setCur(Math.max(0, Math.min(slides.length - 1, Math.round(x / W))));
}
track.addEventListener("scroll", function(){ if (!onScroll.q){ onScroll.q = 1; requestAnimationFrame(function(){ onScroll.q = 0; onScroll(); }); } }, {passive: true});
window.addEventListener("resize", function(){ track.scrollLeft = CUR * track.clientWidth; onScroll(); resizeStars(); });
$("#prev").onclick = function(){ go(Math.max(0, CUR - 1)); };
$("#next").onclick = function(){ go(Math.min(slides.length - 1, CUR + 1)); };
[].forEach.call(dots.children, function(d, k){ d.onclick = function(){ go(k); }; });
document.addEventListener("keydown", function(e){ if (e.key === "ArrowLeft") $("#prev").click(); else if (e.key === "ArrowRight") $("#next").click(); else if (e.key === "Enter") tapWorld(CUR); });

/* mute */
function drawMute(){ $("#mute").textContent = S.sound ? "🔊" : "🔇"; }
$("#mute").onclick = function(){ S.sound = !S.sound; saveS(); drawMute(); if (audio()){ master.gain.setTargetAtTime(S.sound ? 1 : 0, AC.currentTime, .15); startAmb(CUR); } };
drawMute();
/* browsers only allow audio after a gesture: first touch anywhere starts the music */
document.addEventListener("pointerdown", function first(){ document.removeEventListener("pointerdown", first, true);
  if (audio()){ if (AC.state === "suspended") AC.resume(); if (READY) startAmb(CUR); } }, true);

/* profile HUD */
(function(){
  var xp = +g.xp || 0, l = level(xp), lo = LV[l - 1], hi = LV[l], s = streak();
  $("#p-lv").textContent = l; $("#p-name").textContent = (S.name || "Sihan").trim() || "Sihan"; $("#p-rank").textContent = rank(l) + " · Lv " + l;
  $("#p-xp").textContent = xp + (hi != null ? " / " + hi : "") + " XP"; $("#p-xpf").dataset.w = (hi == null ? 100 : Math.round((xp - lo) * 100 / (hi - lo))) + "%";
  $("#p-stn").textContent = s; if (done(ymd(new Date()))) $("#p-st").classList.add("lit");
})();

/* ================= starfield (with warp for the dive) ================= */
var sc = $("#stars"), sx = sc.getContext("2d"), STAR = {px: 0, list: []}, WARP = {on: false, v: 0}, DPR = Math.min(2, window.devicePixelRatio || 1);
function resizeStars(){ sc.width = innerWidth * DPR; sc.height = innerHeight * DPR; }
resizeStars();
for (var si = 0; si < 260; si++) STAR.list.push({x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), tw: Math.random() * 6});
function drawStars(t){
  var W = sc.width, H = sc.height, cx = W / 2, cy = H * .45;
  sx.fillStyle = "#05060d"; sx.fillRect(0, 0, W, H);
  if (WARP.on) WARP.v = Math.min(1, WARP.v + .025);
  STAR.list.forEach(function(s){
    var d = .3 + s.z * .7, x = ((s.x * W * .6 - STAR.px * 60 * DPR * d) % (W * 1.2) + W * 1.8) % (W * 1.2) - W * .1, y = (s.y + 1) / 2 * H + Math.sin(t / 4000 + s.tw) * 3;
    var a = .35 + .65 * Math.abs(Math.sin(t / 900 + s.tw)) * s.z, r = (.5 + s.z * 1.2) * DPR;
    if (WARP.v > 0){ var dx = x - cx, dy = y - cy, k = 1 + WARP.v * WARP.v * 2.4;
      sx.strokeStyle = "rgba(255,255,255," + Math.min(1, a + WARP.v) + ")"; sx.lineWidth = r;
      sx.beginPath(); sx.moveTo(cx + dx * k, cy + dy * k); sx.lineTo(cx + dx * (k + WARP.v * 1.6), cy + dy * (k + WARP.v * 1.6)); sx.stroke();
    } else { sx.fillStyle = "rgba(255,255,255," + a.toFixed(2) + ")"; sx.beginPath(); sx.arc(x, y, r, 0, 6.283); sx.fill(); }
  });
  requestAnimationFrame(drawStars);
}
requestAnimationFrame(drawStars);

/* ================= intro: logo assembled by firing neurons ================= */
var READY = false;
function finishIntro(){
  if (READY) return; READY = true; INTRO.stop = true;
  document.body.classList.add("ready");
  setTimeout(function(){ $("#p-xpf").style.width = $("#p-xpf").dataset.w;
    [].forEach.call(document.querySelectorAll(".ringfg"), function(c){ c.style.strokeDashoffset = c.dataset.off; }); }, 50);
  if (CUR < 0) return;
  if (AC) startAmb(CUR);
  var w = WORLDS[CUR]; if (w.open && !seen[w.id]) shatter(CUR);
}
var INTRO = {stop: false};
function intro(){
  var cv = $("#neuro"), cx = cv.getContext("2d"), W = cv.width = innerWidth * DPR, H = cv.height = innerHeight * DPR;
  var fs = Math.min(innerWidth * .13, 72) * DPR, off = document.createElement("canvas"), ox = off.getContext("2d");
  off.width = W; off.height = H; ox.fillStyle = "#fff"; ox.textAlign = "center"; ox.textBaseline = "middle";
  ox.font = "900 " + fs + "px Nunito, Roboto, 'Segoe UI', system-ui, sans-serif";
  try { ox.letterSpacing = (fs * .04) + "px"; } catch(e){}
  var ty = H / 2 - 13 * DPR; ox.fillText("NAME LOCK", W / 2, ty);
  var step = Math.max(4 * DPR, Math.round(fs / 10)), data = ox.getImageData(0, 0, W, H).data, pts = [];
  for (var y = 0; y < H; y += step) for (var x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 140) pts.push([x, y]);
  pts.sort(function(){ return Math.random() - .5; }); pts = pts.slice(0, 280);
  var N = pts.map(function(p){ var a = Math.random() * 6.283, r = Math.max(W, H) * (.35 + Math.random() * .4);
    return {tx: p[0], ty: p[1], sx: W / 2 + Math.cos(a) * r, sy: H / 2 + Math.sin(a) * r, d: Math.random() * .55, f: 0, x: 0, y: 0}; });
  var E = [];
  N.forEach(function(n, i){ N.map(function(m, j){ return [j, Math.hypot(m.tx - n.tx, m.ty - n.ty)]; }).filter(function(e){ return e[0] > i && e[1] < step * 2.6; })
    .sort(function(a, b){ return a[1] - b[1]; }).slice(0, 2).forEach(function(e){ E.push([i, e[0]]); }); });
  var pulses = [], t0 = performance.now();
  function ease(t){ return 1 - Math.pow(1 - t, 3); }
  function frame(now){
    if (INTRO.stop) return;
    var t = (now - t0) / 1000;
    cx.clearRect(0, 0, W, H); cx.globalCompositeOperation = "lighter";
    N.forEach(function(n){ var k = ease(Math.max(0, Math.min(1, (t - n.d) / 1.25)));
      n.x = n.sx + (n.tx - n.sx) * k; n.y = n.sy + (n.ty - n.sy) * k; n.k = k; n.f *= .9; });
    for (var s = 0; s < 6; s++) if (E.length) pulses.push({e: E[Math.floor(Math.random() * E.length)], t: 0});
    cx.lineWidth = 1 * DPR;
    E.forEach(function(e){ var a = N[e[0]], b = N[e[1]], al = Math.min(a.k, b.k) * .22;
      if (al < .01) return; cx.strokeStyle = "rgba(167,139,250," + al + ")"; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); });
    pulses = pulses.filter(function(p){ p.t += .07; var a = N[p.e[0]], b = N[p.e[1]];
      if (p.t >= 1){ b.f = 1; return false; }
      var x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t; cx.fillStyle = "rgba(255,255,255,.9)"; cx.beginPath(); cx.arc(x, y, 1.8 * DPR, 0, 6.283); cx.fill(); return true; });
    N.forEach(function(n){ var r = (1.6 + n.f * 3) * DPR;
      cx.fillStyle = "rgba(" + Math.round(140 + 115 * n.f) + "," + Math.round(120 + 135 * n.f) + ",255," + (.35 + .65 * n.k) + ")";
      cx.beginPath(); cx.arc(n.x, n.y, r, 0, 6.283); cx.fill();
      if (n.f > .5){ cx.fillStyle = "rgba(167,139,250,.18)"; cx.beginPath(); cx.arc(n.x, n.y, r * 4, 0, 6.283); cx.fill(); } });
    cx.globalCompositeOperation = "source-over";
    if (t > 1.75) $("#intro").classList.add("logo");
    if (t > 1.75) cv.style.opacity = Math.max(.25, 1 - (t - 1.75) * 1.2);
    if (t > 2.9){ finishIntro(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  $("#intro").addEventListener("pointerdown", finishIntro);
}

/* ================= boot ================= */
var start = 0; try { start = +sessionStorage.getItem("nl-world") || 0; } catch(e){}
requestAnimationFrame(function(){ track.scrollLeft = start * track.clientWidth; onScroll(); });
if (location.hash === "#skip" || matchMedia("(prefers-reduced-motion: reduce)").matches) finishIntro();
else if (document.fonts && document.fonts.ready) document.fonts.ready.then(intro); else intro();

/* Android back on this screen exits the app */
window.nlBack = function(){ return false; };
window.NLWORLDS = {go: go, shatter: shatter, cur: function(){ return CUR; }};
})();
