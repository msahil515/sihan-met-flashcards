/* Name Lock world select, Sunset City. Intro (logo built out of firing neurons over
   the dusk city), profile HUD, a painted city where every world is a landmark pin:
   arrows, dots, a pin tap or a swipe fly the camera there; padlocks pop on unlock;
   the camera dives into the pin to enter; per-world ambient music. Reads the same
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
/* JSS Interview levels, same pattern ("jss-" + level key) */
var JSSL = ((window.NL_VIVA || {}).jss || {levels: []}).levels;
var JSS = JSSL.map(function(l){ return ["jss-" + l.k, l.name, l.icon]; });
var jssW = JSS.filter(function(m){ return won(m[0]); }).length;
var nextJss = JSS.filter(function(m){ return !won(m[0]); })[0];
var jssT = 0, jssN = 0; JSSL.forEach(function(l){ (l.cards || []).forEach(function(c){ jssT++; if (gv[c.id] && +gv[c.id].k) jssN++; }); });

var WORLDS = [
  {id: "wsw", x: .105, y: .42, kick: "WORLD 1", name: "Who Said What", tag: "A city of theorist statues",
    c: ["#fff1b8", "#ffd34e", "#785600"], pc: "#ffd34e", pd: "#b58a13", spin: 48, built: true, open: true,
    prog: wins / MAP.length, best: +best.combo ? best.combo + " in a row" : "--", next: nextB ? nextB[2] + " " + nextB[1] : "All won 🏆"},
  {id: "bio", x: .80, y: .60, kick: "WORLD 2", name: "Biopsych", tag: "A glowing brain with pulsing neurons",
    c: ["#8bb8ff", "#2563eb", "#1745ad"], pc: "#8bb8ff", pd: "#1745ad", spin: 40, built: true, open: true,
    lockText: "", prog: bioW / BIO.length, best: +best.combo ? best.combo + " in a row" : "--", next: nextBio ? nextBio[2] + " " + nextBio[1] : "All won 🏆"},
  {id: "dis", x: .66, y: .26, kick: "WORLD 3", name: "Dissertation", tag: "Your own study, the way a viva panel walks it",
    c: ["#8fe0c0", "#087f5b", "#07583f"], pc: "#54b995", pd: "#07583f", spin: 60, built: true, open: true,
    lockText: "", prog: DIS.length ? disW / DIS.length : 0, best: disN + "/" + disT, bestK: "Nailed", next: nextDis ? nextDis[2] + " " + nextDis[1] : "All cleared 🏆", nextK: "Next level"},
  {id: "jss", x: .265, y: .52, kick: "WORLD 4", name: "JSS Interview", tag: "The panel room: openers, your work, cases, ethics, law, definitions",
    c: ["#ffab9d", "#ff755f", "#bd493b"], pc: "#ffab9d", pd: "#bd493b", spin: 52, built: true, open: true,
    lockText: "", prog: JSS.length ? jssW / JSS.length : 0, best: jssN + "/" + jssT, bestK: "Nailed", next: nextJss ? nextJss[2] + " " + nextJss[1] : "All cleared 🏆", nextK: "Next level"},
  {id: "stats", x: .43, y: .17, kick: "WORLD 5", name: "Stats and Research", tag: "A lab world of data towers and graphs",
    c: ["#8bb8ff", "#2563eb", "#1745ad"], pc: "#8bb8ff", pd: "#1745ad", spin: 56, built: false, open: won("pinel-final") || DEMO,
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
  {pad: [87.31, 130.81, 174.61, 261.63], type: "triangle", cut: 1000, lfo: .08, step: 1.1, notes: [523.25, 587.33, 698.46, 783.99, 880], voice: "sine", vol: .03, dur: 1.4},
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

/* ================= the city map ================= */
var ART = {w: 1536, h: 1024};
var ICON = {
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
var wrap = $("#mapwrap"), map = $("#map"), dots = $("#dots"), CUR = -1, MW = 0, MH = 0;
function isLocked(i){ var w = WORLDS[i]; return !(w.open && (seen[w.id] || i === 0)); }
function esc(t){ return String(t).replace(/[&<>"]/g, function(c){ return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
WORLDS.forEach(function(w, i){
  var b = document.createElement("button");
  b.className = "pin"; b.dataset.w = i; b.setAttribute("aria-label", w.name);
  b.innerHTML = '<span class="beacon"></span><span class="badge"></span><span class="plate"></span>';
  map.appendChild(b);
  b.onclick = function(){ tapWorld(i); };
  dots.insertAdjacentHTML("beforeend", '<i role="button" aria-label="' + esc(w.name) + '"></i>');
});
var pins = [].slice.call(map.querySelectorAll(".pin"));
function paintPin(i){
  var p = pins[i], lk = isLocked(i);
  p.classList.toggle("locked", lk); p.classList.toggle("on", i === CUR);
  $(".badge", p).innerHTML = lk ? ICON.lock : "<b>" + (i + 1) + "</b>";
  $(".plate", p).textContent = lk && i !== CUR ? "Locked" : WORLDS[i].name;
}
function wide(){ return innerWidth >= 900 && innerWidth >= innerHeight; }
function layout(){
  /* sideways the city is drawn a bit larger than the screen so the camera has room to travel */
  var wd = wide(), h = wd ? innerHeight : Math.round(innerHeight * .82);
  MH = Math.max(wd ? Math.round(innerHeight * 1.3) : h, Math.round(innerWidth * ART.h / ART.w)); MW = Math.round(MH * ART.w / ART.h);
  wrap.style.setProperty("--mh", h + "px");
  map.style.width = MW + "px"; map.style.height = MH + "px";
  pins.forEach(function(p, i){ p.style.left = Math.round(WORLDS[i].x * MW) + "px"; p.style.top = Math.round(WORLDS[i].y * MH) + "px"; });
}
/* fly the camera so the chosen pin sits in the open sky between the HUD and the sheet */
function aim(animate, zoom){
  if (CUR < 0) return;
  /* offsets, not client rects: the sheet is still sliding in during the intro */
  var w = WORLDS[CUR], tp = $("#top"), sh = $("#sheet"), vh = wrap.clientHeight, cx, cy;
  cx = innerWidth / 2; cy = (tp.offsetTop + tp.offsetHeight + Math.min(sh.offsetTop, vh)) / 2 + 30;
  var k = zoom || 1, tx = Math.max(Math.min(cx - w.x * MW * k, 0), innerWidth - MW * k), ty = Math.max(Math.min(cy - w.y * MH * k, 0), Math.min(0, vh - MH * k));
  if (zoom){ tx = cx - w.x * MW * k; ty = cy - w.y * MH * k; }
  if (!animate) map.style.transition = "none";
  map.style.transform = "translate3d(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px,0) scale(" + k + ")";
  if (!animate){ void map.offsetWidth; map.style.transition = ""; }
}
function sheet(){
  var w = WORLDS[CUR], lk = isLocked(CUR), pct = Math.round(w.prog * 100), sh = $("#sheet");
  $("#w-kick").textContent = "World " + (CUR + 1) + " of " + WORLDS.length;
  $("#w-name").textContent = w.name; $("#w-tag").textContent = w.tag;
  $("#w-stats").innerHTML = lk
    ? '<div class="ring lock"><b>' + ICON.lock.replace("<svg", '<svg width="26" height="26"') + '</b></div><div class="wstat"><b>Locked</b><span></span></div><div class="wstat"><b>' + esc(w.next) + '</b><span>' + (w.open ? w.nextK || "Next boss" : "Boss") + '</span></div>'
    : '<div class="ring" style="--p:' + pct + '"><b>' + pct + '%</b></div><div class="wstat"><b>' + esc(w.best) + '</b><span>' + (w.bestK || "Best combo") + '</span></div><div class="wstat"><b>' + esc(w.next) + '</b><span>' + (w.nextK || "Next boss") + '</span></div>';
  var go = $("#w-go");
  go.className = "btn" + (lk || !w.built ? " ghost" : "");
  go.innerHTML = !w.open ? ICON.lock.replace("<svg", '<svg style="width:20px;height:20px"') + " " + esc(w.lockText) : !w.built ? "Being built, next up" : "Enter world " + ICON.next;
  sh.classList.remove("swap"); void sh.offsetWidth; sh.classList.add("swap");
}
function toast(t){ var el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(function(){ el.classList.remove("on"); }, 2600); }

function tapWorld(i){
  audio(); var w = WORLDS[i];
  if (i !== CUR){ go(i); return; }
  if (isLocked(i)){
    var p = pins[i]; p.classList.remove("shake"); void p.offsetWidth; p.classList.add("shake"); thunk(); buzz([30, 40, 30]); toast("🔒 " + w.lockText); return; }
  if (!w.built){ buzz([12]); toast(w.name + " is being built. It's next on the list."); return; }
  dive(i);
}
function dive(i){
  var w = WORLDS[i], r = pins[i].getBoundingClientRect(), f = $("#flash");
  document.body.classList.add("diving");
  f.style.setProperty("--fx", (r.left + r.width / 2) + "px"); f.style.setProperty("--fy", (r.top + r.height / 2) + "px"); f.classList.add("on");
  aim(true, 2.6); if (window.SUN) SUN.burstAt(pins[i], 50); whoosh(); stopAmb(); buzz([15, 40, 25, 40, 70]);
  setTimeout(function(){ location.href = "index.html#" + (w.id === "bio" || w.id === "dis" || w.id === "jss" ? w.id : "map"); }, 1150);
}
/* this screen draws once from localStorage; when sync.js then pulls the other device's progress, redraw (skip the intro, at most every 30s) */
window.addEventListener("sihan-sync", function(e){
  if (!e.detail || !e.detail.pulled || document.body.classList.contains("diving")) return;
  try { if (Date.now() - (+sessionStorage.getItem("nl-wsync") || 0) < 30000) return; sessionStorage.setItem("nl-wsync", Date.now()); } catch(x){ return; }
  history.replaceState(null, "", location.pathname + "#skip"); location.reload();
});
window.addEventListener("pageshow", function(e){ if (e.persisted){ document.body.classList.remove("diving"); $("#flash").classList.remove("on"); aim(false); } });

/* a newly opened world: the padlock pops off its pin */
function shatter(i){
  var w = WORLDS[i];
  if (!isLocked(i) || !w.open) return;
  seen[w.id] = 1; if (!DEMO) localStorage.setItem(SEEN, JSON.stringify(seen));
  setTimeout(function(){
    paintPin(i); var p = pins[i]; p.classList.remove("pop"); void p.offsetWidth; p.classList.add("pop");
    if (window.SUN) SUN.burstAt($(".badge", p), 70);
    if (i === CUR) sheet();
    shatterSfx(); buzz([20, 30, 20, 30, 90]); toast("🔓 " + w.name + " unlocked");
  }, 500);
}

/* ================= camera behaviour ================= */
function setCur(i, animate){
  var prev = CUR; CUR = i; var w = WORLDS[i];
  [].forEach.call(dots.children, function(d, k){ d.className = k === i ? "on" : ""; });
  pins.forEach(function(p, k){ paintPin(k); });
  if (prev !== i) sheet();
  aim(animate);
  startAmb(i);
  if (READY && w.open && !seen[w.id]) shatter(i);
  try { sessionStorage.setItem("nl-world", i); } catch(e){}
}
function go(i){ i = (i + WORLDS.length) % WORLDS.length; if (i === CUR) return; setCur(i, true); buzz([10]); }
window.addEventListener("resize", function(){ layout(); aim(false); });
$("#prev").onclick = function(){ go(CUR - 1); };
$("#next").onclick = function(){ go(CUR + 1); };
$("#w-go").onclick = function(){ tapWorld(CUR); };
[].forEach.call(dots.children, function(d, k){ d.onclick = function(){ go(k); }; });
document.addEventListener("keydown", function(e){ if (e.key === "ArrowLeft") go(CUR - 1); else if (e.key === "ArrowRight") go(CUR + 1); else if (e.key === "Enter" && !e.target.closest("button")) tapWorld(CUR); });
/* swipe the city to fly to the next or previous world */
var sx0 = null, sy0 = 0;
wrap.addEventListener("pointerdown", function(e){ sx0 = e.clientX; sy0 = e.clientY; });
document.addEventListener("pointerup", function(e){
  if (sx0 == null) return; var dx = e.clientX - sx0, dy = e.clientY - sy0; sx0 = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(CUR + (dx < 0 ? 1 : -1));
});
document.addEventListener("pointercancel", function(){ sx0 = null; });

/* mute */
var SPK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/>',
  WAVES = '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  OFFX = '<path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function drawMute(){ $("#mute").innerHTML = SPK + (S.sound ? WAVES : OFFX); $("#mute").setAttribute("aria-label", S.sound ? "Mute" : "Unmute"); }
$("#mute").onclick = function(){ S.sound = !S.sound; saveS(); drawMute(); if (audio()){ master.gain.setTargetAtTime(S.sound ? 1 : 0, AC.currentTime, .15); startAmb(CUR); } };
drawMute();
/* browsers only allow audio after a gesture: first touch anywhere starts the music */
document.addEventListener("pointerdown", function first(){ document.removeEventListener("pointerdown", first, true);
  if (audio()){ if (AC.state === "suspended") AC.resume(); if (READY) startAmb(CUR); } }, true);

/* profile HUD */
(function(){
  var xp = +g.xp || 0, l = level(xp), lo = LV[l - 1], hi = LV[l], s = streak(), pct = hi == null ? 100 : Math.round((xp - lo) * 100 / (hi - lo));
  $("#p-lv").textContent = l; $("#p-name").textContent = (S.name || "Sihan").trim() || "Sihan"; $("#p-rank").textContent = rank(l);
  $("#p-xp").textContent = hi != null ? (hi - xp) + " XP to level " + (l + 1) : xp + " XP, max level";
  $("#p-ring").style.setProperty("--p", pct + "%"); $("#p-xpf").dataset.w = pct + "%";
  $("#p-stn").textContent = s; $("#p-st").title = s + " day streak"; if (done(ymd(new Date()))) $("#p-st").classList.add("lit");
})();

if (window.SUN) SUN.motes($("#motes"));
var DPR = Math.min(2, window.devicePixelRatio || 1);

/* ================= intro: logo assembled by firing neurons ================= */
var READY = false;
function finishIntro(){
  if (READY) return; READY = true; INTRO.stop = true;
  document.body.classList.add("ready");
  setTimeout(function(){ $("#p-xpf").style.width = $("#p-xpf").dataset.w; }, 50);
  if (CUR < 0) return;
  if (AC) startAmb(CUR);
  var w = WORLDS[CUR]; if (w.open && !seen[w.id]) shatter(CUR);
}
var INTRO = {stop: false};
function intro(){
  var cv = $("#neuro"), cx = cv.getContext("2d"), W = cv.width = innerWidth * DPR, H = cv.height = innerHeight * DPR;
  var fs = Math.min(innerWidth * .17, 104) * DPR, off = document.createElement("canvas"), ox = off.getContext("2d");
  off.width = W; off.height = H; ox.fillStyle = "#fff"; ox.textAlign = "center"; ox.textBaseline = "middle";
  ox.font = "800 " + fs + "px Bricolage, Figtree, system-ui, sans-serif";
  try { ox.fontStretch = "condensed"; ox.letterSpacing = (fs * .01) + "px"; } catch(e){}
  var ty = H / 2 - 16 * DPR; ox.fillText("NAME LOCK", W / 2, ty);
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
      if (al < .01) return; cx.strokeStyle = "rgba(255,226,170," + (al * 1.6) + ")"; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); });
    pulses = pulses.filter(function(p){ p.t += .07; var a = N[p.e[0]], b = N[p.e[1]];
      if (p.t >= 1){ b.f = 1; return false; }
      var x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t; cx.fillStyle = "rgba(255,250,232,.95)"; cx.beginPath(); cx.arc(x, y, 1.8 * DPR, 0, 6.283); cx.fill(); return true; });
    N.forEach(function(n){ var r = (1.6 + n.f * 3) * DPR;
      cx.fillStyle = "rgba(255," + Math.round(200 + 40 * n.f) + "," + Math.round(120 + 90 * n.f) + "," + (.4 + .6 * n.k) + ")";
      cx.beginPath(); cx.arc(n.x, n.y, r, 0, 6.283); cx.fill();
      if (n.f > .5){ cx.fillStyle = "rgba(255,194,75,.22)"; cx.beginPath(); cx.arc(n.x, n.y, r * 4, 0, 6.283); cx.fill(); } });
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
layout(); setCur(Math.max(0, Math.min(WORLDS.length - 1, start)), false);
if (location.hash === "#skip" || matchMedia("(prefers-reduced-motion: reduce)").matches) finishIntro();
else if (document.fonts && document.fonts.load) document.fonts.load("800 100px Bricolage").then(intro, intro); else intro();

/* Android back on this screen exits the app */
window.nlBack = function(){ return false; };
window.NLWORLDS = {go: go, shatter: shatter, cur: function(){ return CUR; }};
})();
