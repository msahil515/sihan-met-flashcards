/* Sunset redesign preview. Static sample state, real questions and cards from the
   apps' own data (St John's Mock 1 and the Name Lock deck). Nothing is saved. */
(function () {
  "use strict";
  var Q = new URLSearchParams(location.search);
  var SCREEN = Q.get("s") || "hub";
  var SHOT = Q.get("shot") === "1";
  var app = document.getElementById("app");
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (SHOT) document.body.classList.add("shot");

  /* ---------- icons ---------- */
  var I = {
    flame: '<svg viewBox="0 0 24 24" class="ico"><path fill="url(#g-flame)" d="M12.6 2.2c.6 3.2 4.9 5.3 4.9 10.6a5.6 5.6 0 0 1-11.2.3c0-2.4 1.2-4.1 2.4-5.2.1 2 1 3.2 2.1 3.5-.4-3.3-.3-6.4 1.8-9.2z"/><path fill="#FFF1C2" opacity=".85" d="M12.2 13.4c1.6 1.4 2.6 2.6 2.6 4.2a2.8 2.8 0 0 1-5.6 0c0-1.3.9-2.2 1.6-2.8.1.9.6 1.4 1.1 1.5-.2-1.1-.1-2 .3-2.9z"/></svg>',
    spark: '<svg viewBox="0 0 24 24" class="ico"><path fill="url(#g-star)" d="M12 1.5l2.4 7.9 8 2.6-8 2.6L12 22.5l-2.4-7.9-8-2.6 8-2.6z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    star: function (on) { return '<svg viewBox="0 0 24 24" class="' + (on ? "" : "off") + '"><path fill="' + (on ? "url(#g-star)" : "rgba(255,240,220,.18)") + '" stroke="' + (on ? "#FFF3C9" : "rgba(255,240,220,.3)") + '" stroke-width="1" d="M12 2.2l2.9 6.2 6.7.8-5 4.6 1.4 6.7L12 17.1l-6 3.4 1.4-6.7-5-4.6 6.7-.8z"/></svg>'; }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(n) { return n.toLocaleString("en-IN"); }
  function go(s, extra) { location.search = "?s=" + s + (SHOT ? "&shot=1" : "") + (extra || ""); }
  function hubLink() { return '<a class="backhub" href="?s=hub">All preview screens</a>'; }
  function scene(art, pos, sx, sy, h, dim) {
    return '<div class="scene' + (dim ? " " + dim : "") + '" style="--art:url(assets/' + art + '.webp);--pos:' + pos + ";--sx:" + sx + ";--sy:" + sy + ";--h:" + h + '">' +
      '<div class="art"></div><div class="rays"></div><div class="glow"></div></div>';
  }

  /* ---------- sample player state (preview only) ---------- */
  // Tests: level = 1 + floor(sqrt(xp / 60)), titles every 2 levels (same formula as tests-app/app.js)
  var TT = ["Fresher", "Aspirant", "Trainee", "Intern", "Resident", "Senior Resident", "Fellow", "Consultant", "Topper"];
  function tLevel(xp) { return 1 + Math.floor(Math.sqrt(xp / 60)); }
  function tTitle(lv) { return TT[Math.min(TT.length - 1, Math.floor((lv - 1) / 2))]; }
  function tBand(xp) { var lv = tLevel(xp), lo = 60 * Math.pow(lv - 1, 2), hi = 60 * lv * lv; return { lv: lv, pct: Math.round(100 * (xp - lo) / (hi - lo)), left: hi - xp }; }
  // Name Lock: thresholds and ranks from name-lock/app/worlds.js
  var NLV = [0, 150, 350, 600, 900, 1300, 1800, 2400, 3100, 4000, 5000];
  function nBand(xp) { var l = 1; while (l < NLV.length && xp >= NLV[l]) l++; var lo = NLV[l - 1], hi = NLV[l]; return { lv: l, pct: Math.round(100 * (xp - lo) / (hi - lo)), left: hi - xp }; }
  function nRank(l) { return l <= 3 ? "Intern" : l <= 6 ? "Resident" : l <= 9 ? "Senior Resident" : "Consultant"; }

  function hud(lv, title, pct, note, streak) {
    return '<header class="hud"><div class="crest" style="--p:' + pct + '%"><b>' + lv + '</b></div>' +
      '<div class="who"><b>Sihan</b><span>' + title + '</span><div class="xpbar" style="--w:' + pct + '%"><i></i></div><div class="xpnote">' + note + "</div></div>" +
      '<div class="pill" title="Day streak">' + I.flame + streak + "<small>days</small></div></header>";
  }

  /* ================= TESTS ================= */
  var T_XP = 1640, T_STREAK = 6;
  var GROUPS = [
    { stub: "SJ", c: "linear-gradient(180deg,#FF9A62,#E2553C)", name: "St John's Bengaluru", sub: "1 paper, 100 questions", when: "25 Nov, in 14 days", best: "29.5", bestK: "so far" },
    { stub: "JSS", c: "linear-gradient(180deg,#3FD8BF,#118C80)", name: "JSS Mysuru", sub: "2 papers, 180 questions", best: "61", bestK: "best" },
    { stub: "IH", c: "linear-gradient(180deg,#FFC85A,#E68A2E)", name: "IHBAS", sub: "3 papers, real keys", best: "84", bestK: "best" },
    { stub: "PYQ", c: "linear-gradient(180deg,#F86A8F,#C23762)", name: "NIMHANS and pan-India PYQ", sub: "5 papers", best: "72", bestK: "best" },
    { stub: "MET", c: "linear-gradient(180deg,#2FA7B5,#0E6E73)", name: "MET-pattern mocks", sub: "6 papers", best: "68", bestK: "best" }
  ];

  function testsHome() {
    var b = tBand(T_XP);
    var h = scene("sunset-coast", "64% 42%", "50%", "33%", "560px") +
      '<div class="col">' + hud(b.lv, tTitle(b.lv), b.pct, fmt(b.left) + " XP to level " + (b.lv + 1), T_STREAK) +
      '<section class="poster"><h1>St John\'s<span class="soft">in 14 days</span></h1><p>25 Nov, Bengaluru. 100 MCQs in 90 minutes, interview straight after.</p></section>' +
      '<section class="glass resume"><div class="ring" style="--p:38"><b>38<small>of 100</small></b></div>' +
      '<div><h3>St John\'s Mock 1</h3><p>100 real past-paper questions. Score so far 29.5, best run 6 in a row.</p></div>' +
      '<button class="btn" data-go="tests-q">Resume paper ' + I.next + "</button></section>" +
      '<div class="today"><b>12 of 20 today</b><span class="chip sun">' + I.spark + " Best combo 14</span><div class=\"bar\"><i></i></div></div>" +
      '<h2 class="sec">Papers</h2>' +
      GROUPS.map(function (g) {
        return '<button class="ticket" data-go="tests-q"><span class="stub" style="--c:' + g.c + '">' + g.stub + "</span>" +
          '<span class="body"><b>' + esc(g.name) + "</b><span>" + g.sub + "</span>" + (g.when ? '<span class="when">' + g.when + "</span>" : "") + "</span>" +
          '<span class="best">' + g.best + "<small>" + g.bestK + "</small></span></button>";
      }).join("") + "</div>" + hubLink();
    app.innerHTML = '<div class="screen">' + h + "</div>";
  }

  // Q12-14 of St John's Mock 1 (take/data-sjmc.js, questions 1, 12 and 16), explanations trimmed to the first lines
  var TQ = [
    { sec: "General and Cognitive Psychology", q: 'A therapist uses "time-out" to manage a child\'s aggressive outbursts. Time-out is technically classified as a form of:',
      o: { a: "Positive Punishment", b: "Negative Reinforcement", c: "Negative Punishment", d: "Positive Reinforcement" }, c: "c",
      e: "Time-out removes something the child likes (attention, play) to make the outburst less likely. Removal is negative, decrease is punishment, so it is negative punishment." },
    { sec: "Social Psychology", q: "The tendency to overestimate the influence of personality and underestimate the influence of situation is called",
      o: { a: "Self-serving Bias.", b: "Fundamental Attribution Error.", c: "Confirmation Bias.", d: "Cognitive Dissonance." }, c: "b",
      e: "Lee Ross named it. When explaining someone else's behaviour we over-weight their character and under-weight the situation. Jones and Harris showed it with the pro-Castro essays." },
    { sec: "Clinical Psychology and Therapy", q: "Subjective unit of distress (SUD) is mostly used under:",
      o: { a: "Exposure & response prevention", b: "Multi-model therapy", c: "Mindfulness-based stress management", d: "Systematic desensitization" }, c: "d",
      e: "Wolpe's 0 to 100 SUDs ratings are how the fear hierarchy in systematic desensitization is built and paced, so the answer is d." }
  ];
  var TCOLORS = ["#FFD36B", "#FFC24B", "#FFB04F", "#FF9C55", "#FF8257", "#FF7360", "#F9646B", "#F45872", "#F04E78", "#F04E78"];
  var tq = { i: +(Q.get("q") || 0), combo: 4, xp: T_XP, answered: false };

  function heat(combo, crack) {
    var t = "";
    for (var i = 0; i < 10; i++) t += '<i class="' + (i < combo ? "on" : "") + '" style="--tc:' + TCOLORS[i] + '"></i>';
    return '<div class="heat"><span class="lbl' + (combo ? "" : " cold") + '">' + I.flame + (combo ? combo + " in a row" : "Combo broken") + "</span>" +
      '<div class="ticks' + (crack ? " crack" : "") + '">' + t + "</div></div>";
  }

  function testsQ() {
    var q = TQ[tq.i], n = 12 + tq.i;
    var h = scene("sunset-coast", "58% 46%", "45%", "40%", "300px", "dim") +
      '<div class="col"><header class="qtop"><button class="iconbtn" data-go="tests-home" aria-label="Back to papers">' + I.back + "</button>" +
      '<div class="mid"><b>St John\'s Mock 1</b><span>Question ' + n + " of 100</span></div>" +
      '<div class="pill xpp" id="xpp">' + I.spark + '<span id="xpn">' + fmt(tq.xp) + "</span></div></header>" +
      '<div class="prog" style="--w:' + n + '%"><i></i></div>' +
      '<div id="heat">' + heat(tq.combo) + "</div>" +
      '<section class="glass qcard" id="card"><div class="chips"><span class="chip">' + q.sec + "</span></div>" +
      '<p class="stem">' + esc(q.q) + "</p>" +
      '<div class="opts" id="opts">' + ["a", "b", "c", "d"].map(function (k) {
        return '<button class="opt" data-k="' + k + '"><span class="k">' + k.toUpperCase() + '</span><span class="t">' + esc(q.o[k]) + '</span><span class="mark"></span></button>';
      }).join("") + "</div></section>" +
      '<div id="after"></div></div>' + hubLink();
    app.innerHTML = '<div class="screen">' + h + "</div>";
    tq.answered = false;
  }

  function answerTests(btn) {
    if (tq.answered) return; tq.answered = true;
    var q = TQ[tq.i], k = btn.getAttribute("data-k"), ok = k === q.c;
    var opts = document.querySelectorAll("#opts .opt");
    opts.forEach(function (o) {
      var ok2 = o.getAttribute("data-k") === q.c;
      if (ok2) { o.classList.add("right", "pop"); o.querySelector(".mark").innerHTML = I.check; }
      else if (o === btn) { o.classList.add("wrong"); o.querySelector(".mark").innerHTML = I.cross; }
      else o.classList.add("dim");
    });
    var r = btn.getBoundingClientRect();
    if (ok) {
      tq.combo++;
      var gain = 10 + (tq.combo >= 3 ? 5 : 0) + (tq.combo >= 10 ? 5 : 0);
      tq.xp += gain;
      var g = document.createElement("span"); g.className = "gain"; g.textContent = "+" + gain + " XP"; btn.appendChild(g);
      var st = document.createElement("div"); st.className = "stamp"; st.innerHTML = "x" + tq.combo + "<small>combo</small>"; document.getElementById("card").appendChild(st);
      document.getElementById("heat").innerHTML = heat(tq.combo);
      setTimeout(function () { var p = document.getElementById("xpp"); document.getElementById("xpn").textContent = fmt(tq.xp); p.classList.remove("bump"); void p.offsetWidth; p.classList.add("bump"); }, 520);
      flash("good", r); burst(r.left + r.width * 0.5, r.top + r.height * 0.5, 34);
      buzz([18]);
    } else {
      tq.combo = 0;
      document.getElementById("heat").innerHTML = heat(0, true);
      flash("bad", r); buzz([40, 60, 40]);
    }
    var last = tq.i === TQ.length - 1;
    document.getElementById("after").innerHTML =
      '<section class="verdict ' + (ok ? "good" : "bad") + '"><h4>' + (ok ? "Right. " + esc(q.o[q.c].replace(/\.$/, "")) + "." : "Not quite. It's " + q.c.toUpperCase() + ".") + "</h4>" +
      "<p>" + esc(q.e) + '</p><a class="more" href="#" onclick="return false">Read the full explanation</a>' +
      (ok ? "" : '<div class="note">' + I.check.replace("<svg", '<svg width="16" height="16"') + " Added to your To study list</div>") + "</section>" +
      '<div class="next"><button class="btn" data-go="' + (last ? "tests-results" : "tests-q-next") + '">' + (last ? "Finish and see results" : "Next question") + " " + I.next + "</button></div>";
  }

  function testsResults() {
    var before = tBand(T_XP), after = tBand(T_XP + 985);
    var SUBJ = [["General and Cognitive", 9, 11], ["Assessment", 10, 14], ["Social", 8, 9], ["Personality", 7, 10], ["Biopsychology", 6, 9],
      ["Developmental", 8, 10], ["Clinical and Therapy", 11, 13], ["Psychopathology", 9, 12], ["Research and Stats", 8, 12]];
    var h = scene("sunset-coast", "60% 38%", "50%", "30%", "640px") +
      '<div class="col"><header class="res-top"><button class="iconbtn" data-go="tests-home" aria-label="Close">' + I.close + "</button>" +
      '<div class="pill">' + I.flame + T_STREAK + "<small>days</small></div></header>" +
      '<section class="score"><div class="what">St John\'s Mock 1, practice run</div><div class="big" id="big">71.5</div><div class="of">out of 100</div>' +
      '<div class="stars">' + I.star(true) + I.star(true) + I.star(false) + "</div></section>" +
      '<div class="trio"><div class="r"><b>76</b><span>Right</span></div><div class="w"><b>18</b><span>Wrong</span></div><div class="s"><b>6</b><span>Skipped</span></div></div>' +
      '<section class="glass xpcard"><div class="plus">+985 XP</div><div class="lv">Level <b>' + before.lv + "</b> to <b>" + after.lv + "</b></div>" +
      '<div class="xpbar" style="--w:' + (SHOT ? after.pct : 0) + '%" id="rxp"><i></i></div>' +
      '<div class="ribbon"><span class="chip sun">' + I.spark + " Level up: " + tTitle(after.lv) + '</span><span class="chip">Best combo 14</span><span class="chip">All 18 misses saved to To study</span></div></section>' +
      '<h2 class="sec">By subject</h2><section class="glass subj">' + SUBJ.map(function (s, i) {
        var p = s[1] / s[2], c = p >= 0.8 ? "#3FD8BF" : p >= 0.7 ? "#FFC24B" : "#FF7C6A";
        return '<div class="row"><span>' + s[0] + (p < 0.7 ? '<span class="flag">study next</span>' : "") + "</span><b>" + s[1] + "/" + s[2] + "</b>" +
          '<div class="b"><i style="--w:' + Math.round(p * 100) + "%;--c:" + c + ";animation-delay:" + (0.4 + i * 0.07) + 's"></i></div></div>';
      }).join("") + "</section>" +
      '<div class="actions"><button class="btn" data-go="tests-q">Review 18 misses ' + I.next + '</button><button class="btn ghost" data-go="tests-home">Back to papers</button></div></div>' + hubLink();
    app.innerHTML = '<div class="screen">' + h + "</div>";
    if (!SHOT) {
      countUp(document.getElementById("big"), 71.5, 1100);
      setTimeout(function () { document.getElementById("rxp").style.setProperty("--w", after.pct + "%"); }, 400);
      setTimeout(function () { burst(innerWidth / 2, innerHeight * 0.22, 60); }, 300);
      if (SCREEN === "tests-results") setTimeout(function () { levelUp(after.lv, tTitle(after.lv), "Tests"); }, 2600);
    }
  }

  function levelUp(lv, title, appName) {
    var el = document.createElement("div"); el.className = "lvup";
    el.innerHTML = '<div class="bg"></div><div class="rays"></div><div class="inner"><div class="disc"><b>' + lv + '</b></div><h2>Level up</h2><p>You\'re ' + (/^[AEIOU]/.test(title) ? "an " : "a ") + title + " now</p>" +
      '<div class="chips"><span class="chip sun">' + I.spark + " New title: " + title + '</span><span class="chip">' + appName + " level " + lv + "</span></div>" +
      '<button class="btn">Keep going ' + I.next + "</button></div>";
    el.querySelector(".btn").onclick = function () { el.remove(); };
    document.body.appendChild(el);
    setTimeout(function () { burst(innerWidth / 2, innerHeight * 0.4, 90); }, 250);
    buzz([30, 50, 30, 50, 80]);
  }

  /* ================= NAME LOCK ================= */
  var N_XP = 1180, N_STREAK = 7;
  // pin spots on memory-city.webp (fractions of the painting)
  var WORLDS = [
    { name: "Who Said What", tag: "A city of theorist statues", x: .105, y: .42, prog: 42, best: "11 in a row", next: "Structuralism", nextK: "Next boss" },
    { name: "Biopsych", tag: "A glowing brain with pulsing neurons", x: .80, y: .60, prog: 18, best: "6 in a row", next: "Neuron", nextK: "Next boss" },
    { name: "Dissertation", tag: "Your own study, the way a viva panel walks it", x: .66, y: .26, prog: 55, best: "9/16", bestK: "Nailed", next: "Results", nextK: "Next level" },
    { name: "JSS Interview", tag: "The panel room: openers, your work, cases, ethics, law, definitions", x: .265, y: .52, prog: 30, best: "7/24", bestK: "Nailed", next: "Ethics", nextK: "Next level" },
    { name: "Stats and Research", tag: "A lab world of data towers and graphs", x: .43, y: .17, locked: true, next: "Normal Curve", nextK: "Boss" }
  ];
  var wi = +(Q.get("w") || 0);
  var ART = { w: 1536, h: 1024 };

  function nlWorlds() {
    var b = nBand(N_XP), w = WORLDS[wi];
    var mh = Math.min(Math.round(innerHeight * 0.8), 760), mw = Math.round(mh * ART.w / ART.h);
    if (mw < innerWidth) { mw = innerWidth; mh = Math.round(mw * ART.h / ART.w); } // wide screens: cover the width
    var wh = Math.min(mh, Math.round(innerHeight * 0.8));
    var pins = WORLDS.map(function (p, i) {
      return '<button class="pin' + (i === wi ? " on" : "") + (p.locked ? " locked" : "") + '" data-w="' + i + '" style="left:' + Math.round(p.x * mw) + "px;top:" + Math.round(p.y * mh) + 'px">' +
        '<span class="beacon"></span><span class="badge">' + (p.locked ? I.lock : "<b>" + (i + 1) + "</b>") + '</span><span class="plate">' + (p.locked ? "Locked" : esc(p.name)) + "</span></button>";
    }).join("");
    var stats = w.locked
      ? '<div class="wstat"><b>Locked</b><span>Beat the Pinel Final Boss</span></div><div class="wstat"><b>' + w.next + "</b><span>" + w.nextK + "</span></div>"
      : '<div class="wstat"><b>' + w.best + "</b><span>" + (w.bestK || "Best combo") + '</span></div><div class="wstat"><b>' + w.next + "</b><span>" + w.nextK + "</span></div>";
    var h = '<div class="mapwrap" style="--mh:' + wh + 'px"><div class="map" id="map" style="width:' + mw + "px;height:" + mh + 'px"><img src="assets/memory-city.webp" alt="" draggable="false">' + pins + "</div></div>" +
      '<div class="col">' + hud(b.lv, nRank(b.lv), b.pct, fmt(b.left) + " XP to level " + (b.lv + 1), N_STREAK) +
      '<section class="glass sheet" style="--mh:' + mh + 'px"><div class="kick">World ' + (wi + 1) + " of 5</div><h1>" + esc(w.name) + '</h1><p class="tag">' + esc(w.tag) + "</p>" +
      '<div class="wstats"><div class="ring" style="--p:' + (w.prog || 0) + '"><b>' + (w.prog || 0) + "%</b></div>" + stats + "</div>" +
      (w.locked ? '<button class="btn ghost" disabled>' + I.lock.replace("<svg", '<svg width="20" height="20"') + " Locked</button>" : '<button class="btn" data-go="nl-q">Enter world ' + I.next + "</button>") +
      '<div class="wnav"><button class="iconbtn" data-wstep="-1" aria-label="Previous world">' + I.back + '</button><div class="dots">' +
      WORLDS.map(function (_, i) { return '<i class="' + (i === wi ? "on" : "") + '"></i>'; }).join("") +
      '</div><button class="iconbtn" data-wstep="1" aria-label="Next world" style="transform:scaleX(-1)">' + I.back + "</button></div></section></div>" + hubLink();
    app.innerHTML = '<div class="screen worlds">' + h + "</div>";
    aimCamera(mw, mh, false);
  }
  function aimCamera(mw, mh, animate) {
    var w = WORLDS[wi], map = document.getElementById("map");
    var wh = map.parentNode.offsetHeight;
    var tx = Math.max(Math.min(innerWidth * 0.5 - w.x * mw, 0), innerWidth - mw);
    var ty = Math.max(Math.min(wh * 0.42 - w.y * mh, 60), Math.min(0, wh - mh));
    if (!animate) map.style.transition = "none";
    map.style.transform = "translate3d(" + tx + "px," + ty + "px,0)";
    if (!animate) { void map.offsetWidth; map.style.transition = ""; }
  }

  // Name Lock drill cards (name-lock/data.js): description to name, lookalike always in the options
  var NQ = [
    { mode: "Description to name", area: "Memory", d: "Unfinished or interrupted tasks are remembered better than finished ones.",
      o: ["Ovsiankina effect", "Zeigarnik effect", "Von Restorff effect", "Serial position effect"], c: 1, who: "Bluma Zeigarnik", year: "1927",
      tell: "Zeigarnik = you REMEMBER the unfinished task; Ovsiankina = you go back to FINISH it.",
      ex: "A waiter remembers unpaid orders in detail but forgets them once the bill is settled." },
    { mode: "Description to name", area: "Research", d: "Low expectations placed on a person lead to poorer performance.",
      o: ["Pygmalion effect", "Hawthorne effect", "Golem effect", "John Henry effect"], c: 2, who: "Babad, Inbar and Rosenthal", year: "1982",
      tell: "Golem = a clay monster, LOW expectations; Pygmalion = HIGH expectations.",
      ex: "A teacher who has written off the back bench calls on them less, and their marks fall." },
    { mode: "Who did it", area: "Social", d: "Who named the fundamental attribution error?",
      o: ["Jones and Nisbett", "Lee Ross", "Fritz Heider", "Leon Festinger"], c: 1, who: "Lee Ross", year: "1977",
      tell: "FAE is about OTHERS only (dispositional overkill); actor-observer is the SELF vs OTHER contrast (situation for me, trait for you).",
      ex: "A waiter is slow, so you decide he is lazy, ignoring that he is covering six tables alone." }
  ];
  var nq = { i: +(Q.get("q") || 0), combo: 3, xp: N_XP, answered: false };

  function nlQ() {
    var c = NQ[nq.i], n = 8 + nq.i;
    var h = scene("memory-city", "8% 42%", "88%", "6%", "320px", "busy") +
      '<div class="col"><header class="qtop"><button class="iconbtn" data-go="nl-worlds" aria-label="Back to worlds">' + I.back + "</button>" +
      '<div class="mid"><b>Who Said What</b><span>Card ' + n + " of 20</span></div>" +
      '<div class="pill xpp" id="xpp">' + I.spark + '<span id="xpn">' + fmt(nq.xp) + "</span></div></header>" +
      '<div class="prog" style="--w:' + (n * 5) + '%"><i></i></div>' +
      '<div id="heat">' + heat(nq.combo) + "</div>" +
      '<section class="glass qcard" id="card"><div class="chips"><span class="chip sun">' + c.mode + '</span><span class="chip">' + c.area + "</span></div>" +
      '<p class="ask">' + (c.mode === "Who did it" ? "Pick the name" : "Which one is it?") + '</p><p class="desc">' + esc(c.d) + "</p>" +
      '<div class="opts" id="opts">' + c.o.map(function (t, i) {
        return '<button class="opt" data-i="' + i + '"><span class="k">' + "ABCD"[i] + '</span><span class="t">' + esc(t) + '</span><span class="mark"></span></button>';
      }).join("") + "</div></section>" +
      '<div id="after"></div></div>' + hubLink();
    app.innerHTML = '<div class="screen">' + h + "</div>";
    nq.answered = false;
  }

  function answerNL(btn) {
    if (nq.answered) return; nq.answered = true;
    var c = NQ[nq.i], i = +btn.getAttribute("data-i"), ok = i === c.c;
    document.querySelectorAll("#opts .opt").forEach(function (o) {
      var j = +o.getAttribute("data-i");
      if (j === c.c) { o.classList.add("right", "pop"); o.querySelector(".mark").innerHTML = I.check; }
      else if (o === btn) { o.classList.add("wrong"); o.querySelector(".mark").innerHTML = I.cross; }
      else o.classList.add("dim");
    });
    var r = btn.getBoundingClientRect();
    if (ok) {
      nq.combo++; nq.xp += 10;
      var g = document.createElement("span"); g.className = "gain"; g.textContent = "+10 XP"; btn.appendChild(g);
      var st = document.createElement("div"); st.className = "stamp"; st.innerHTML = "x" + nq.combo + "<small>combo</small>"; document.getElementById("card").appendChild(st);
      document.getElementById("heat").innerHTML = heat(nq.combo);
      setTimeout(function () { var p = document.getElementById("xpp"); document.getElementById("xpn").textContent = fmt(nq.xp); p.classList.remove("bump"); void p.offsetWidth; p.classList.add("bump"); }, 520);
      flash("good", r); burst(r.left + r.width * 0.5, r.top + r.height * 0.5, 34); buzz([18]);
    } else {
      nq.combo = 0; document.getElementById("heat").innerHTML = heat(0, true); flash("bad", r); buzz([40, 60, 40]);
    }
    var last = nq.i === NQ.length - 1;
    document.getElementById("after").innerHTML =
      '<section class="verdict ' + (ok ? "good" : "bad") + '"><h4>' + (ok ? "Locked in. " : "That's the lookalike. ") + esc(c.o[c.c]) + ".</h4>" +
      '<div class="factrow"><span class="chip">' + esc(c.who) + '</span><span class="chip">' + c.year + "</span></div>" +
      '<div class="tell"><b>The tell</b><p>' + esc(c.tell) + "</p></div>" +
      "<p>" + esc(c.ex) + "</p>" +
      (ok ? "" : '<div class="note">Back in My misses until you get it right twice in a row</div>') + "</section>" +
      '<div class="next"><button class="btn" data-go="' + (last ? "nl-results" : "nl-q-next") + '">' + (last ? "Finish round" : "Next card") + " " + I.next + "</button></div>";
  }

  function nlResults() {
    var before = nBand(N_XP), after = nBand(N_XP + 340);
    var MISS = [
      { n: "Zeigarnik effect", vs: "picked Ovsiankina", t: "Zeigarnik = you REMEMBER the unfinished task; Ovsiankina = you go back to FINISH it." },
      { n: "Golem effect", vs: "picked Pygmalion", t: "Golem = a clay monster, LOW expectations; Pygmalion = HIGH expectations." },
      { n: "Structuralism", vs: "picked Functionalism", t: "Structuralism asks WHAT consciousness is made of (elements). Functionalism asks what consciousness is FOR (adaptation)." }
    ];
    var h = scene("memory-city", "100% 0%", "70%", "12%", "620px", "busy") +
      '<div class="col"><header class="res-top"><button class="iconbtn" data-go="nl-worlds" aria-label="Close">' + I.close + "</button>" +
      '<div class="pill">' + I.flame + N_STREAK + "<small>days</small></div></header>" +
      '<section class="score"><div class="what">Who Said What, drill round</div><div class="big" id="big">17</div><div class="of">out of 20 cards</div>' +
      '<div class="stars">' + I.star(true) + I.star(true) + I.star(false) + "</div></section>" +
      '<div class="trio"><div class="r"><b>6</b><span>Cards cracked</span></div><div class="w"><b>3</b><span>Misses</span></div><div class="s"><b>9</b><span>Best combo</span></div></div>' +
      '<section class="glass xpcard"><div class="plus">+340 XP</div><div class="lv">Level <b>' + before.lv + "</b> to <b>" + after.lv + "</b></div>" +
      '<div class="xpbar" style="--w:' + (SHOT ? after.pct : 0) + '%" id="rxp"><i></i></div>' +
      '<div class="ribbon"><span class="chip sun">' + I.spark + ' Boss open: Structuralism</span><span class="chip">' + nRank(after.lv) + " level " + after.lv + "</span></div></section>" +
      '<h2 class="sec">Your 3 misses</h2>' + MISS.map(function (m) {
        return '<div class="misscard"><b>' + m.n + '</b><span class="vs">' + m.vs + "</span><p>" + esc(m.t) + "</p></div>";
      }).join("") +
      '<div class="actions"><button class="btn" data-go="nl-q">Fight the Structuralism boss ' + I.next + '</button><button class="btn ghost" data-go="nl-worlds">Back to worlds</button></div></div>' + hubLink();
    app.innerHTML = '<div class="screen">' + h + "</div>";
    if (!SHOT) {
      countUp(document.getElementById("big"), 17, 900);
      setTimeout(function () { document.getElementById("rxp").style.setProperty("--w", after.pct + "%"); }, 400);
      setTimeout(function () { burst(innerWidth / 2, innerHeight * 0.22, 60); }, 300);
      if (after.lv > before.lv) setTimeout(function () { levelUp(after.lv, nRank(after.lv), "Name Lock"); }, 2600);
    }
  }

  /* ================= hub ================= */
  function hub() {
    var rows = [["tests-home", "Tests", "Home"], ["tests-q", "Tests", "Question"], ["tests-results", "Tests", "Results and level up"],
      ["nl-worlds", "Name Lock", "Worlds"], ["nl-q", "Name Lock", "Drill card"], ["nl-results", "Name Lock", "Round results"], ["levelup", "Both apps", "Level up screen"]];
    app.innerHTML = '<div class="screen hub">' + scene("sunset-coast", "64% 42%", "50%", "33%", "560px") +
      '<div class="col"><h1>Tests and Name Lock, redone</h1><p>Preview only. Tap through a screen, answer the questions, watch what happens. Nothing here touches your progress.</p>' +
      '<div class="list">' + rows.map(function (r) { return '<a class="row" href="?s=' + r[0] + '">' + r[2] + "<span>" + r[1] + "</span></a>"; }).join("") + "</div></div></div>";
  }

  /* ---------- effects ---------- */
  function flash(kind, r) {
    var f = document.getElementById("flash");
    if (r) { f.style.setProperty("--fx", (r.left + r.width / 2) + "px"); f.style.setProperty("--fy", (r.top + r.height / 2) + "px"); }
    f.className = ""; void f.offsetWidth; f.className = kind;
  }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function countUp(el, to, ms) {
    if (REDUCED) return;
    var t0 = performance.now(), dec = to % 1 ? 1 : 0;
    (function step(t) { var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = (to * e).toFixed(dec); if (k < 1) requestAnimationFrame(step); })(t0);
  }
  var fx = document.getElementById("fx"), fc = fx.getContext("2d"), parts = [], DPR = Math.min(2, window.devicePixelRatio || 1);
  var mo = document.getElementById("motes"), mc = mo.getContext("2d"), motes = [];
  function size() { [fx, mo].forEach(function (c) { c.width = innerWidth * DPR; c.height = innerHeight * DPR; }); }
  size(); addEventListener("resize", size);
  var PC = ["#FFE7A0", "#FFC24B", "#FF8257", "#3FD8BF", "#FFF6E0"];
  function burst(x, y, n) {
    if (REDUCED) return;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7;
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, life: 1, r: 2 + Math.random() * 3.5, c: PC[i % PC.length], star: i % 4 === 0 });
    }
  }
  for (var m = 0; m < 34; m++) motes.push({ x: Math.random(), y: Math.random(), r: .6 + Math.random() * 1.8, s: .00012 + Math.random() * .0003, p: Math.random() * 6.28 });
  function tick(t) {
    fc.setTransform(DPR, 0, 0, DPR, 0, 0); fc.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(function (p) { return p.life > 0; });
    parts.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += .22; p.vx *= .98; p.life -= .018;
      fc.globalAlpha = Math.max(0, p.life); fc.fillStyle = p.c; fc.shadowColor = p.c; fc.shadowBlur = 10;
      if (p.star) { fc.save(); fc.translate(p.x, p.y); fc.rotate(p.life * 6); fc.fillRect(-p.r * 1.4, -p.r * .35, p.r * 2.8, p.r * .7); fc.fillRect(-p.r * .35, -p.r * 1.4, p.r * .7, p.r * 2.8); fc.restore(); }
      else { fc.beginPath(); fc.arc(p.x, p.y, p.r, 0, 6.283); fc.fill(); }
    });
    fc.globalAlpha = 1; fc.shadowBlur = 0;
    if (!REDUCED) {
      mc.setTransform(DPR, 0, 0, DPR, 0, 0); mc.clearRect(0, 0, innerWidth, innerHeight);
      motes.forEach(function (d) {
        d.y -= d.s * 16; if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
        var x = (d.x + Math.sin(t / 2400 + d.p) * .012) * innerWidth, y = d.y * innerHeight;
        mc.globalAlpha = .35 + .35 * Math.sin(t / 900 + d.p); mc.fillStyle = "#FFE2B0"; mc.shadowColor = "#FFC27A"; mc.shadowBlur = 8;
        mc.beginPath(); mc.arc(x, y, d.r, 0, 6.283); mc.fill();
      });
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ---------- wiring ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-go],[data-k],[data-i],[data-wstep],[data-w]");
    if (!t) return;
    if (t.hasAttribute("data-k")) return answerTests(t);
    if (t.hasAttribute("data-i")) return answerNL(t);
    if (t.hasAttribute("data-wstep") || t.hasAttribute("data-w")) {
      wi = t.hasAttribute("data-w") ? +t.getAttribute("data-w") : (wi + (+t.getAttribute("data-wstep")) + WORLDS.length) % WORLDS.length;
      var map = document.getElementById("map"), mw = map.offsetWidth, mh = map.offsetHeight, keepT = map.style.transform;
      nlWorlds(); var m2 = document.getElementById("map"); m2.style.transition = "none"; m2.style.transform = keepT; void m2.offsetWidth; m2.style.transition = "";
      aimCamera(mw, mh, true); buzz([10]); return;
    }
    var g = t.getAttribute("data-go");
    if (g === "tests-q-next") { tq.i++; testsQ(); scrollTo(0, 0); return; }
    if (g === "nl-q-next") { nq.i++; nlQ(); scrollTo(0, 0); return; }
    go(g);
  });

  // swipe the map to fly to the next or previous world
  var sx0 = null;
  document.addEventListener("pointerdown", function (e) { sx0 = e.target.closest(".mapwrap") ? e.clientX : null; });
  document.addEventListener("pointerup", function (e) {
    if (sx0 == null) return; var dx = e.clientX - sx0; sx0 = null;
    if (Math.abs(dx) > 45) { var btn = document.querySelector('[data-wstep="' + (dx < 0 ? 1 : -1) + '"]'); if (btn) btn.click(); }
  });

  var R = { hub: hub, "tests-home": testsHome, "tests-q": testsQ, "tests-results": testsResults, "nl-worlds": nlWorlds, "nl-q": nlQ, "nl-results": nlResults,
    levelup: function () { testsResults(); levelUp(tBand(T_XP + 985).lv, tTitle(tBand(T_XP + 985).lv), "Tests"); } };
  (R[SCREEN] || hub)();
  var pick = Q.get("pick");
  if (pick) setTimeout(function () {
    var b = document.querySelector(SCREEN === "nl-q" ? '.opt[data-i="' + pick + '"]' : '.opt[data-k="' + pick + '"]');
    if (b) b.click();
  }, 300);
})();
