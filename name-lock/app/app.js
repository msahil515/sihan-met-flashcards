/* Name Lock app. One file: state, game rules, screens.
   Progress lives in namelock-progress-v1 with the same shape as the web page
   (P.c spaced repetition, P.m misses, P.g game), so the two stay compatible. */
(function(){
"use strict";
var CARDS = window.NL_CARDS || [], PYQ = window.NL_PYQ || {}, MOCKS = window.NL_MOCKS || {};
var BY = {}; CARDS.forEach(function(c){ BY[c.id] = c; });
var CATNAME = {effect: "Effect", bias: "Bias", phenomenon: "Phenomenon", experiment: "Experiment", law: "Law", term: "Term"};
var CATS = [["all", "All"], ["effect", "Effects"], ["bias", "Biases"], ["phenomenon", "Phenomena"], ["experiment", "Experiments"], ["law", "Laws"], ["term", "Terms"], ["pyq", "In PYQs"]];
var KEY = "namelock-progress-v1", SKEY = "namelock-app-settings";
var DAY = 864e5, GAPS = [0, 1, 3, 7, 16, 35];
var $ = function(s, r){ return (r || document).querySelector(s); };

/* ================= state ================= */
function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ return {}; } }
var P = load(); P.c = P.c || {}; P.m = P.m || {};
function save(){ try { localStorage.setItem(KEY, JSON.stringify(P)); } catch(e){} }
var S = {sound: true, haptics: true, onboarded: false};
try { Object.assign(S, JSON.parse(localStorage.getItem(SKEY)) || {}); } catch(e){}
function saveS(){ localStorage.setItem(SKEY, JSON.stringify(S)); }

function G(){ var g = P.g = P.g || {};
  g.xp = +g.xp || 0; g.days = g.days || {}; g.th = g.th || {}; g.boss = g.boss || {};
  g.bdg = g.bdg || {}; g.best = g.best || {}; g.st = g.st || {}; g.q = g.q || {}; g.goal = +g.goal || 10;
  [g.best, g.st].forEach(function(o){ for (var k in o) o[k] = +o[k] || 0; });
  for (var a in g.boss){ var b = g.boss[a] || {}; g.boss[a] = {w: +b.w || 0, bl: +b.bl || 0, tries: +b.tries || 0}; }
  for (var t in g.days){ var r = g.days[t] || {}; g.days[t] = {a: +r.a || 0, x: +r.x || 0}; }
  return g; }
