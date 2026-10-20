/* Name Lock game layer: XP + levels, daily streak, theorist collection, boss map,
   duel combos, daily quests, revenge round, badges, personal bests, sound + confetti.
   State lives in P.g inside namelock-progress-v1, so it syncs with the deck.
   Everything is untimed except the opt-in speed round. */
(function(){
  var A = window.NL_API; if (!A) return;
  var DAY = 864e5;
  var MUTE_KEY = "namelock-mute";   /* per device, deliberately not synced */

  /* ---------- state ---------- */
  function G(){ var P = A.P(); var g = P.g = P.g || {};
    g.xp = g.xp || 0; g.days = g.days || {}; g.th = g.th || {}; g.boss = g.boss || {};
    g.bdg = g.bdg || {}; g.best = g.best || {}; g.st = g.st || {}; g.q = g.q || {};
    /* synced state is rendered into HTML: keep every counter numeric */
    g.xp = +g.xp || 0;
    [g.best, g.st].forEach(function(o){ for (var k in o) o[k] = +o[k] || 0; });
    for (var a in g.boss){ var b = g.boss[a] || {}; g.boss[a] = {w: +b.w || 0, bl: +b.bl || 0, tries: +b.tries || 0}; }
    for (var t in g.days){ var r = g.days[t] || {}; g.days[t] = {a: +r.a || 0, x: +r.x || 0}; }
    return g; }
  function today(d){ d = d ? new Date(d) : new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function dayRec(){ var g = G(), t = today(); return g.days[t] || (g.days[t] = {a: 0, x: 0}); }
  function bump(k, n){ var st = G().st; st[k] = (st[k] || 0) + (n || 1); return st[k]; }
  function setBest(k, v){ var b = G().best; if (v > (b[k] || 0)){ var had = b[k] != null; b[k] = v; return had; } return false; }

  /* ---------- levels ---------- */
  var LV = [0,150,350,600,900,1300,1800,2400,3100,4000,5000,6200,7600,9200,11000];
  function rank(l){ return l <= 3 ? "Intern" : l <= 6 ? "Resident" : l <= 9 ? "Senior Resident" : l <= 12 ? "Consultant" : "NIMHANS Topper"; }
  function level(xp){ var l = 1; for (var i = 1; i < LV.length; i++) if (xp >= LV[i]) l = i + 1; return l; }
  function lvInfo(xp){ var l = level(xp), lo = LV[l - 1], hi = LV[l] == null ? null : LV[l];
    return {l: l, rank: rank(l), lo: lo, hi: hi, pct: hi == null ? 100 : Math.round((xp - lo) * 100 / (hi - lo))}; }

  /* ---------- streak: a day counts once you answer 10 ---------- */
  var STREAK_MIN = 10;
  function streak(){
    var g = G(), d = new Date(), n = 0, t = today();
    if (!(g.days[t] && g.days[t].a >= STREAK_MIN)) d.setDate(d.getDate() - 1);   /* today still open */
    while (true){ var r = g.days[today(d)]; if (!r || r.a < STREAK_MIN) break; n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  var MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100];

  /* ---------- theorist collection ---------- */
  var PARTICLE = {von:1, van:1, de:1, der:1, of:1, la:1, le:1, du:1, da:1};
  var NOTPEOPLE = {real:1, case:1, unknown:1, various:1, gestalt:1, chicago:1, wurzburg:1};
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
  A.CARDS.forEach(function(c){
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

  /* ---------- boss map ---------- */
  var MAP = [
    ["history", "Structuralism Boss", "Schools and history: Wundt, Titchener, James, Locke"],
    ["perception", "Gestalt Boss", "Perception, psychophysics, illusions"],
    ["positive", "Positive Psych Boss", "Fredrickson, Seligman, flow, savoring, well-being"],
    ["learning", "Skinner Box Boss", "Conditioning, reinforcement, learning experiments"],
    ["memory", "Ebbinghaus Boss", "Memory effects and amnesias"],
    ["cognitive", "Heuristics Boss", "Thinking, attention, problem solving"],
    ["biological", "Broca Boss", "Brain, lesions, aphasias, agnosias"],
    ["developmental", "Piaget Boss", "Development and attachment"],
    ["personality", "Freud Boss", "Personality and defences"],
    ["social", "Social Psych Boss", "Conformity, attribution, groups"],
    ["clinical", "Ward Round Boss", "Clinical signs, symptoms, syndromes"],
    ["research", "Placebo Boss", "Research methods and artefacts"],
    ["all", "NIMHANS Final Boss", "15 questions from everywhere, 3 lives"]
  ];
  function bossIdx(area){ for (var i = 0; i < MAP.length; i++) if (MAP[i][0] === area) return i; return -1; }
  function bossOpen(i){ return i === 0 || !!(G().boss[MAP[i - 1][0]] || {}).w; }

  /* ---------- daily quests (same 3 on every device for a given date) ---------- */
  var QUESTS = [
    {id: "exp5", t: "Name 5 experiments", n: 5, f: function(e){ return e.ok && e.c.cat === "experiment"; }},
    {id: "bias3", t: "Clear 3 biases", n: 3, f: function(e){ return e.ok && e.c.cat === "bias"; }},
    {id: "eff5", t: "Get 5 effects right", n: 5, f: function(e){ return e.ok && e.c.cat === "effect"; }},
    {id: "phen4", t: "Get 4 phenomena right", n: 4, f: function(e){ return e.ok && e.c.cat === "phenomenon"; }},
    {id: "law3", t: "Get 3 laws right", n: 3, f: function(e){ return e.ok && e.c.cat === "law"; }},
    {id: "term6", t: "Decode 6 terms", n: 6, f: function(e){ return e.ok && e.c.cat === "term"; }},
    {id: "ans25", t: "Answer 25 cards", n: 25, f: function(){ return true; }},
    {id: "combo5", t: "Hit a 5x duel combo", n: 5, f: function(e){ return e.src === "duel" && e.ok; }, combo: true},
    {id: "duel8", t: "Win 8 lookalike duels", n: 8, f: function(e){ return e.ok && e.src === "duel"; }},
    {id: "pyq5", t: "Get 5 PYQ cards right", n: 5, f: function(e){ return e.ok && (A.PYQ[e.c.id] || []).some(function(h){ return A.MOCKS[h[0]] && A.MOCKS[h[0]].p; }); }},
    {id: "who5", t: "Name the person 5 times", n: 5, f: function(e){ return e.ok && e.mode === "who"; }},
    {id: "boss1", t: "Beat a boss", n: 1, f: function(e){ return e.bossWin; }},
    {id: "fix2", t: "Clear 2 cards from My misses", n: 2, f: function(e){ return e.cleared; }}
  ];
  function seedRand(s){ var h = 2166136261; for (var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function(){ h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6; }; }
  function todaysQuests(){ var r = seedRand("nlq" + today()), pool = QUESTS.slice(), out = [];
    while (out.length < 3){ out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); } return out; }
  var QUEST_XP = 50, QUEST_ALL_XP = 100;

  /* ---------- badges ---------- */
  function rightIn(cat){ var P = A.P(), n = 0; A.CARDS.forEach(function(c){ var s = P.c[c.id]; if (s && c.cat === cat && s.n - s.w > 0) n++; }); return n; }
  function thUnlocked(){ var n = 0; TH_LIST.forEach(function(t){ if (thState(t.k) !== "locked") n++; }); return n; }
  function bossWins(){ var n = 0; MAP.forEach(function(m){ if ((G().boss[m[0]] || {}).w) n++; }); return n; }
  var BADGES = [
    ["first", "First Blood", "Get your first card right", function(){ return (G().st.right || 0) >= 1; }],
    ["bias", "Bias Buster", "Get 25 different biases right", function(){ return rightIn("bias") >= 25; }],
    ["exp", "Experiment Encyclopedia", "Get 40 different experiments right", function(){ return rightIn("experiment") >= 40; }],
    ["eff", "Effect Expert", "Get 40 different effects right", function(){ return rightIn("effect") >= 40; }],
    ["phen", "Phenomenal", "Get 40 different phenomena right", function(){ return rightIn("phenomenon") >= 40; }],
    ["law", "Law Abiding", "Get 30 different laws right", function(){ return rightIn("law") >= 30; }],
    ["term", "Wordsmith", "Get 75 different terms right", function(){ return rightIn("term") >= 75; }],
    ["pos0", "Zero Misses on Positive Psych", "Beat the Positive Psych Boss without losing a life", function(){ return (G().boss.positive || {}).bl === 3; }],
    ["struct0", "Titchener Would Approve", "Beat the Structuralism Boss without losing a life", function(){ return (G().boss.history || {}).bl === 3; }],
    ["flawless", "Flawless", "Beat any boss with all 3 lives", function(){ return MAP.some(function(m){ return (G().boss[m[0]] || {}).bl === 3; }); }],
    ["boss1", "Boss Slayer", "Beat your first boss", function(){ return bossWins() >= 1; }],
    ["map", "Map Cleared", "Beat every area boss", function(){ return bossWins() >= MAP.length - 1; }],
    ["final", "NIMHANS Ready", "Beat the NIMHANS Final Boss", function(){ return !!(G().boss.all || {}).w; }],
    ["combo10", "Combo Breaker", "10 duels right in a row", function(){ return (G().best.combo || 0) >= 10; }],
    ["duel100", "Duelist", "Win 100 lookalike duels", function(){ return (G().st.duels || 0) >= 100; }],
    ["perfect", "Perfect Round", "20 out of 20 in a drill round", function(){ return (G().best.round || 0) >= 20; }],
    ["revenge", "Revenge Served", "Win a revenge round", function(){ return (G().st.rev || 0) >= 1; }],
    ["quests", "Quest Master", "Finish all 3 daily quests in a day", function(){ return (G().st.qall || 0) >= 1; }],
    ["s3", "On a Roll", "3-day streak", function(){ return (G().best.streak || 0) >= 3; }],
    ["s7", "Week Locked", "7-day streak", function(){ return (G().best.streak || 0) >= 7; }],
    ["s30", "Month of Iron", "30-day streak", function(){ return (G().best.streak || 0) >= 30; }],
    ["col10", "Collector", "Unlock 10 theorist cards", function(){ return thUnlocked() >= 10; }],
    ["col50", "Pokedex Pro", "Unlock 50 theorist cards", function(){ return thUnlocked() >= 50; }],
    ["founders", "Founding Fathers", "Unlock Wundt, Titchener and James", function(){ return ["wundt", "titchener", "james"].every(function(k){ return thState(k) !== "locked"; }); }],
    ["speed", "Speed Demon", "Score 20 in the speed round", function(){ return (G().best.speed || 0) >= 20; }],
    ["res", "Resident", "Reach Resident (level 4)", function(){ return level(G().xp) >= 4; }],
    ["cons", "Consultant", "Reach Consultant (level 10)", function(){ return level(G().xp) >= 10; }],
    ["top", "NIMHANS Topper", "Reach NIMHANS Topper (level 13)", function(){ return level(G().xp) >= 13; }]
  ];

  /* ---------- sound + confetti ---------- */
  var AC = null;
  function muted(){ return localStorage.getItem(MUTE_KEY) === "1"; }
  function tone(notes, type, vol){
    if (muted()) return;
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch(e){ return; }
    var t = AC.currentTime;
    notes.forEach(function(n){ var o = AC.createOscillator(), g = AC.createGain();
      o.type = type || "sine"; o.frequency.value = n[0];
      g.gain.setValueAtTime(0.0001, t + n[1]); g.gain.exponentialRampToValueAtTime(vol || 0.18, t + n[1] + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + n[2]);
      o.connect(g); g.connect(AC.destination); o.start(t + n[1]); o.stop(t + n[1] + n[2] + 0.05); });
  }
  var SFX = {
    ok: function(){ tone([[880, 0, .12], [1320, .07, .16]], "sine", .12); },
    bad: function(){ tone([[220, 0, .22]], "triangle", .14); },
    level: function(){ tone([[523, 0, .18], [659, .12, .18], [784, .24, .18], [1047, .36, .4]], "square", .07); },
    win: function(){ tone([[392, 0, .15], [523, .13, .15], [659, .26, .15], [784, .39, .15], [1047, .52, .5]], "square", .07); },
    badge: function(){ tone([[988, 0, .1], [1319, .1, .3]], "sine", .14); },
    crack: function(){ tone([[160, 0, .3], [120, .1, .3]], "sawtooth", .05); }
  };
  function confetti(n){
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var cv = document.createElement("canvas"), W = cv.width = innerWidth, H = cv.height = innerHeight, x = cv.getContext("2d");
    cv.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999";
    document.body.appendChild(cv);
    var cols = ["#f2c94c", "#2ea043", "#3d6fd0", "#c04a4a", "#7a5bd0", "#f08c3a"], ps = [];
    for (var i = 0; i < (n || 140); i++) ps.push({x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4,
      s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length]});
    var t0 = performance.now();
    (function f(t){
      x.clearRect(0, 0, W, H);
      ps.forEach(function(p){ p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
      if (t - t0 < 2600) requestAnimationFrame(f); else cv.remove();
    })(t0);
  }
  function toast(html, kind){
    var box = document.getElementById("g-toasts");
    if (!box){ box = document.createElement("div"); box.id = "g-toasts"; document.body.appendChild(box); }
    var d = document.createElement("div"); d.className = "g-toast " + (kind || ""); d.innerHTML = html; box.appendChild(d);
    setTimeout(function(){ d.classList.add("out"); }, 2600); setTimeout(function(){ d.remove(); }, 3100);
  }

  /* ---------- core: every answer anywhere goes through here ---------- */
  function addXP(n, why){
    if (!n) return;
    var g = G(), before = level(g.xp);
    g.xp += n; dayRec().x += n;
    setBest("dayxp", dayRec().x);
    var after = level(g.xp);
    if (after > before){
      var i = lvInfo(g.xp);
      SFX.level(); confetti(180);
      toast('<b>Level up: ' + i.l + '</b> ' + i.rank, "big");
    } else if (why) toast("+" + n + " XP " + why);
  }
  function questTick(ev){
    var g = G(), t = today(), q = g.q[t] || (g.q[t] = {});
    todaysQuests().forEach(function(Q){
      if ((q[Q.id] || 0) >= Q.n) return;
      if (Q.combo){ if (ev.combo != null) q[Q.id] = Math.max(q[Q.id] || 0, ev.combo); }
      else if (Q.f(ev)) q[Q.id] = (q[Q.id] || 0) + 1;
      if ((q[Q.id] || 0) >= Q.n){ SFX.badge(); addXP(QUEST_XP); toast("<b>Quest done:</b> " + Q.t + " (+" + QUEST_XP + " XP)", "good");
        if (todaysQuests().every(function(x){ return (q[x.id] || 0) >= x.n; })){ bump("qall"); addXP(QUEST_ALL_XP); confetti(); toast("<b>All 3 quests done.</b> +" + QUEST_ALL_XP + " XP bonus", "big"); } }
    });
  }
  function badgeCheck(){
    var g = G(), got = 0;
    BADGES.forEach(function(b){ if (!g.bdg[b[0]] && b[3]()){ g.bdg[b[0]] = Date.now(); got++; toast("<b>Badge: " + b[1] + "</b><br>" + b[2], "good"); } });
    if (got){ SFX.badge(); confetti(90); }
  }
  function streakCheck(before){
    var s = streak(); setBest("streak", s);
    if (s > before && MILESTONES.indexOf(s) >= 0){ addXP(s * 10); confetti(200); SFX.win(); toast("<b>" + s + "-day streak!</b> +" + (s * 10) + " XP", "big"); }
    else if (s > before) toast("Streak alive: <b>" + s + " day" + (s > 1 ? "s" : "") + "</b>", "good");
  }
  /* ev: {c, ok, src: drill|duel|boss|revenge|speed, mode, mult, cleared} */
  function answer(ev){
    var g = G(), c = ev.c, sBefore = streak();
    dayRec().a++; bump("ans");
    if (ev.ok){
      bump("right"); addXP(10 * (ev.mult || 1)); SFX.ok();
    } else SFX.bad();
    (CARD_TH[c.id] || []).forEach(function(k){
      var t = g.th[k] || (g.th[k] = {r: 0}), name = TH[k].name;
      if (ev.ok){
        t.r = (t.r || 0) + 1;
        if (t.cr){ t.cr = 0; toast("<b>" + A.esc(name) + "</b> card repaired", "good"); }
        else if (t.r === UNLOCK){ SFX.badge(); confetti(60); toast("<b>Theorist unlocked:</b> " + A.esc(name) + " <small>(" + rarity(TH[k]) + ")</small>", "good"); }
      } else if (t.r >= UNLOCK && !t.cr){ t.cr = 1; SFX.crack(); toast("<b>" + A.esc(name) + "</b> card cracked. Get one of theirs right to fix it.", "bad"); }
    });
    if (dayRec().a === STREAK_MIN) streakCheck(sBefore);
    questTick(ev); badgeCheck(); A.save(); hud();
  }

  /* duels: combo multiplier */
  var combo = 0;
  function mult(n){ return Math.min(1 + Math.floor(n / 3), 5); }
  function duel(c, ok){
    if (ok){ combo++; bump("duels"); } else combo = 0;
    var m = ok ? mult(combo - 1) : 1;
    var nb = setBest("combo", combo);
    answer({c: c, ok: ok, src: "duel", mult: m, combo: combo});
    if (ok && nb && combo >= 3) toast("New best combo: <b>" + combo + "</b>", "good");
    var nextM = mult(combo);
    return '<div class="g-combo ' + (ok ? "on" : "off") + '">' + (ok
      ? 'Combo <b>' + combo + '</b> &middot; +' + (10 * m) + ' XP' + (nextM > m ? ' &middot; next one pays <b>x' + nextM + '</b>' : ' &middot; x' + m + ' multiplier')
      : 'Combo broken. Best: ' + (G().best.combo || 0)) + '</div>';
  }
  function roundEnd(right, total){
    var b = G().best.round || 0, nb = right > b && total >= 20;
    if (total >= 20) setBest("round", right);
    A.save(); badgeCheck();
    if (nb && b){ confetti(); SFX.win(); }
    return '<div class="g-best">' + (nb ? (b ? '<b>New best round!</b> Old best was ' + b + '/20.' : 'First full round logged. Your best to beat: <b>' + right + '/20</b>.')
      : total >= 20 ? 'Best round: <b>' + b + '/20</b>. ' + (b - right) + ' short of it.' : '') + '</div>';
  }

  /* ---------- HUD ---------- */
  function hud(){
    var el = document.getElementById("g-hud"); if (!el) return;
    var g = G(), i = lvInfo(g.xp), s = streak(), d = dayRec();
    el.innerHTML = '<button class="g-lv" data-gplay="1"><b>L' + i.l + '</b> ' + i.rank + '</button>' +
      '<div class="g-bar" data-gplay="1" title="' + g.xp + ' XP"><i style="width:' + i.pct + '%"></i><span>' + g.xp + (i.hi != null ? ' / ' + i.hi : '') + ' XP</span></div>' +
      '<button class="g-st' + (d.a >= STREAK_MIN ? " lit" : "") + '" data-gplay="1" title="Day streak">&#128293; ' + s + '</button>' +
      '<button class="g-mute" id="g-mute" title="Sound on/off">' + (muted() ? "&#128263;" : "&#128266;") + '</button>';
  }
  document.addEventListener("click", function(e){
    if (e.target.closest("#g-mute")){ localStorage.setItem(MUTE_KEY, muted() ? "0" : "1"); hud(); if (!muted()) SFX.ok(); return; }
    if (e.target.closest("[data-gplay]")) A.show("play");
  });

  /* ---------- Play tab ---------- */
  function bar(p){ return '<div class="g-pbar"><i style="width:' + Math.min(100, p) + '%"></i></div>'; }
  function revengePool(){ var P = A.P(), cut = Date.now() - 7 * DAY;
    return A.missIds().filter(function(id){ var e = P.m[id]; return (e.lt || e.t || 0) >= cut; }); }
  var TH_FILTER = "all", TH_Q = "";
  function draw(){
    var root = document.getElementById("g-hub"); if (!root) return;
    var g = G(), i = lvInfo(g.xp), s = streak(), d = dayRec(), q = g.q[today()] || {}, h = "";
    /* level + streak */
    h += '<div class="g-top"><div class="g-card"><div class="g-k">Level ' + i.l + '</div><div class="g-big">' + i.rank + '</div>' + bar(i.pct) +
      '<div class="g-sm">' + g.xp + ' XP' + (i.hi != null ? ' &middot; ' + (i.hi - g.xp) + ' to level ' + (i.l + 1) + (rank(i.l + 1) !== i.rank ? ' (' + rank(i.l + 1) + ')' : '') : ' &middot; max level') + '</div></div>' +
      '<div class="g-card"><div class="g-k">Day streak</div><div class="g-big">&#128293; ' + s + '</div>' + bar(d.a * 100 / STREAK_MIN) +
      '<div class="g-sm">' + (d.a >= STREAK_MIN ? 'Today is locked in (' + d.a + ' answered).' : 'Answer ' + (STREAK_MIN - d.a) + ' more today to ' + (s ? 'keep it alive' : 'start one') + '. Miss a day and it resets.') + '</div></div></div>';
    /* quests */
    h += '<h2 class="sec">Daily quests <small class="g-sm">+' + QUEST_XP + ' XP each, +' + QUEST_ALL_XP + ' for all three. New ones at midnight.</small></h2><div class="g-quests">' +
      todaysQuests().map(function(Q){ var n = Math.min(q[Q.id] || 0, Q.n), done = n >= Q.n;
        return '<div class="g-q' + (done ? " done" : "") + '"><b>' + (done ? "&#10003; " : "") + Q.t + '</b>' + bar(n * 100 / Q.n) + '<span>' + n + ' / ' + Q.n + '</span></div>'; }).join("") + '</div>';
    /* revenge + speed */
    var rp = revengePool();
    h += '<div class="g-top"><button class="g-act rev" id="g-rev"' + (rp.length ? "" : " disabled") + '><b>&#9876; Revenge round</b><span>' +
      (rp.length ? rp.length + ' card' + (rp.length > 1 ? "s" : "") + ' you missed this week come back as a mini boss. 3 lives. Win and they clear.' : 'Nothing missed in the last 7 days. Miss something in a drill or mock and it shows up here.') + '</span></button>' +
      '<button class="g-act spd" id="g-speed"><b>&#9201; Speed round <small>(optional, timed)</small></b><span>60 seconds, as many as you can. The only timed mode on the site. Best: ' + (g.best.speed || 0) + '</span></button></div>';
    /* boss map */
    h += '<h2 class="sec">Boss map <small class="g-sm">10 mixed questions, 3 lives. Beat a boss to open the next area.</small></h2><div class="g-map">' +
      MAP.map(function(m, ix){
        var b = g.boss[m[0]] || {}, open = bossOpen(ix), n = m[0] === "all" ? A.CARDS.length : A.CARDS.filter(function(c){ return c.area === m[0]; }).length;
        var hearts = b.w ? '<span class="g-hearts">' + [0,1,2].map(function(k){ return k < b.bl ? "&#9829;" : "&#9825;"; }).join("") + '</span>' : "";
        return '<button class="g-node' + (b.w ? " won" : open ? " open" : " shut") + '" data-boss="' + ix + '"' + (open ? "" : " disabled") + '>' +
          '<span class="g-dot">' + (b.w ? "&#10003;" : open ? (ix + 1) : "&#128274;") + '</span><span class="g-nt"><b>' + m[1] + '</b><small>' + m[2] + ' &middot; ' + n + ' cards' +
          (b.w ? ' &middot; beaten ' + b.w + 'x' : b.tries ? ' &middot; ' + b.tries + ' tr' + (b.tries > 1 ? "ies" : "y") : '') + '</small></span>' + hearts + '</button>';
      }).join("") + '</div>';
    /* collection */
    var unl = thUnlocked(), cr = TH_LIST.filter(function(t){ return thState(t.k) === "cracked"; }).length;
    h += '<h2 class="sec">Theorist collection <small class="g-sm">' + unl + ' / ' + TH_LIST.length + ' unlocked' + (cr ? ' &middot; ' + cr + ' cracked' : '') +
      '. Get a person\'s cards right ' + UNLOCK + ' times to unlock them. Miss one later and the card cracks until you fix it.</small></h2>' +
      '<div class="chips" id="g-thf">' + [["all", "All"], ["ok", "Unlocked"], ["cracked", "Cracked"], ["locked", "Locked"], ["legendary", "Legendary"]].map(function(x){
        return '<button class="chip' + (TH_FILTER === x[0] ? " on" : "") + '" data-f="' + x[0] + '">' + x[1] + '</button>'; }).join("") + '</div>' +
      '<input class="search" id="g-thq" placeholder="Find a theorist (Wundt, Fredrickson, Freud...)" value="' + A.esc(TH_Q) + '">' +
      '<div class="g-dex" id="g-dex"></div>';
    /* badges */
    var have = BADGES.filter(function(b){ return g.bdg[b[0]]; }).length;
    h += '<h2 class="sec">Badges <small class="g-sm">' + have + ' / ' + BADGES.length + '</small></h2><div class="g-badges">' +
      BADGES.map(function(b){ var on = !!g.bdg[b[0]]; return '<div class="g-bdg' + (on ? " on" : "") + '"><b>' + (on ? "&#127942; " : "&#128274; ") + b[1] + '</b><span>' + b[2] + '</span></div>'; }).join("") + '</div>';
    /* bests */
    var B = g.best, st = g.st, acc = st.ans ? Math.round((st.right || 0) * 100 / st.ans) : 0;
    h += '<h2 class="sec">Beat your best</h2><div class="tiles">' +
      [[B.round ? B.round + "/20" : "-", "best drill round"], [B.combo || 0, "best duel combo"], [B.speed || 0, "best speed round"], [B.streak || 0, "longest streak"],
       [B.dayxp || 0, "most XP in a day (today " + d.x + ")"], [bossWins() + "/" + MAP.length, "bosses beaten"], [(st.right || 0), "right answers ever"], [acc + "%", "accuracy all time"]]
      .map(function(t){ return '<div class="tile"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>'; }).join("") + '</div>';
    root.innerHTML = h;
    drawDex();
    document.getElementById("g-thf").onclick = function(e){ var b = e.target.closest(".chip"); if (b){ TH_FILTER = b.dataset.f; draw(); } };
    document.getElementById("g-thq").oninput = function(e){ TH_Q = e.target.value; drawDex(); };
    document.getElementById("g-rev").onclick = function(){ startRun("revenge"); };
    document.getElementById("g-speed").onclick = function(){ startRun("speed"); };
    root.querySelector(".g-map").onclick = function(e){ var b = e.target.closest("[data-boss]"); if (b && !b.disabled) startRun("boss", +b.dataset.boss); };
  }
  function drawDex(){
    var q = A.norm(TH_Q), el = document.getElementById("g-dex"), g = G();
    var ts = TH_LIST.filter(function(t){ var s = thState(t.k);
      if (TH_FILTER === "legendary" ? rarity(t) !== "legendary" : TH_FILTER !== "all" && s !== TH_FILTER) return false;
      return !q || A.norm(t.name).indexOf(q) >= 0; });
    el.innerHTML = ts.slice(0, 120).map(function(t){ var s = thState(t.k), r = (g.th[t.k] || {}).r || 0;
      return '<button class="g-tc ' + s + ' ' + rarity(t) + '" data-th="' + t.k + '"><b>' + (s === "locked" && r === 0 ? "???" : A.esc(t.name)) + '</b>' +
        '<small>' + (s === "locked" ? (r === 0 ? A.esc(t.name.split(" ").slice(-1)[0][0]) + '... &middot; ' : '') + r + '/' + UNLOCK : s === "cracked" ? "CRACKED: tap to fix" : rarity(t)) + ' &middot; ' + t.cards.length + ' card' + (t.cards.length > 1 ? "s" : "") + '</small></button>';
    }).join("") + (ts.length > 120 ? '<div class="g-sm">Showing 120 of ' + ts.length + '. Search to narrow.</div>' : '') + (ts.length ? '' : '<div class="empty">None here yet.</div>');
    el.onclick = function(e){ var b = e.target.closest("[data-th]"); if (!b) return; var t = TH[b.dataset.th];
      A.drillCards(t.cards.map(function(id){ return A.BY[id]; }), "who"); };
  }

  /* ---------- runner: boss, revenge, speed ---------- */
  var R = null, timer = null;
  function pickBoss(ix){
    var area = MAP[ix][0], P = A.P(), n = area === "all" ? 15 : 10;
    var cs = area === "all" ? A.CARDS.slice() : A.CARDS.filter(function(c){ return c.area === area; });
    var weak = A.shuffle(cs.filter(function(c){ var s = P.c[c.id]; return s && s.b < 2; })).slice(0, Math.ceil(n / 3));
    var rest = A.shuffle(cs.filter(function(c){ return weak.indexOf(c) < 0; }));
    return A.shuffle(weak.concat(rest).slice(0, n));
  }
  function startRun(kind, ix){
    var cards = kind === "boss" ? pickBoss(ix) : kind === "revenge" ? A.shuffle(revengePool().map(function(id){ return A.BY[id]; })).slice(0, 10) : A.shuffle(A.CARDS.slice());
    if (!cards.length) return;
    R = {kind: kind, ix: ix, cards: cards, i: 0, lives: kind === "speed" ? null : 3, right: 0, hits: [], wrongs: []};
    if (kind === "boss"){ var b = G().boss[MAP[ix][0]] || (G().boss[MAP[ix][0]] = {}); b.tries = (b.tries || 0) + 1; A.save(); }
    if (kind === "speed"){ R.end = Date.now() + 60000; clearInterval(timer); timer = setInterval(tick, 250); }
    document.getElementById("g-hub").classList.add("hide");
    document.getElementById("g-run").classList.remove("hide");
    q(); window.scrollTo(0, 0);
  }
  function tick(){
    if (!R || R.kind !== "speed"){ clearInterval(timer); return; }
    var left = Math.max(0, Math.ceil((R.end - Date.now()) / 1000)), el = document.getElementById("g-clock");
    if (el) el.textContent = left + "s";
    if (left <= 0){ clearInterval(timer); finish(); }
  }
  function head(){
    if (R.kind === "speed") return '<div class="g-rh"><b>Speed round</b><span id="g-clock" class="g-clock">60s</span><span>' + R.right + ' right</span></div>';
    var name = R.kind === "boss" ? MAP[R.ix][1] : "Revenge round", tot = R.cards.length, hp = Math.round((tot - R.right) * 100 / tot);
    return '<div class="g-rh"><b>' + name + '</b><span class="g-hearts">' + [0,1,2].map(function(k){ return k < R.lives ? "&#9829;" : "&#9825;"; }).join("") + '</span><span>' + (R.i + 1) + ' / ' + tot + '</span></div>' +
      '<div class="g-hp"><i style="width:' + hp + '%"></i><span>Boss HP</span></div>';
  }
  function q(){
    var el = document.getElementById("g-run");
    if (R.kind !== "speed" && (R.lives <= 0 || R.i >= R.cards.length)) return finish();
    if (R.kind === "speed" && R.i >= R.cards.length) R.i = 0;
    var c = R.cards[R.i], modes = c.wl ? ["name", "desc", "who"] : ["name", "desc"];
    var mode = R.kind === "speed" ? "desc" : modes[Math.floor(Math.random() * modes.length)];
    var field = mode === "name" ? "qd" : mode === "desc" ? "name" : "wl";
    var opts = A.shuffle([c].concat(A.distract(c, field, 3)));
    var cat = '<span class="cat c-' + c.cat + '">' + A.CATNAME[c.cat] + '</span>';
    var prompt = mode === "name" ? '<div class="prompt-k">What does this mean?</div><div class="prompt">' + cat + A.esc(c.name) + '</div>'
      : mode === "desc" ? '<div class="prompt-k">Name it (' + A.CATNAME[c.cat].toLowerCase() + ')</div><div class="prompt small">' + A.esc(c.qd) + '</div>'
      : '<div class="prompt-k">Who did it?</div><div class="prompt">' + cat + A.esc(c.qw) + '</div><div class="fld" style="color:var(--muted)">' + A.esc(c.qwd) + '</div>';
    el.innerHTML = head() + '<div class="card">' + prompt + '<div class="opts">' + opts.map(function(o){ return '<button class="opt" data-id="' + o.id + '">' + A.esc(o[field]) + '</button>'; }).join("") +
      '</div><div id="g-rv"></div></div><div class="row2"><button class="btn ghost" id="g-quit">' + (R.kind === "speed" ? "Stop" : "Run away") + '</button></div>';
    if (R.kind === "speed") tick();
    document.getElementById("g-quit").onclick = function(){ if (R.kind === "speed") finish(); else back(); };
    el.querySelector(".opts").onclick = function(e){
      var b = e.target.closest(".opt"); if (!b || b.disabled) return;
      var ok = b.dataset.id === c.id;
      el.querySelectorAll(".opt").forEach(function(x){ x.disabled = true; if (x.dataset.id === c.id) x.classList.add("ok"); });
      if (!ok) b.classList.add("bad");
      var cleared = A.srs(c, ok);
      if (ok){ R.right++; R.hits.push(c); } else { R.wrongs.push(c); if (R.lives != null) R.lives--; }
      answer({c: c, ok: ok, src: R.kind, mode: mode, cleared: cleared});
      if (R.kind === "speed"){ R.i++; setTimeout(function(){ if (R && R.kind === "speed" && Date.now() < R.end) q(); }, ok ? 350 : 1100); return; }
      var hpEl = el.querySelector(".g-hp i"); if (hpEl) hpEl.style.width = Math.round((R.cards.length - R.right) * 100 / R.cards.length) + "%";
      var hearts = el.querySelector(".g-rh .g-hearts"); if (hearts) hearts.innerHTML = [0,1,2].map(function(k){ return k < R.lives ? "&#9829;" : "&#9825;"; }).join("");
      document.getElementById("g-rv").innerHTML = '<div class="reveal">' + (ok ? '<div class="g-hit">Hit! The boss takes damage.</div>' : '<div class="g-miss">You lose a life.' + (R.lives ? ' ' + R.lives + ' left.' : '') + '</div>') +
        A.cardHtml(c) + '<div class="row2"><button class="btn" id="g-nx">' + (R.lives <= 0 ? "See result" : R.i + 1 >= R.cards.length ? "Finish" : "Next") + '</button></div></div>';
      document.getElementById("g-nx").onclick = function(){ R.i++; q(); window.scrollTo(0, 0); };
    };
  }
  function finish(){
    clearInterval(timer);
    var el = document.getElementById("g-run"), g = G(), h = "", win = false;
    if (R.kind === "speed"){
      var b = g.best.speed || 0, nb = R.right > b; setBest("speed", R.right);
      if (nb && R.right){ confetti(); SFX.win(); }
      h = '<div class="g-big">' + R.right + ' right in 60s</div><div class="g-best">' + (nb ? (b ? '<b>New best!</b> Old best ' + b + '.' : 'Your first score. Beat it next time.') : 'Best: <b>' + b + '</b>. ' + (b - R.right) + ' short.') + '</div>';
    } else {
      win = R.lives > 0;
      if (R.kind === "boss"){
        var m = MAP[R.ix], bs = g.boss[m[0]] || (g.boss[m[0]] = {}), first = !bs.w;
        if (win){ bs.w = (bs.w || 0) + 1; bs.bl = Math.max(bs.bl || 0, R.lives); bump("boss");
          addXP(100 + 50 * R.lives); questTick({c: {}, bossWin: true}); SFX.win(); confetti(220); }
        h = win ? '<div class="g-big">&#127942; ' + m[1] + ' defeated</div><div class="g-best">' + R.right + ' / ' + R.cards.length + ' with ' + R.lives + ' li' + (R.lives > 1 ? "ves" : "fe") + ' left. +' + (100 + 50 * R.lives) + ' XP.' +
            (first && MAP[R.ix + 1] ? ' <b>' + MAP[R.ix + 1][1] + '</b> is now open.' : '') + (R.lives < 3 ? ' Win with all 3 lives for the flawless badge.' : '') + '</div>'
          : '<div class="g-big">&#128128; ' + m[1] + ' won this time</div><div class="g-best">Out of lives at question ' + R.i + '. The cards you missed are in My misses; drill them and come back.</div>';
      } else {
        if (win){ var P = A.P(); R.hits.forEach(function(c){ if (P.m[c.id]){ P.m[c.id].done = true; } }); bump("rev");
          addXP(75); SFX.win(); confetti(); }
        h = win ? '<div class="g-big">&#9876; Revenge served</div><div class="g-best">' + R.hits.length + ' card' + (R.hits.length !== 1 ? "s" : "") + ' cleared from My misses. +75 XP.</div>'
          : '<div class="g-big">Revenge failed</div><div class="g-best">Nothing cleared. The misses stay until you win a revenge round or get each one right twice in a drill.</div>';
      }
    }
    if (R.wrongs.length) h += '<div class="fld">Missed: ' + R.wrongs.map(function(c){ return '<span class="lk" data-open="' + c.id + '">' + A.esc(c.name) + '</span>'; }).join(", ") + '</div>';
    A.save(); badgeCheck(); hud();
    var again = R.kind === "boss" ? "Fight again" : R.kind === "speed" ? "Go again" : "Again";
    el.innerHTML = '<div class="card">' + h + '<div class="row2"><button class="btn" id="g-again">' + again + '</button><button class="btn ghost" id="g-back">Back to map</button></div></div>';
    var k = R.kind, ix = R.ix;
    document.getElementById("g-again").onclick = function(){ if (k === "revenge" && !revengePool().length){ back(); return; } startRun(k, ix); };
    document.getElementById("g-back").onclick = back;
  }
  function back(){ clearInterval(timer); R = null; document.getElementById("g-run").classList.add("hide"); document.getElementById("g-hub").classList.remove("hide"); draw(); }

  window.NLG = {answer: answer, duel: duel, roundEnd: roundEnd, draw: draw, hud: hud, resetCombo: function(){ combo = 0; }, _people: people, _TH: TH_LIST};
  hud();
  if (A.cur() === "play") draw();
})();