function today(d){ d = d ? new Date(d) : new Date();
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function dayRec(){ var g = G(), t = today(); return g.days[t] || (g.days[t] = {a: 0, x: 0}); }
function bump(k, n){ var st = G().st; st[k] = (st[k] || 0) + (n || 1); return st[k]; }
function setBest(k, v){ var b = G().best; if (v > (b[k] || 0)){ b[k] = v; return true; } return false; }

/* ================= helpers ================= */
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
function shuffle(a){ for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function norm(s){ return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function plural(n, w){ return n + " " + w + (n === 1 ? "" : "s"); }
var IC = {
  home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.3 3.3a1 1 0 0 1 1.4 0l8 7.6c.6.6.2 1.6-.7 1.6H19v7a1.5 1.5 0 0 1-1.5 1.5H15v-5.5h-6V21H6.5A1.5 1.5 0 0 1 5 19.5v-7H4c-.9 0-1.3-1-.7-1.6z"/></svg>',
  practice: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13.2c-.4.5 0 1.3.7 1.3H11l-1 7.5 8.5-11.2c.4-.5 0-1.3-.7-1.3H12z"/></svg>',
  cards: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="12" height="16" rx="2.5" transform="rotate(-8 9 13)" opacity=".55"/><rect x="9" y="3" width="12" height="16" rx="2.5"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5"/><path d="M3.5 20.5c0-4.2 3.8-7 8.5-7s8.5 2.8 8.5 7c0 .6-.4 1-1 1h-15c-.6 0-1-.4-1-1z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};
var LOGO = '<svg viewBox="0 0 108 108"><rect width="108" height="108" rx="24" fill="#5B4BDB"/><path d="M0 70L108 40V84a24 24 0 0 1-24 24H24A24 24 0 0 1 0 84z" fill="#4E3FCC"/><path d="M42 50V41a12 12 0 0 1 24 0v9" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/><rect x="32" y="48" width="44" height="33" rx="7" fill="#FFC93C"/><path d="M54 57a5 5 0 0 1 2.5 9.33V72h-5v-5.67A5 5 0 0 1 54 57z" fill="#3B2DB0"/></svg>';

/* ================= feel: sound + haptics + confetti ================= */
var AC = null;
function tone(notes, type, vol){
  if (!S.sound) return;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch(e){ return; }
  var t = AC.currentTime;
  notes.forEach(function(n){ var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || "sine"; o.frequency.value = n[0];
    g.gain.setValueAtTime(0.0001, t + n[1]); g.gain.exponentialRampToValueAtTime(vol || 0.16, t + n[1] + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + n[2]);
    o.connect(g); g.connect(AC.destination); o.start(t + n[1]); o.stop(t + n[1] + n[2] + 0.05); });
}
var SFX = {
  tap: function(){ tone([[660, 0, .05]], "sine", .05); },
  ok: function(){ tone([[784, 0, .1], [1175, .08, .22]], "sine", .14); },
  bad: function(){ tone([[247, 0, .14], [196, .1, .26]], "triangle", .16); },
  combo: function(n){ var b = 660 * Math.pow(1.06, Math.min(n, 12)); tone([[b, 0, .08], [b * 1.5, .06, .16]], "sine", .12); },
  level: function(){ tone([[523, 0, .16], [659, .12, .16], [784, .24, .16], [1047, .36, .45]], "square", .06); },
  win: function(){ tone([[392, 0, .14], [523, .12, .14], [659, .24, .14], [784, .36, .14], [1047, .5, .55]], "square", .06); },
  lose: function(){ tone([[392, 0, .25], [330, .22, .25], [262, .44, .5]], "triangle", .14); },
  badge: function(){ tone([[988, 0, .1], [1319, .1, .32]], "sine", .14); },
  crack: function(){ tone([[160, 0, .3], [120, .1, .3]], "sawtooth", .05); }
};
function buzz(p){
  if (!S.haptics) return;
  try { if (window.NLNative) NLNative.vibrate(p.join(",")); else if (navigator.vibrate) navigator.vibrate(p); } catch(e){}
}
var HAP = {tap: [8], ok: [14], bad: [35, 50, 35], big: [20, 60, 20, 60, 50]};
function confetti(n){
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var app = $("#app"), cv = document.createElement("canvas"), W = cv.width = app.clientWidth, H = cv.height = app.clientHeight, x = cv.getContext("2d");
  cv.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:80";
  app.appendChild(cv);
  var cols = ["#ffc93c", "#3ddc84", "#4aa3ff", "#ff5a5f", "#a78bfa", "#ff9f1c"], ps = [];
  for (var i = 0; i < (n || 140); i++) ps.push({x: W / 2 + (Math.random() - .5) * W * .4, y: H * .38, vx: (Math.random() - .5) * 15, vy: -Math.random() * 14 - 4,
    s: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length]});
  var t0 = performance.now();
  (function f(t){
    x.clearRect(0, 0, W, H);
    ps.forEach(function(p){ p.vy += .38; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (t - t0 < 2800) requestAnimationFrame(f); else cv.remove();
  })(t0);
}
function toast(html, kind){
  var box = $("#toasts"), d = document.createElement("div");
  d.className = "toast " + (kind || ""); d.innerHTML = html; box.appendChild(d);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(function(){ d.classList.add("out"); }, 2300); setTimeout(function(){ d.remove(); }, 2700);
}
document.addEventListener("click", function(e){ if (e.target.closest("button")){ SFX.tap(); buzz(HAP.tap); } }, true);

/* ================= levels + streak ================= */
var LV = [0,150,350,600,900,1300,1800,2400,3100,4000,5000,6200,7600,9200,11000];
function rank(l){ return l <= 3 ? "Intern" : l <= 6 ? "Resident" : l <= 9 ? "Senior Resident" : l <= 12 ? "Consultant" : "NIMHANS Topper"; }
function level(xp){ var l = 1; for (var i = 1; i < LV.length; i++) if (xp >= LV[i]) l = i + 1; return l; }
function lvInfo(xp){ var l = level(xp), lo = LV[l - 1], hi = LV[l] == null ? null : LV[l];
  return {l: l, rank: rank(l), lo: lo, hi: hi, pct: hi == null ? 100 : Math.round((xp - lo) * 100 / (hi - lo))}; }
function goal(){ return G().goal; }
function dayDone(r){ return r && r.a >= goal(); }
function streak(){
  var g = G(), d = new Date(), n = 0;
  if (!dayDone(g.days[today()])) d.setDate(d.getDate() - 1);
  while (dayDone(g.days[today(d)])){ n++; d.setDate(d.getDate() - 1); }
  return n;
}
var MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100];

/* ================= theorists ================= */
var PARTICLE = {von:1, van:1, de:1, der:1, of:1, la:1, le:1, du:1, da:1};
var NOTPEOPLE = {real:1, "case":1, unknown:1, various:1, gestalt:1, chicago:1, wurzburg:1};
function people(who){
  if (!who) return [];
  var out = [];
  who.replace(/\([^)]*\)/g, " ").split(/;|,|&|\band\b|\//).forEach(function(part){
    var toks = part.trim().split(/\s+/), run = [], best = [];
    toks.forEach(function(t){
      if (/^[A-ZÀ-Ý][A-Za-zà-ÿ'.\-]*$/.test(t) || (run.length && PARTICLE[t])) run.push(t);
      else { if (run.length) best = run; run = []; }
    });
    if (run.length) best = run;
    while (best.length && PARTICLE[best[best.length - 1]]) best.pop();
    var names = best.filter(function(t){ return !/\.$/.test(t) && t.length > 1; });
    if (!names.length) return;
    var key = names[names.length - 1].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\-]/g, "");
    if (!key || NOTPEOPLE[key] || /^(dr|prof|reported|studied)$/.test(key)) return;
    if (/^(Dr|Prof|Reported|Studied)$/.test(best[0])) best = best.slice(1);
    out.push([key, best.join(" ")]);
  });
  return out;
}
var TH = {}, CARD_TH = {};
CARDS.forEach(function(c){
  var ks = [];
  people(c.who).forEach(function(p){
    var t = TH[p[0]] || (TH[p[0]] = {k: p[0], name: p[1], cards: []});
    if (p[1].length > t.name.length) t.name = p[1];
    if (t.cards.indexOf(c.id) < 0) t.cards.push(c.id);
    if (ks.indexOf(p[0]) < 0) ks.push(p[0]);
  });
  CARD_TH[c.id] = ks;
});
var TH_LIST = Object.keys(TH).map(function(k){ return TH[k]; }).sort(function(a, b){ return b.cards.length - a.cards.length || a.name.localeCompare(b.name); });
function rarity(t){ return t.cards.length >= 5 ? "legendary" : t.cards.length >= 2 ? "rare" : "common"; }
var UNLOCK = 3;
function thState(k){ var s = G().th[k]; return !s || (s.r || 0) < UNLOCK ? "locked" : s.cr ? "cracked" : "ok"; }
function thUnlocked(){ return TH_LIST.filter(function(t){ return thState(t.k) !== "locked"; }).length; }
function initials(name){ var p = name.replace(/[^A-Za-zÀ-ÿ\s\-]/g, "").split(/\s+/).filter(Boolean); return ((p.length > 1 ? p[0][0] : "") + p[p.length - 1][0]).toUpperCase(); }
function hue(s){ var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
function tcHtml(t, big){
  var s = thState(t.k), r = (G().th[t.k] || {}).r || 0, h = hue(t.k), shown = s !== "locked" || r > 0 || big;
  var stars = ""; for (var i = 0; i < UNLOCK; i++) stars += i < Math.min(r, UNLOCK) ? "★" : "☆";
  return '<button class="tc ' + rarity(t) + ' ' + s + '" data-th="' + t.k + '"><span class="av" style="background:linear-gradient(150deg,hsl(' + h + ',62%,58%),hsl(' + ((h + 40) % 360) + ',58%,38%))">' +
    (s === "locked" && !big ? "?" : esc(initials(t.name))) + '</span><b>' + (shown ? esc(t.name) : "???") + '</b>' +
    '<span class="stars">' + (s === "locked" ? stars : "") + '</span><span class="rr">' + (s === "cracked" ? "Cracked" : rarity(t)) + ' · ' + t.cards.length + '</span></button>';
}

/* ================= bosses ================= */
var MAP = [
  ["history", "Structuralism Boss", "Schools and history", "🏛️"],
  ["perception", "Gestalt Boss", "Perception and illusions", "👁️"],
  ["positive", "Positive Psych Boss", "Flow, PERMA, well-being", "🌞"],
  ["learning", "Skinner Box Boss", "Conditioning and learning", "🐀"],
  ["memory", "Ebbinghaus Boss", "Memory effects, amnesias", "🧠"],
  ["cognitive", "Heuristics Boss", "Thinking and attention", "🧩"],
  ["biological", "Broca Boss", "Brain, lesions, aphasias", "⚡"],
  ["developmental", "Piaget Boss", "Development, attachment", "🧸"],
  ["personality", "Freud Boss", "Personality, defences", "🛋️"],
  ["social", "Social Psych Boss", "Conformity, groups", "👥"],
  ["clinical", "Ward Round Boss", "Signs and syndromes", "🩺"],
  ["research", "Placebo Boss", "Methods and artefacts", "🧪"],
  ["all", "NIMHANS Final Boss", "15 from everywhere", "👑"]
];
function bossOpen(i){ return i === 0 || !!(G().boss[MAP[i - 1][0]] || {}).w; }
function bossWins(){ return MAP.filter(function(m){ return (G().boss[m[0]] || {}).w; }).length; }
function curBoss(){ for (var i = 0; i < MAP.length; i++) if (!(G().boss[MAP[i][0]] || {}).w) return i; return -1; }

/* ================= quests ================= */
function hasRealPyq(c){ return (PYQ[c.id] || []).some(function(h){ return MOCKS[h[0]] && MOCKS[h[0]].p; }); }
var QUESTS = [
  {id: "exp5", t: "Name 5 experiments", e: "🧪", n: 5, f: function(e){ return e.ok && e.c.cat === "experiment"; }},
  {id: "bias3", t: "Clear 3 biases", e: "🎯", n: 3, f: function(e){ return e.ok && e.c.cat === "bias"; }},
  {id: "eff5", t: "Get 5 effects right", e: "✨", n: 5, f: function(e){ return e.ok && e.c.cat === "effect"; }},
  {id: "phen4", t: "Get 4 phenomena right", e: "🌀", n: 4, f: function(e){ return e.ok && e.c.cat === "phenomenon"; }},
  {id: "law3", t: "Get 3 laws right", e: "⚖️", n: 3, f: function(e){ return e.ok && e.c.cat === "law"; }},
  {id: "term6", t: "Decode 6 terms", e: "🔤", n: 6, f: function(e){ return e.ok && e.c.cat === "term"; }},
  {id: "ans25", t: "Answer 25 cards", e: "📚", n: 25, f: function(){ return true; }},
  {id: "combo5", t: "Hit a 5x duel combo", e: "🔥", n: 5, combo: true},
  {id: "duel8", t: "Win 8 lookalike duels", e: "⚔️", n: 8, f: function(e){ return e.ok && e.src === "duel"; }},
  {id: "pyq5", t: "Get 5 PYQ cards right", e: "📝", n: 5, f: function(e){ return e.ok && hasRealPyq(e.c); }},
  {id: "who5", t: "Name the person 5 times", e: "🧑‍🔬", n: 5, f: function(e){ return e.ok && e.mode === "who"; }},
  {id: "boss1", t: "Beat a boss", e: "👑", n: 1, f: function(e){ return e.bossWin; }},
  {id: "fix2", t: "Clear 2 cards from misses", e: "🩹", n: 2, f: function(e){ return e.cleared; }}
];
function seedRand(s){ var h = 2166136261; for (var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function(){ h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6; }; }
function todaysQuests(){ var r = seedRand("nlq" + today()), pool = QUESTS.slice(), out = [];
  while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); return out; }
var QUEST_XP = 50, QUEST_ALL_XP = 100;

/* ================= badges ================= */
function rightIn(cat){ var n = 0; CARDS.forEach(function(c){ var s = P.c[c.id]; if (s && c.cat === cat && s.n - s.w > 0) n++; }); return n; }
var BADGES = [
  ["first", "🎉", "First Blood", "Get your first card right", function(){ return (G().st.right || 0) >= 1; }],
  ["perfect", "💯", "Flawless Lesson", "Finish a lesson with zero mistakes", function(){ return (G().st.perfect || 0) >= 1; }],
  ["boss1", "🗡️", "Boss Slayer", "Beat your first boss", function(){ return bossWins() >= 1; }],
  ["flawless", "🛡️", "Untouchable", "Beat a boss with all 3 hearts", function(){ return MAP.some(function(m){ return (G().boss[m[0]] || {}).bl === 3; }); }],
  ["map", "🗺️", "Map Cleared", "Beat every area boss", function(){ return bossWins() >= MAP.length - 1; }],
  ["final", "👑", "NIMHANS Ready", "Beat the Final Boss", function(){ return !!(G().boss.all || {}).w; }],
  ["combo10", "🔥", "Combo Breaker", "10 duels right in a row", function(){ return (G().best.combo || 0) >= 10; }],
  ["duel100", "⚔️", "Duelist", "Win 100 lookalike duels", function(){ return (G().st.duels || 0) >= 100; }],
  ["speed", "⚡", "Speed Demon", "20 right in one speed round", function(){ return (G().best.speed || 0) >= 20; }],
  ["revenge", "💀", "Revenge Served", "Win a revenge round", function(){ return (G().st.rev || 0) >= 1; }],
  ["quests", "📜", "Quest Master", "Finish all 3 quests in a day", function(){ return (G().st.qall || 0) >= 1; }],
  ["bias", "🎯", "Bias Buster", "25 different biases right", function(){ return rightIn("bias") >= 25; }],
  ["exp", "🧪", "Lab Rat", "40 different experiments right", function(){ return rightIn("experiment") >= 40; }],
  ["eff", "✨", "Effect Expert", "40 different effects right", function(){ return rightIn("effect") >= 40; }],
  ["phen", "🌀", "Phenomenal", "40 different phenomena right", function(){ return rightIn("phenomenon") >= 40; }],
  ["law", "⚖️", "Law Abiding", "30 different laws right", function(){ return rightIn("law") >= 30; }],
  ["term", "🔤", "Wordsmith", "75 different terms right", function(){ return rightIn("term") >= 75; }],
  ["s3", "🌱", "On a Roll", "3 day streak", function(){ return (G().best.streak || 0) >= 3; }],
  ["s7", "📅", "Week Locked", "7 day streak", function(){ return (G().best.streak || 0) >= 7; }],
  ["s30", "🏆", "Month of Iron", "30 day streak", function(){ return (G().best.streak || 0) >= 30; }],
  ["col10", "🃏", "Collector", "Unlock 10 theorists", function(){ return thUnlocked() >= 10; }],
  ["col50", "🗃️", "Dex Pro", "Unlock 50 theorists", function(){ return thUnlocked() >= 50; }],
  ["founders", "🏛️", "Founding Fathers", "Unlock Wundt, Titchener, James", function(){ return ["wundt", "titchener", "james"].every(function(k){ return thState(k) !== "locked"; }); }],
  ["res", "🩻", "Resident", "Reach level 4", function(){ return level(G().xp) >= 4; }],
  ["cons", "🎓", "Consultant", "Reach level 10", function(){ return level(G().xp) >= 10; }],
  ["top", "🌟", "NIMHANS Topper", "Reach level 13", function(){ return level(G().xp) >= 13; }]
];

/* ================= celebrations: queued while in a lesson, shown after ================= */
var CQ = [], holdCeleb = false;
function celebrate(c){ CQ.push(c); if (!holdCeleb) flushCeleb(); }
function flushCeleb(){
  if ($("#modal").classList.contains("on") || !CQ.length) return;
  var c = CQ.shift(), h = "";
  if (c.t === "level"){ var i = lvInfo(G().xp);
    h = '<div class="k">Level up</div><div class="crest">' + i.l + '</div><h2>' + i.rank + '</h2><p>You reached level ' + i.l + '. ' + (i.hi != null ? (i.hi - G().xp) + ' XP to the next one.' : 'Max level. Nothing left to prove.') + '</p>';
    SFX.level(); buzz(HAP.big); confetti(200); }
  else if (c.t === "theorist"){ var t = TH[c.k];
    h = '<div class="k">New theorist unlocked</div>' + tcHtml(t, true) + '<h2>' + esc(t.name) + '</h2><p>' + plural(t.cards.length, "card") + ' in the deck. Miss one later and this card cracks until you fix it.</p>';
    SFX.badge(); buzz(HAP.big); confetti(90); }
  else if (c.t === "badge"){ var b = c.b;
    h = '<div class="k">Badge earned</div><div class="big">' + b[1] + '</div><h2>' + b[2] + '</h2><p>' + b[3] + '</p>';
    SFX.badge(); buzz(HAP.big); confetti(110); }
  else if (c.t === "streak"){
    h = '<div class="k">Streak milestone</div><div class="big">🔥</div><h2>' + c.n + ' day streak</h2><p>+' + (c.n * 10) + ' XP bonus. Keep the flame alive tomorrow.</p>';
    SFX.win(); buzz(HAP.big); confetti(220); }
  else if (c.t === "quests"){
    h = '<div class="k">Daily quests</div><div class="big">📜</div><h2>All 3 done</h2><p>+' + QUEST_ALL_XP + ' XP bonus. New quests at midnight.</p>';
    SFX.win(); buzz(HAP.big); confetti(160); }
  var m = $("#modal");
  m.innerHTML = '<div class="mbox">' + h + '<button class="btn gold" id="m-ok">Continue</button></div>';
  m.classList.add("on");
  $("#m-ok").onclick = closeModal;
}
function closeModal(){ $("#modal").classList.remove("on"); $("#modal").innerHTML = ""; setTimeout(flushCeleb, 150); refreshTab(); }

/* ================= core scoring: every answer goes through here ================= */
function addXP(n){
  if (!n) return;
  var g = G(), before = level(g.xp);
  g.xp += n; dayRec().x += n; setBest("dayxp", dayRec().x);
  if (level(g.xp) > before) celebrate({t: "level"});
}
function questTick(ev){
  var g = G(), q = g.q[today()] || (g.q[today()] = {});
  todaysQuests().forEach(function(Q){
    if ((q[Q.id] || 0) >= Q.n) return;
    if (Q.combo){ if (ev.combo != null) q[Q.id] = Math.max(q[Q.id] || 0, ev.combo); }
    else if (Q.f(ev)) q[Q.id] = (q[Q.id] || 0) + 1;
    if ((q[Q.id] || 0) >= Q.n){ SFX.badge(); addXP(QUEST_XP); toast(Q.e + " Quest done: <b>" + Q.t + "</b> +" + QUEST_XP + " XP", "gold");
      if (todaysQuests().every(function(x){ return (q[x.id] || 0) >= x.n; })){ bump("qall"); addXP(QUEST_ALL_XP); celebrate({t: "quests"}); } }
  });
}
function badgeCheck(){
  var g = G();
  BADGES.forEach(function(b){ if (!g.bdg[b[0]] && b[4]()){ g.bdg[b[0]] = Date.now(); celebrate({t: "badge", b: b}); } });
}
/* ev: {c, ok, src, mode, mult, combo, cleared}; returns XP earned for the answer itself */
function answer(ev){
  var g = G(), c = ev.c, sBefore = streak(), xp = 0;
  dayRec().a++; bump("ans");
  if (ev.ok){ bump("right"); xp = 10 * (ev.mult || 1); addXP(xp); }
  (CARD_TH[c.id] || []).forEach(function(k){
    var t = g.th[k] || (g.th[k] = {r: 0}), name = TH[k].name;
    if (ev.ok){
      t.r = (t.r || 0) + 1;
      if (t.cr){ t.cr = 0; toast("🛠️ <b>" + esc(name) + "</b> card repaired", "good"); }
      else if (t.r === UNLOCK) celebrate({t: "theorist", k: k});
    } else if (t.r >= UNLOCK && !t.cr){ t.cr = 1; SFX.crack(); toast("💥 <b>" + esc(name) + "</b> card cracked. Get one of theirs right to fix it.", "bad"); }
  });
  if (dayRec().a === goal()){
    var s = streak(); setBest("streak", s);
    if (s > sBefore && MILESTONES.indexOf(s) >= 0){ addXP(s * 10); celebrate({t: "streak", n: s}); }
    else if (s > sBefore) toast("🔥 Daily goal hit. Streak: <b>" + plural(s, "day") + "</b>", "gold");
  }
  questTick(ev); badgeCheck(); save();
  return xp;
}

/* ================= spaced repetition + pools ================= */
function missIds(){ return Object.keys(P.m).filter(function(id){ return BY[id] && !P.m[id].done; }); }
function addMiss(id){ var e = P.m[id] || (P.m[id] = {src: [], t: Date.now()}); e.done = false; e.ok = 0; e.lt = Date.now(); if (e.src.indexOf("drill:0") < 0) e.src.push("drill:0"); }
function srs(c, ok){
  var s = P.c[c.id] || {b: 0, d: 0, n: 0, w: 0}, cleared = false;
  s.n++;
  if (ok){ s.b = Math.min(s.b + 1, GAPS.length - 1);
    var e = P.m[c.id]; if (e && !e.done){ e.ok = (e.ok || 0) + 1; if (e.ok >= 2){ e.done = true; cleared = true; } } }
  else { s.b = 0; s.w++; addMiss(c.id); }
  s.d = Date.now() + GAPS[s.b] * DAY;
  P.c[c.id] = s; save();
  return cleared;
}
function pool(cat){
  if (cat === "miss") return missIds().map(function(id){ return BY[id]; });
  if (cat === "pyq") return CARDS.filter(hasRealPyq);
  return cat === "all" ? CARDS.slice() : CARDS.filter(function(c){ return c.cat === cat; });
}
function pickRound(cat, n){
  var now = Date.now(), cs = pool(cat), mi = {}; missIds().forEach(function(id){ mi[id] = 1; });
  var due = [], miss = [], fresh = [];
  cs.forEach(function(c){ var s = P.c[c.id];
    if (s && s.d <= now) due.push(c); else if (mi[c.id]) miss.push(c); else if (!s) fresh.push(c); });
  due.sort(function(a, b){ return P.c[a.id].d - P.c[b.id].d; });
  var r = due.concat(shuffle(miss), shuffle(fresh)).slice(0, n);
  if (r.length < n) r = r.concat(shuffle(cs.filter(function(c){ return r.indexOf(c) < 0; })).slice(0, n - r.length));
  return shuffle(r);
}
function resolveLook(c){ return (c.lookId && BY[c.lookId]) || null; }
function distract(c, field, n){
  var out = [], seen = {}; seen[norm(c[field])] = 1;
  function add(x){ if (!x || x.id === c.id || !x[field]) return; var k = norm(x[field]); if (seen[k]) return;
    if (field === "who" && (norm(c.who).indexOf(k) >= 0 || k.indexOf(norm(c.who)) >= 0)) return;
    seen[k] = 1; out.push(x); }
  add(resolveLook(c));
  CARDS.forEach(function(x){ var l = resolveLook(x); if (l && l.id === c.id) add(x); });
  shuffle(CARDS.filter(function(x){ return x.cat === c.cat && x.area === c.area; })).forEach(add);
  shuffle(CARDS.filter(function(x){ return x.cat === c.cat; })).forEach(add);
  shuffle(CARDS.slice()).forEach(add);
  return out.slice(0, n);
}
var PAIRS = [];
(function(){ var seen = {}; CARDS.forEach(function(c){ var l = resolveLook(c); if (!l) return;
  var k = [c.id, l.id].sort().join("|"); if (seen[k]) return; seen[k] = 1; PAIRS.push([c, l]); }); })();
function revengePool(){ var cut = Date.now() - 7 * DAY;
  return missIds().filter(function(id){ var e = P.m[id]; return (e.lt || e.t || 0) >= cut; }); }
function pickBoss(ix){
  var area = MAP[ix][0], n = area === "all" ? 15 : 10;
  var cs = area === "all" ? CARDS.slice() : CARDS.filter(function(c){ return c.area === area; });
  var weak = shuffle(cs.filter(function(c){ var s = P.c[c.id]; return s && s.b < 2; })).slice(0, Math.ceil(n / 3));
  var rest = shuffle(cs.filter(function(c){ return weak.indexOf(c) < 0; }));
  return shuffle(weak.concat(rest).slice(0, n));
}

/* ================= screens stack ================= */
var STACK = [];
function pushScreen(id, html, onBack){
  var el = document.createElement("div"); el.className = "screen"; el.id = id; el.innerHTML = html;
  $("#screens").appendChild(el); STACK.push({id: id, el: el, onBack: onBack});
  return el;
}
function popScreen(){
  var s = STACK.pop(); if (!s) return;
  s.el.id = ""; s.el.classList.add("out"); setTimeout(function(){ s.el.remove(); }, 220);
  if (!STACK.length) refreshTab();
}
function clearScreens(){ while (STACK.length) popScreen(); }

/* ================= bottom sheet ================= */
function openSheet(html){ $("#sheet").innerHTML = html; $("#sheet").scrollTop = 0; $("#sheet-wrap").classList.add("on"); }
function closeSheet(){ $("#sheet-wrap").classList.remove("on"); }
function sheetOpen(){ return $("#sheet-wrap").classList.contains("on"); }
$("#sheet-bg").onclick = closeSheet;
function pyqCount(c){ return (PYQ[c.id] || []).filter(function(h){ return MOCKS[h[0]] && MOCKS[h[0]].p; }).length; }
function cardSheet(c){
  var who = [c.who, c.year].filter(Boolean).join(", "), l = resolveLook(c), pq = pyqCount(c);
  var h = '<div class="cd"><span class="pill p-' + c.cat + '">' + CATNAME[c.cat] + '</span>' + (pq ? '<span class="pyq">📝 ' + pq + ' PYQ' + (pq > 1 ? "s" : "") + '</span>' : '') +
    '<h2>' + esc(c.name) + '</h2>' + (who ? '<div class="who">' + esc(who) + '</div>' : '<div class="who"></div>');
  if (c.roots) h += '<div class="f roots"><i>Breakdown</i>' + esc(c.roots) + '</div>';
  h += '<div class="f"><i>Means</i>' + esc(c.def) + '</div>';
  if (c.detail) h += '<div class="f"><i>Detail</i>' + esc(c.detail) + '</div>';
  if (c.example) h += '<div class="f"><i>Example</i>' + esc(c.example) + '</div>';
  if (c.look) h += '<div class="f look"><i>Lookalike</i>' + (l ? '<button class="lk" data-card="' + l.id + '">' + esc(c.look) + '</button>' : esc(c.look)) + (c.tell ? '<br>' + esc(c.tell) : '') + '</div>';
  openSheet(h + '<button class="btn" id="sh-drill" style="margin-top:8px">Drill this card</button></div>');
  $("#sh-drill").onclick = function(){ closeSheet(); var cs = [c]; if (l) cs.push(l); startLesson({kind: "drill", title: c.name, mode: "mix", cards: cs.concat(distractCards(c, 3))}); };
}
function distractCards(c, n){ return distract(c, "name", n); }
function theoristSheet(t){
  var s = thState(t.k), r = (G().th[t.k] || {}).r || 0;
  var status = s === "locked" ? "Get " + (UNLOCK - Math.min(r, UNLOCK)) + " more right to unlock" : s === "cracked" ? "Cracked. Get one of their cards right to repair it." : "Unlocked";
  var list = t.cards.map(function(id){ var c = BY[id]; return '<button class="lrow" data-card="' + id + '"><span class="dot d-' + c.cat + '"></span><span><b>' + esc(c.name) + '</b><small>' + CATNAME[c.cat] + (c.year ? ' · ' + esc(c.year) : '') + '</small></span></button>'; }).join("");
  openSheet('<div class="th-big">' + tcHtml(t, true) + '<div class="who" style="color:var(--mu);font-weight:800;margin-top:12px">' + status + '</div></div>' +
    '<h2 class="sh" style="margin-top:14px">Known for <small>' + plural(t.cards.length, "card") + '</small></h2><div class="th-list">' + list + '</div>' +
    '<button class="btn" id="sh-train" style="margin-top:16px">Train ' + esc(t.name.split(" ").slice(-1)[0]) + '</button>');
  $("#sh-train").onclick = function(){ closeSheet(); startLesson({kind: "drill", title: t.name, mode: "who", cards: shuffle(t.cards.map(function(id){ return BY[id]; }))}); };
}
document.addEventListener("click", function(e){
  var b = e.target.closest("[data-card]"); if (b && !b.closest(".opts")){ cardSheet(BY[b.dataset.card]); return; }
  var t = e.target.closest("[data-th]"); if (t && !t.closest(".mbox") && !t.closest(".th-big")) theoristSheet(TH[t.dataset.th]);
});

/* ================= lesson engine ================= */
var L = null, timer = null;
function startLesson(o){
  var cards = o.cards;
  if (o.mode === "who") cards = cards.filter(function(c){ return c.who; });
  if (o.kind !== "duel" && (!cards || !cards.length)){ toast("Nothing in that pile yet.", "bad"); return; }
  L = {kind: o.kind, title: o.title, mode: o.mode || "mix", cards: cards, ix: o.ix, cat: o.cat, i: 0, right: 0, wrongs: [], hits: [],
    lives: (o.kind === "boss" || o.kind === "revenge") ? 3 : null, xp: 0, t0: Date.now(), combo: 0, best: 0, total: o.kind === "duel" ? 15 : cards.length, q: null};
  if (o.kind === "boss"){ var b = G().boss[MAP[o.ix][0]] || (G().boss[MAP[o.ix][0]] = {}); b.tries = (b.tries || 0) + 1; save(); }
  holdCeleb = true;
  clearScreens();
  var el = pushScreen("lesson", '<div class="lhead"><button class="x" id="l-x">' + IC.x + '</button><div class="lprog"><i style="width:0"></i></div><div id="l-side"></div></div>' +
    (o.kind === "boss" ? '<div class="boss-strip"><div class="be">' + MAP[o.ix][3] + '</div><div class="bt"><b>' + MAP[o.ix][1] + '</b><div class="hp"><i style="width:100%"></i></div></div></div>' : '') +
    '<div class="scroll" id="l-body"></div><div class="lfoot" id="l-foot"></div>', quitAsk);
  $("#l-x", el).onclick = quitAsk;
  if (o.kind === "speed"){ L.end = Date.now() + 60000; clearInterval(timer); timer = setInterval(tick, 200); }
  nextQ();
}
function quitAsk(){
  if (!L) { popScreen(); return; }
  if (L.done){ endLesson(); return; }
  openSheet('<div class="center" style="padding:6px 4px 0"><div class="hero-e" style="font-size:64px">' + (L.kind === "boss" ? "🏃" : "😢") + '</div><h1>' + (L.kind === "boss" ? "Run from the boss?" : "Quit this lesson?") + '</h1><p>' +
    (L.i ? "XP you earned so far stays. Progress in this round is lost." : "You have not started yet.") + '</p></div>' +
    '<button class="btn" id="q-stay" style="margin-top:14px">Keep going</button><button class="btn ghost" id="q-quit" style="margin-top:10px">' + (L.kind === "boss" ? "Run away" : "Quit") + '</button>');
  $("#q-stay").onclick = closeSheet;
  $("#q-quit").onclick = function(){ closeSheet(); endLesson(); };
}
function endLesson(){ clearInterval(timer); L = null; holdCeleb = false; clearScreens(); setTimeout(flushCeleb, 350); }
function tick(){
  if (!L || L.kind !== "speed"){ clearInterval(timer); return; }
  var left = Math.max(0, Math.ceil((L.end - Date.now()) / 1000)), el = $("#l-clock");
  if (el){ el.textContent = "0:" + ("0" + left).slice(-2); el.classList.toggle("low", left <= 10); }
  var p = $("#lesson .lprog i"); if (p) p.style.width = ((60000 - (L.end - Date.now())) / 600) + "%";
  if (left <= 0){ clearInterval(timer); finish(); }
}
function side(){
  if (L.kind === "speed") return '<span class="clock" id="l-clock">1:00</span>';
  if (L.lives != null) return '<span class="hearts" id="l-hearts">' + [0, 1, 2].map(function(k){ return '<span class="' + (k < L.lives ? "" : "lost") + '">❤️</span>'; }).join("") + '</span>';
  if (L.kind === "duel") return '<span class="combo" id="l-combo">🔥 ' + L.combo + '</span>';
  return '';
}
function buildQ(){
  if (L.kind === "duel"){
    var ps = PAIRS.filter(function(p){ return p[0].cat === L.cat || p[1].cat === L.cat; });
    if (!ps.length) ps = PAIRS;
    var p = ps[Math.floor(Math.random() * ps.length)], t = Math.random() < .5 ? p[0] : p[1];
    return {c: t, other: t === p[0] ? p[1] : p[0], mode: "duel", field: "name", opts: shuffle([p[0], p[1]])};
  }
  var c = L.cards[L.i % L.cards.length], mode = L.mode;
  if (L.kind === "speed") mode = "desc";
  else if (mode === "mix"){ var ms = c.who ? ["name", "desc", "who"] : ["name", "desc"]; mode = ms[Math.floor(Math.random() * ms.length)]; }
  var field = mode === "name" ? "def" : mode === "desc" ? "name" : "who";
  return {c: c, mode: mode, field: field, opts: shuffle([c].concat(distract(c, field, 3)))};
}
function nextQ(){
  if (!L) return;
  if (L.kind !== "speed" && (L.lives === 0 || L.i >= L.total)) return finish();
  var q = L.q = buildQ(), c = q.c, pill = '<span class="pill p-' + c.cat + '">' + CATNAME[c.cat] + '</span>';
  $("#l-side").innerHTML = side();
  if (L.kind !== "speed") $("#lesson .lprog i").style.width = (L.i * 100 / L.total) + "%";
  var k, card;
  if (q.mode === "duel"){ k = "Which one is this?"; card = pill + '<div class="qd">' + esc(c.def) + '</div>'; }
  else if (q.mode === "name"){ k = "What does this mean?"; card = pill + '<div class="qn">' + esc(c.name) + '</div>'; }
  else if (q.mode === "desc"){ k = "Name the " + CATNAME[c.cat].toLowerCase(); card = '<div class="qd" style="margin-top:0">' + esc(c.def) + '</div>'; }
  else { k = "Who is behind this?"; card = pill + '<div class="qn">' + esc(c.name) + '</div><div class="qs">' + esc(c.def) + '</div>'; }
  $("#l-body").innerHTML = '<div class="qbody"><div class="qk">' + k + '</div><div class="qcard">' + card + '</div><div class="opts' + (q.mode === "duel" ? " two" : "") + '">' +
    q.opts.map(function(o){ return '<button class="opt" data-id="' + o.id + '">' + esc(o[q.field]) + '</button>'; }).join("") + '</div></div>';
  $("#l-body").scrollTop = 0;
  var instant = L.kind === "speed";
  $("#l-foot").innerHTML = instant ? '<div style="text-align:center;color:var(--mu);font-weight:800;font-size:14px;padding:6px 0">' + L.right + ' right · tap to answer</div>' : '<button class="btn" id="l-check" disabled>Check</button>';
  var sel = null;
  $("#l-body .opts").onclick = function(e){
    var b = e.target.closest(".opt"); if (!b || b.disabled) return;
    if (instant){ grade(b); return; }
    document.querySelectorAll("#l-body .opt").forEach(function(x){ x.classList.toggle("sel", x === b); });
    sel = b; $("#l-check").disabled = false;
  };
  if (!instant) $("#l-check").onclick = function(){ if (sel) grade(sel); };
  if (L.kind === "speed") tick();
}
function flash(kind){ var f = document.createElement("div"); f.className = "flashbg " + kind; $("#lesson").appendChild(f); setTimeout(function(){ f.remove(); }, 400); }
function floatText(t){ var f = document.createElement("div"); f.className = "cflash"; f.textContent = t; $("#lesson").appendChild(f); setTimeout(function(){ f.remove(); }, 1000); }
function grade(btn){
  var q = L.q, c = q.c, ok = btn.dataset.id === c.id, cleared = false, mult = 1;
  document.querySelectorAll("#l-body .opt").forEach(function(x){ x.disabled = true; x.classList.remove("sel"); if (x.dataset.id === c.id) x.classList.add("ok", "flash"); });
  if (!ok) btn.classList.add("bad");
  if (L.kind === "duel"){ if (ok){ L.combo++; bump("duels"); mult = Math.min(1 + Math.floor((L.combo - 1) / 3), 5); } else { L.combo = 0; addMiss(c.id); save(); }
    if (setBest("combo", L.combo) && L.combo >= 3) toast("🔥 New best combo: <b>" + L.combo + "</b>", "gold"); L.best = Math.max(L.best, L.combo); }
  else cleared = srs(c, ok);
  if (ok){ L.right++; L.hits.push(c); } else { L.wrongs.push(c); if (L.lives != null) L.lives--; }
  var xp = answer({c: c, ok: ok, src: L.kind === "lesson" ? "drill" : L.kind, mode: q.mode, mult: mult, combo: L.kind === "duel" ? L.combo : null, cleared: cleared});
  L.xp += xp;
  if (ok){ SFX.ok(); buzz(HAP.ok); flash("ok"); if (L.kind === "duel" && L.combo >= 3){ SFX.combo(L.combo); floatText(L.combo + " in a row!"); } }
  else { SFX.bad(); buzz(HAP.bad); flash("bad"); }
  if (L.kind === "boss"){ var hp = $("#lesson .hp i"); hp.style.width = ((L.total - L.right) * 100 / L.total) + "%"; if (ok){ var be = $("#lesson .boss-strip .be"); be.classList.remove("hit"); void be.offsetWidth; be.classList.add("hit"); } }
  $("#l-side").innerHTML = side();
  if (!ok && $("#l-hearts")) $("#l-hearts").classList.add("hit");
  if (L.kind === "duel" && ok && $("#l-combo")) $("#l-combo").classList.add("pop");
  if (L.kind === "speed"){ L.i++; setTimeout(function(){ if (L && L.kind === "speed" && Date.now() < L.end) nextQ(); }, ok ? 380 : 1100); return; }
  feedback(ok, q, btn, xp);
}
function feedback(ok, q, btn, xp){
  var c = q.c, picked = BY[btn.dataset.id], why = "";
  var who = [c.who, c.year].filter(Boolean).join(", ");
  if (q.mode === "duel"){
    var o = q.other;
    why = '<div class="f tell"><i>The tell</i>' + esc(c.tell || o.tell || "") + '</div>' +
      '<div class="f"><b>' + esc(c.name) + '</b>' + (c.who ? ' (' + esc(c.who) + ')' : '') + ': ' + esc(c.def) + '</div>' +
      '<div class="f"><b>' + esc(o.name) + '</b>' + (o.who ? ' (' + esc(o.who) + ')' : '') + ': ' + esc(o.def) + '</div>';
  } else {
    if (!ok && picked) why += '<div class="f"><i>You picked</i>' + esc(picked[q.field]) + (q.field === "name" ? "" : " (that is " + esc(picked.name) + ")") + '</div>';
    if (c.roots) why += '<div class="f"><i>Breakdown</i>' + esc(c.roots) + '</div>';
    why += '<div class="f"><i>' + esc(c.name) + (who ? ' · ' + esc(who) : '') + '</i>' + esc(c.def) + '</div>';
    if (c.example) why += '<div class="f"><i>Example</i>' + esc(c.example) + '</div>';
    if (c.look && c.tell) why += '<div class="f tell"><i>Do not confuse with ' + esc(c.look) + '</i>' + esc(c.tell) + '</div>';
  }
  var praise = ["Nice!", "Locked in!", "Correct!", "Sharp!", "You got it!"][Math.floor(Math.random() * 5)];
  var last = L.lives === 0 || L.i + 1 >= L.total;
  $("#l-foot").insertAdjacentHTML("beforeend", '<div class="fb ' + (ok ? "ok" : "bad") + '"><h3><span class="ic">' + (ok ? "✓" : "✕") + '</span>' + (ok ? praise : L.lives === 0 ? "Out of hearts" : "Not quite") +
    (xp ? '<span class="xp">+' + xp + ' XP</span>' : '') + '</h3>' + (ok ? '' : '<div class="ans">Correct answer: ' + esc(c[q.field]) + '</div>') +
    '<div class="why">' + why + '</div><button class="btn ' + (ok ? "ok" : "bad") + '" id="l-next">' + (last ? "Finish" : "Continue") + '</button></div>');
  $("#l-next").onclick = function(){ L.i++; nextQ(); };
}
function fmtTime(ms){ var s = Math.round(ms / 1000); return Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2); }
function finish(){
  clearInterval(timer);
  if (!L) return;
  L.done = true;
  var g = G(), h = "", hero = "🏆", cls = "gold", title = "Lesson complete!", sub = "", again = "Practice again", answered = L.right + L.wrongs.length;
  var acc = answered ? Math.round(L.right * 100 / answered) : 0;
  if (L.kind === "speed"){
    var b = g.best.speed || 0, nb = setBest("speed", L.right);
    hero = "⚡"; title = L.right + " in 60 seconds"; sub = nb && b ? "New best! Old best was " + b + "." : nb ? "First score logged. Beat it next time." : "Best: " + b + ". " + (b - L.right) + " short.";
    if (nb && L.right) { SFX.win(); confetti(); }
    again = "Go again";
  } else if (L.kind === "boss"){
    var m = MAP[L.ix], bs = g.boss[m[0]] || (g.boss[m[0]] = {}), win = L.lives > 0, first = !bs.w;
    again = "Fight again";
    if (win){ bs.w = (bs.w || 0) + 1; bs.bl = Math.max(bs.bl || 0, L.lives); bump("boss"); var bx = 100 + 50 * L.lives; addXP(bx); L.xp += bx; questTick({c: {}, bossWin: true});
      hero = m[3]; title = m[1] + " defeated!"; sub = (first && MAP[L.ix + 1] ? MAP[L.ix + 1][1] + " is now open. " : "") + (L.lives < 3 ? "Win with all 3 hearts for Untouchable." : "Flawless.");
      SFX.win(); buzz(HAP.big); confetti(240); }
    else { hero = "💀"; cls = "bad"; title = m[1] + " won this time"; sub = "Your misses are saved. Drill them and come back."; SFX.lose(); }
  } else if (L.kind === "revenge"){
    var rw = L.lives > 0; again = "Again";
    if (rw){ L.hits.forEach(function(c){ if (P.m[c.id]) P.m[c.id].done = true; }); bump("rev"); addXP(75); L.xp += 75; hero = "⚔️"; title = "Revenge served"; sub = plural(L.hits.length, "card") + " cleared from your misses. +75 XP."; SFX.win(); confetti(); }
    else { hero = "😤"; cls = "bad"; title = "Revenge failed"; sub = "Nothing cleared. Try again."; SFX.lose(); }
  } else {
    if (!L.wrongs.length && answered >= 5){ bump("perfect"); hero = "💯"; title = "Perfect lesson!"; }
    if (L.kind === "duel") sub = "Best combo this round: " + L.best + ". All time: " + (g.best.combo || 0) + ".";
    SFX.win(); confetti(acc >= 80 ? 160 : 70);
  }
  badgeCheck(); save();
  var miss = L.wrongs.length ? '<div class="missed"><div class="k">Review these</div>' + L.wrongs.filter(function(c, i, a){ return a.indexOf(c) === i; }).map(function(c){ return '<button class="chip" data-card="' + c.id + '">' + esc(c.name) + '</button>'; }).join("") + '</div>' : '';
  h = '<div class="scroll"><div class="center">' + (L.kind === "boss" ? '<div class="boss-hero' + (L.lives > 0 ? " won" : "") + '">' + hero + '</div>' : '<div class="hero-e">' + hero + '</div>') +
    '<h1 class="' + cls + '">' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') +
    '<div class="rstats"><div class="rs g"><div class="rk">Total XP</div><div class="rv" data-count="' + L.xp + '">0</div></div>' +
    '<div class="rs o"><div class="rk">' + (L.kind === "speed" ? "Right" : "Accuracy") + '</div><div class="rv">' + (L.kind === "speed" ? L.right : acc + "%") + '</div></div>' +
    '<div class="rs b"><div class="rk">Time</div><div class="rv">' + fmtTime(Date.now() - L.t0) + '</div></div></div>' + miss + '</div></div>' +
    '<div class="lfoot"><button class="btn" id="r-done">Continue</button><button class="btn ghost" id="r-again" style="margin-top:10px">' + again + '</button></div>';
  var el = $("#lesson"); el.innerHTML = h; el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  var cnt = $("[data-count]", el), target = L.xp, t0 = performance.now();
  (function up(t){ var p = Math.min(1, (t - t0) / 900); cnt.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(up); })(t0);
  var spec = {kind: L.kind, ix: L.ix, mode: L.mode, cat: L.cat, title: L.title, cards: L.cards};
  $("#r-done").onclick = endLesson;
  $("#r-again").onclick = function(){ again2(spec); };
  holdCeleb = false; setTimeout(flushCeleb, 900);
}
function again2(s){
  if (s.kind === "boss") return startBoss(s.ix, true);
  if (s.kind === "revenge") return startRevenge();
  if (s.kind === "speed") return startLesson({kind: "speed", cards: shuffle(CARDS.slice())});
  if (s.kind === "lesson") return startDaily();
  if (s.kind === "duel") return startLesson({kind: "duel", cat: s.cat, cards: []});
  startLesson({kind: s.kind, mode: s.mode, cat: s.cat, title: s.title, cards: s.cat ? pickRound(s.cat, 15) : shuffle(s.cards.slice())});
}
function startDaily(){ startLesson({kind: "lesson", mode: "mix", cards: pickRound("all", 10)}); }
function startRevenge(){ var rp = revengePool(); if (!rp.length){ toast("Nothing missed this week. Nice.", "good"); return; }
  startLesson({kind: "revenge", mode: "mix", cards: shuffle(rp.map(function(id){ return BY[id]; })).slice(0, 10)}); }
function startBoss(ix, direct){
  if (direct) return startLesson({kind: "boss", ix: ix, mode: "mix", cards: pickBoss(ix)});
  var m = MAP[ix], b = G().boss[m[0]] || {}, n = m[0] === "all" ? CARDS.length : CARDS.filter(function(c){ return c.area === m[0]; }).length;
  var el = pushScreen("boss", '<div class="lhead"><button class="x" id="b-x">' + IC.x + '</button></div><div class="scroll"><div class="center"><div class="boss-hero' + (b.w ? " won" : "") + '">' + m[3] + '</div>' +
    '<h1>' + m[1] + '</h1><p>' + m[2] + '. Drawn from ' + n + ' cards, weighted toward the ones you are shaky on.</p>' +
    '<div class="rules"><div><b>' + (m[0] === "all" ? 15 : 10) + '</b>questions</div><div><b>❤️ 3</b>hearts</div><div><b>+' + (100 + 150) + '</b>max XP</div></div>' +
    (b.w ? '<p style="margin-top:12px">Beaten ' + b.w + 'x · best ' + b.bl + ' heart' + (b.bl > 1 ? "s" : "") + ' left</p>' : b.tries ? '<p style="margin-top:12px">' + plural(b.tries, "attempt") + ' so far</p>' : '') +
    '</div></div><div class="lfoot"><button class="btn" id="b-go">' + (b.w ? "Fight again" : "Start the fight") + '</button></div>', popScreen);
  $("#b-x", el).onclick = popScreen;
  $("#b-go", el).onclick = function(){ startBoss(ix, true); };
}

/* ================= library ================= */
function openLibrary(cat){
  var LC = cat || "all";
  var el = pushScreen("library", '<div class="lhead"><button class="x" id="lib-x">' + IC.x + '</button><b style="font-size:19px;font-weight:900">Card library</b></div>' +
    '<div class="lib-top"><input class="search" id="lib-q" placeholder="Search names, people, meanings" autocomplete="off"><div class="chips" id="lib-c" style="margin-top:10px"></div></div><div class="scroll" id="lib-l"></div>', popScreen);
  $("#lib-x", el).onclick = popScreen;
  function draw(){
    var q = norm($("#lib-q").value);
    $("#lib-c").innerHTML = CATS.concat([["miss", "My misses"]]).map(function(x){ return '<button class="chip' + (x[0] === LC ? " on" : "") + '" data-c="' + x[0] + '">' + x[1] + ' <small>' + pool(x[0]).length + '</small></button>'; }).join("");
    var cs = pool(LC).filter(function(c){ return !q || norm([c.name, c.who, c.year, c.def, c.roots, c.look, (c.aliases || []).join(" ")].join(" ")).indexOf(q) >= 0; })
      .sort(function(a, b){ return a.name.localeCompare(b.name); });
    $("#lib-l").innerHTML = cs.slice(0, 200).map(function(c){ return '<button class="lrow" data-card="' + c.id + '"><span class="dot d-' + c.cat + '"></span><span><b>' + esc(c.name) + '</b><small>' +
      esc([c.who, c.year].filter(Boolean).join(", ") || CATNAME[c.cat]) + '</small></span></button>'; }).join("") +
      (cs.length > 200 ? '<div class="empty">Showing 200 of ' + cs.length + '. Search to narrow it down.</div>' : cs.length ? '' : '<div class="empty">No cards match.</div>');
  }
  $("#lib-q").oninput = draw;
  $("#lib-c").onclick = function(e){ var b = e.target.closest(".chip"); if (b){ LC = b.dataset.c; draw(); } };
  draw();
}

/* ================= tabs ================= */
var TAB = "home", PCAT = "all", THF = "all", THQ = "", THN = 60;
function hudHtml(){
  var g = G(), i = lvInfo(g.xp), s = streak(), lit = dayDone(dayRec());
  return '<div class="hud"><button class="crest" data-tab="me">' + i.l + '</button><div class="xpbar"><i style="width:' + i.pct + '%"></i><span>' + g.xp + (i.hi != null ? ' / ' + i.hi : '') + ' XP</span></div>' +
    '<div class="streak' + (lit ? " lit" : "") + '"><span class="fl">🔥</span>' + s + '</div></div>';
}
function ring(a, n){ var C = 2 * Math.PI * 37, p = Math.min(1, a / n);
  return '<div class="ring' + (a >= n ? " done" : "") + '"><svg viewBox="0 0 84 84"><circle class="tr" cx="42" cy="42" r="37"/><circle class="fg" cx="42" cy="42" r="37" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - p)) + '"/></svg><b>' + (a >= n ? "✓" : Math.min(a, n)) + '</b></div>'; }
function tabHome(){
  var g = G(), d = dayRec(), s = streak(), n = goal(), q = g.q[today()] || {}, cb = curBoss();
  var h = hudHtml() + '<div class="panel goal">' + ring(d.a, n) + '<div class="goal-t"><div class="k">Daily goal · ' + n + ' answers</div><div class="v">' +
    (d.a >= n ? "Goal done. " + (s > 1 ? s + " day streak." : "Streak started.") : (n - d.a) + " to go" + (s ? " to keep your " + s + " day streak" : " to start a streak")) +
    '</div><button class="btn sm" id="h-go">' + (d.a ? "Continue" : "Start lesson") + '</button></div></div>';
  h += '<h2 class="sh">Daily quests<small>+' + QUEST_XP + ' XP each, +' + QUEST_ALL_XP + ' for all three</small></h2><div class="panel">' + todaysQuests().map(function(Q){
    var v = Math.min(q[Q.id] || 0, Q.n), done = v >= Q.n;
    return '<div class="quest' + (done ? " done" : "") + '"><div class="qi">' + (done ? "✅" : Q.e) + '</div><div class="qb"><b>' + Q.t + '</b><div class="pbar gold"><i style="width:' + (v * 100 / Q.n) + '%"></i></div></div><span class="qn">' + v + '/' + Q.n + '</span></div>'; }).join("") + '</div>';
  h += '<div class="path"><div class="unit"><b>Boss map</b><span>' + bossWins() + ' of ' + MAP.length + ' beaten. Each boss opens the next.</span></div>' + MAP.map(function(m, ix){
    var b = g.boss[m[0]] || {}, open = bossOpen(ix), st = b.w ? "won" : open ? "open" : "shut", off = Math.round(Math.sin(ix * 0.9) * 70);
    return '<div class="node-wrap"><button class="node ' + st + (ix === cb ? " cur" : "") + '" data-boss="' + ix + '" style="transform:translateX(' + off + 'px)">' + (ix === cb ? '<span class="bubble">' + (b.tries ? "FIGHT" : "START") + '</span>' : '') +
      (open || b.w ? m[3] : "🔒") + (b.w ? '<span class="crown">' + (b.bl === 3 ? "👑" : "✓") + '</span>' : '') + '</button><span class="node-l" style="transform:translateX(' + off + 'px)">' + m[1] + '</span></div>'; }).join("") + '</div>';
  return h;
}
function tabPractice(){
  var now = Date.now(), due = 0, lock = 0, rp = revengePool().length, mi = missIds().length;
  CARDS.forEach(function(c){ var s = P.c[c.id]; if (s){ if (s.d <= now) due++; if (s.b >= 3) lock++; } });
  var h = hudHtml() + '<div class="stats3"><div class="st"><b>' + due + '</b><span>due now</span></div><div class="st"><b>' + lock + '</b><span>locked in</span></div><div class="st"><b>' + CARDS.length + '</b><span>cards</span></div></div>';
  h += '<h2 class="sh">Drill<small>Pick a pile, then a mode. Spaced repetition decides what comes up.</small></h2><div class="chips" id="p-c">' +
    CATS.map(function(x){ return '<button class="chip' + (x[0] === PCAT ? " on" : "") + '" data-c="' + x[0] + '">' + x[1] + ' <small>' + pool(x[0]).length + '</small></button>'; }).join("") + '</div>';
  var M = [
    ["name", "📖", "Name → meaning", "See the name, pick what it means", "#4aa3ff"],
    ["desc", "🎯", "Meaning → name", "The lookalike is always an option", "#a78bfa"],
    ["who", "🧑‍🔬", "Who did it?", "Pick the person behind it", "#3ddc84"],
    ["duel", "⚔️", "Lookalike duels", PAIRS.length + " trap pairs. Combos multiply XP", "#ff9f1c"],
    ["speed", "⚡", "Speed round", "60 seconds. Best: " + (G().best.speed || 0), "#ffc93c"],
    ["revenge", "💀", "Revenge", rp ? "This week's misses, 3 hearts" : "Nothing missed this week", "#ff5a5f", rp],
    ["miss", "🩹", "My misses", mi ? "Two rights in a row clears one" : "Empty for now", "#ff8a5c", mi],
    ["lib", "📚", "Card library", "Search all " + CARDS.length + " cards", "#94a3b8"]
  ];
  h += '<div class="modes">' + M.map(function(m){ var dis = (m[0] === "revenge" && !rp) || (m[0] === "miss" && !mi);
    return '<button class="mode" data-m="' + m[0] + '"' + (dis ? " disabled" : "") + '><div class="row" style="gap:0"><span class="mi" style="background:' + m[4] + '26">' + m[1] + '</span>' + (m[5] ? '<span class="cnt">' + m[5] + '</span>' : '') + '</div><b>' + m[2] + '</b><span>' + m[3] + '</span></button>'; }).join("") + '</div>';
  return h;
}
function dexHtml(){
  var q = norm(THQ), ts = TH_LIST.filter(function(t){ var s = thState(t.k);
    if (THF === "legendary" ? rarity(t) !== "legendary" : THF !== "all" && s !== THF) return false;
    return !q || norm(t.name).indexOf(q) >= 0; });
  return '<div class="dex">' + ts.slice(0, THN).map(function(t){ return tcHtml(t); }).join("") + '</div>' +
    (ts.length > THN ? '<button class="btn ghost" id="c-more" style="margin-top:14px">Show more (' + (ts.length - THN) + ')</button>' : ts.length ? '' : '<div class="empty">None here yet.</div>');
}
function tabCollection(){
  var unl = thUnlocked(), cr = TH_LIST.filter(function(t){ return thState(t.k) === "cracked"; }).length;
  var h = hudHtml() + '<h2 class="sh" style="margin-top:12px">Theorist collection<small>Get 3 of a person\'s cards right to unlock them</small></h2>' +
    '<div class="dexbar"><div class="pbar gold"><i style="width:' + (unl * 100 / TH_LIST.length) + '%"></i></div><b>' + unl + ' / ' + TH_LIST.length + '</b></div>' +
    '<div class="chips" id="c-f">' + [["all", "All"], ["ok", "Unlocked"], ["cracked", "Cracked" + (cr ? " " + cr : "")], ["locked", "Locked"], ["legendary", "Legendary"]].map(function(x){
      return '<button class="chip' + (THF === x[0] ? " on" : "") + '" data-f="' + x[0] + '">' + x[1] + '</button>'; }).join("") + '</div>' +
    '<input class="search" id="c-q" placeholder="Find a theorist" value="' + esc(THQ) + '" autocomplete="off" style="margin:4px 0 14px">' +
    '<div id="c-dex">' + dexHtml() + '</div>';
  return h;
}
function tabMe(){
  var g = G(), i = lvInfo(g.xp), st = g.st, B = g.best, acc = st.ans ? Math.round((st.right || 0) * 100 / st.ans) : 0;
  var h = '<div class="prof"><div class="crest">' + i.l + '</div><div><h1>' + i.rank + '</h1><p>Level ' + i.l + ' · ' + g.xp + ' XP' + (i.hi != null ? ' · ' + (i.hi - g.xp) + ' to level ' + (i.l + 1) : '') + '</p></div></div>' +
    '<div class="pbar gold" style="margin:6px 0 4px"><i style="width:' + i.pct + '%"></i></div>';
  var cal = "", d = new Date(); d.setDate(d.getDate() - 27);
  for (var k = 0; k < 28; k++){ var r = g.days[today(d)], t = today(d) === today();
    cal += '<i class="' + (dayDone(r) ? "f" : r && r.a ? "p" : "") + (t ? " t" : "") + '">' + d.getDate() + '</i>'; d.setDate(d.getDate() + 1); }
  h += '<h2 class="sh">Streak<small>' + plural(streak(), "day") + ' now · longest ' + (B.streak || 0) + '</small></h2><div class="panel"><div class="cal">' + cal + '</div></div>';
  h += '<h2 class="sh">Stats</h2><div class="tiles">' + [["⭐", g.xp, "total XP"], ["🎯", acc + "%", "accuracy"], ["✅", st.right || 0, "right answers"], ["👑", bossWins() + "/" + MAP.length, "bosses beaten"],
    ["🔥", B.combo || 0, "best combo"], ["⚡", B.speed || 0, "best speed"], ["🃏", thUnlocked(), "theorists"], ["📈", B.dayxp || 0, "best XP day"]]
    .map(function(t){ return '<div class="tile"><span class="ti">' + t[0] + '</span><div><b>' + t[1] + '</b><span>' + t[2] + '</span></div></div>'; }).join("") + '</div>';
  var have = BADGES.filter(function(b){ return g.bdg[b[0]]; }).length;
  h += '<h2 class="sh">Badges<small>' + have + ' of ' + BADGES.length + '</small></h2><div class="badges">' + BADGES.map(function(b){
    return '<button class="bdg' + (g.bdg[b[0]] ? " on" : "") + '" data-bdg="' + b[0] + '"><span class="be">' + b[1] + '</span><b>' + b[2] + '</b></button>'; }).join("") + '</div>';
  h += '<h2 class="sh">Settings</h2><div class="panel" style="padding:4px 14px">' +
    '<button class="set" id="s-goal"><span class="si">🎯</span>Daily goal<span class="sv">' + goal() + ' answers ›</span></button>' +
    '<button class="set" id="s-sound"><span class="si">🔊</span>Sound effects<span class="tog' + (S.sound ? " on" : "") + '"></span></button>' +
    '<button class="set" id="s-hap"><span class="si">📳</span>Haptics<span class="tog' + (S.haptics ? " on" : "") + '"></span></button>' +
    '<button class="set" id="s-reset" style="color:var(--bad)"><span class="si">🗑️</span>Reset progress</button></div>' +
    '<div class="ver">Name Lock 1.0 · ' + CARDS.length + ' cards · ' + TH_LIST.length + ' theorists · works offline</div>';
  return h;
}
var TABS = [["home", "Learn", IC.home], ["practice", "Practice", IC.practice], ["collection", "Collection", IC.cards], ["me", "Profile", IC.me]];
function drawTabbar(){ $("#tabbar").innerHTML = TABS.map(function(t){ return '<button data-tab="' + t[0] + '" class="' + (TAB === t[0] ? "on" : "") + '"><span class="tb-ic">' + t[2] + '</span>' + t[1] + '</button>'; }).join(""); }
function showTab(t, keepScroll){
  var tv = $("#tabview"), y = tv.scrollTop;
  TAB = t; drawTabbar();
  var fn = {home: tabHome, practice: tabPractice, collection: tabCollection, me: tabMe}[t];
  tv.innerHTML = '<div class="tabpage' + (keepScroll ? '" style="animation:none' : '') + '">' + fn() + '</div>';
  tv.scrollTop = keepScroll ? y : 0;
  bindTab();
}
function refreshTab(){ showTab(TAB, true); }
function setGoal(n){ G().goal = n; save(); }
function goalSheet(){
  var G0 = goal();
  openSheet('<h2 class="sh" style="margin-top:0">Daily goal<small>Answers a day to keep the streak alive</small></h2><div class="goals" style="max-width:none">' +
    [[10, "Casual"], [20, "Regular"], [30, "Serious"], [50, "Intense"]].map(function(x){ return '<button class="gl' + (x[0] === G0 ? " on" : "") + '" data-g="' + x[0] + '">' + x[1] + '<span>' + x[0] + ' a day</span></button>'; }).join("") + '</div>');
  $("#sheet .goals").onclick = function(e){ var b = e.target.closest("[data-g]"); if (!b) return; setGoal(+b.dataset.g); closeSheet(); refreshTab(); toast("Daily goal set to " + b.dataset.g, "good"); };
}
function bindTab(){
  var tv = $("#tabview");
  if (TAB === "home"){
    $("#h-go").onclick = startDaily;
    tv.querySelector(".path").onclick = function(e){ var b = e.target.closest("[data-boss]"); if (!b) return; var ix = +b.dataset.boss;
      if (!bossOpen(ix)){ buzz(HAP.bad); toast("🔒 Beat " + MAP[ix - 1][1] + " first", "bad"); return; } startBoss(ix); };
  }
  if (TAB === "practice"){
    $("#p-c").onclick = function(e){ var b = e.target.closest(".chip"); if (b){ PCAT = b.dataset.c; refreshTab(); } };
    tv.querySelector(".modes").onclick = function(e){ var b = e.target.closest(".mode"); if (!b || b.disabled) return; var m = b.dataset.m;
      if (m === "lib") return openLibrary(PCAT);
      if (m === "speed") return startLesson({kind: "speed", cards: shuffle(pool(PCAT))});
      if (m === "revenge") return startRevenge();
      if (m === "duel") return startLesson({kind: "duel", cat: PCAT, cards: []});
      if (m === "miss") return startLesson({kind: "drill", mode: "desc", cat: "miss", cards: pickRound("miss", 15)});
      startLesson({kind: "drill", mode: m, cat: PCAT, cards: pickRound(PCAT, 15)}); };
  }
  if (TAB === "collection"){
    $("#c-f").onclick = function(e){ var b = e.target.closest(".chip"); if (b){ THF = b.dataset.f; THN = 60; refreshTab(); } };
    $("#c-q").oninput = function(e){ THQ = e.target.value; THN = 60; $("#c-dex").innerHTML = dexHtml(); };
    $("#c-dex").onclick = function(e){ if (e.target.closest("#c-more")){ THN += 60; $("#c-dex").innerHTML = dexHtml(); } };
  }
  if (TAB === "me"){
    $("#s-goal").onclick = goalSheet;
    $("#s-sound").onclick = function(){ S.sound = !S.sound; saveS(); refreshTab(); };
    $("#s-hap").onclick = function(){ S.haptics = !S.haptics; saveS(); buzz(HAP.ok); refreshTab(); };
    $("#s-reset").onclick = function(){
      openSheet('<div class="center" style="padding:6px 4px 0"><div class="hero-e" style="font-size:60px">⚠️</div><h1>Reset everything?</h1><p>XP, streak, theorists, bosses, badges and spaced repetition all go back to zero. This cannot be undone.</p></div>' +
        '<button class="btn" id="r-no" style="margin-top:14px">Keep my progress</button><button class="btn bad" id="r-yes" style="margin-top:10px">Reset</button>');
      $("#r-no").onclick = closeSheet;
      $("#r-yes").onclick = function(){ var goalKeep = goal(); P = {c: {}, m: {}, g: {goal: goalKeep}}; save(); closeSheet(); showTab("home"); toast("Fresh start.", "good"); };
    };
    tv.querySelector(".badges").onclick = function(e){ var b = e.target.closest("[data-bdg]"); if (!b) return;
      var x = BADGES.filter(function(y){ return y[0] === b.dataset.bdg; })[0], on = G().bdg[x[0]];
      openSheet('<div class="center" style="padding:4px 4px 10px"><div class="hero-e" style="font-size:72px;' + (on ? "" : "filter:grayscale(1) opacity(.4)") + '">' + x[1] + '</div><h1>' + x[2] + '</h1><p>' + x[3] + '</p><p>' + (on ? "Earned " + new Date(on).toLocaleDateString() : "Not earned yet") + '</p></div>'); };
  }
}
$("#tabbar").onclick = function(e){ var b = e.target.closest("[data-tab]"); if (b && b.dataset.tab !== TAB) showTab(b.dataset.tab); };
document.addEventListener("click", function(e){ var c = e.target.closest(".hud [data-tab]"); if (c) showTab(c.dataset.tab); });

/* ================= onboarding ================= */
function onboarding(){
  var el = pushScreen("onb", '<div class="center"><div class="ob-logo">' + LOGO + '</div><h1 style="font-size:34px;margin-top:26px">Name Lock</h1>' +
    '<p>Every effect, bias, phenomenon, experiment, law and term an MCQ can throw at you. ' + CARDS.length + ' cards, ' + TH_LIST.length + ' theorists to collect, ' + MAP.length + ' bosses.</p></div>' +
    '<div class="lfoot"><button class="btn" id="ob-1">Get started</button></div>', function(){ return true; });
  $("#ob-1", el).onclick = function(){
    el.innerHTML = '<div class="scroll"><div class="center"><div class="hero-e" style="font-size:72px">🎯</div><h1>Pick a daily goal</h1><p>Hit it every day to build a streak. You can change it any time.</p><div class="goals">' +
      [[10, "Casual"], [20, "Regular"], [30, "Serious"], [50, "Intense"]].map(function(x){ return '<button class="gl' + (x[0] === 20 ? " on" : "") + '" data-g="' + x[0] + '">' + x[1] + '<span>' + x[0] + ' a day</span></button>'; }).join("") +
      '</div></div></div><div class="lfoot"><button class="btn" id="ob-2">Let\'s go</button></div>';
    var pick = 20;
    $(".goals", el).onclick = function(e){ var b = e.target.closest("[data-g]"); if (!b) return; pick = +b.dataset.g; el.querySelectorAll(".gl").forEach(function(x){ x.classList.toggle("on", x === b); }); };
    $("#ob-2", el).onclick = function(){ setGoal(pick); S.onboarded = true; saveS(); popScreen(); confetti(120); SFX.win(); };
  };
}

/* ================= hardware back (called by the Android wrapper) ================= */
window.nlBack = function(){
  if ($("#modal").classList.contains("on")){ closeModal(); return true; }
  if (sheetOpen()){ closeSheet(); return true; }
  if (STACK.length){ var top = STACK[STACK.length - 1]; if (top.id === "onb") return false; (top.onBack || popScreen)(); return true; }
  if (TAB !== "home"){ showTab("home"); return true; }
  return false;
};

/* ================= boot ================= */
showTab("home");
if (!S.onboarded && !G().xp) onboarding();
document.addEventListener("visibilitychange", function(){ if (!document.hidden && !STACK.length) refreshTab(); });
window.NLAPP = {G: G, P: function(){ return P; }, TH: TH_LIST, start: startLesson, _cur: function(){ return L && L.q && L.q.c.id; }};
})();
