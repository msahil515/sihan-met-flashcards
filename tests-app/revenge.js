/* Revenge mode: every question you got wrong in any mock, replayed in 5 game modes.
   Flip cards · Cross questioning · Spot the trap · Boss battles · Comeback timer.
   Misses are harvested from the Tests app runs (tapp-run-*), the site's take/ engine
   (revamp-preview-*) and REVENGE_SEED, then kept in tapp-revenge-v1 (synced), so a miss
   stays here until you master it, even after you redo the mock.
   Every card teaches: REVENGE_LESSONS (from scratch, why your pick looked right, hook)
   on top of the deep explanation (concept + a trap for each wrong option). */
(function () {
  "use strict";
  var KEY = "tapp-revenge-v1", L = ["a", "b", "c", "d"], MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  var GAPS = [10 * MIN, DAY, 3 * DAY, 7 * DAY, 21 * DAY]; /* comeback ladder; clearing the last rung = mastered */
  var LES = window.REVENGE_LESSONS || {}, SEED = window.REVENGE_SEED || [];
  var MODES = [
    ["flip", "🃏", "Flip cards", "Question on the front. Answer, the trap and the full concept on the back."],
    ["cross", "⚖️", "Cross questioning", "Get it right, then explain why every wrong option is wrong, in your own words."],
    ["trap", "🪤", "Spot the trap", "Face the option that fooled you. Say what made it look right, then beat it."],
    ["boss", "👹", "Boss battles", "Your misses grouped by topic. Each question right 3 times in a row to win."],
    ["comeback", "⏳", "Comeback timer", "Misses come back on a timer: sooner when you miss, later when you nail it."]
  ];
  var T = null, view = { v: "hub" }, sess = null;
  function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }

  /* ---------- state (synced: numbers coerced because they reach innerHTML) ---------- */
  function load() {
    var s = T.load(KEY) || {};
    s = { it: isObj(s.it) ? s.it : {}, boss: isObj(s.boss) ? s.boss : {}, why: isObj(s.why) ? s.why : {}, scope: typeof s.scope === "string" ? s.scope : "all" };
    for (var k in s.it) {
      var o = s.it[k];
      if (!isObj(o)) { delete s.it[k]; continue; }
      ["t", "b", "d", "w", "r", "x", "f"].forEach(function (f) { o[f] = +o[f] || 0; });
      o.p = String(o.p || "").toLowerCase();
      if (L.indexOf(o.p) < 0) delete s.it[k]; /* synced data reaches innerHTML: only a-d survive */
    }
    return s;
  }
  function save(s) { T.store(KEY, s); }
  function Q(k) { var c = k.lastIndexOf(":"), id = k.slice(0, c), i = +k.slice(c + 1), M = T.P[id]; return M && M.questions[i] ? { id: id, i: i, q: M.questions[i], M: M } : null; }

  function harvest(s) {
    var now = Date.now(), n = 0, P = T.P;
    function put(id, i, pick, t) {
      var q = P[id] && P[id].questions[i];
      pick = String(pick || "").toLowerCase();
      if (!q || !q.options[pick] || pick === q.correct) return;
      var k = id + ":" + i;
      if (s.it[k]) return;
      s.it[k] = { p: pick, t: t || now, b: 0, d: 0, w: 0, r: 0, x: 0, f: 0 }; n++;
    }
    SEED.forEach(function (x) { put(x.m, x.i, x.p, x.t); });
    Object.keys(P).forEach(function (id) {
      var run = T.load("tapp-run-" + id + "-v1"), tk = T.load("revamp-preview-" + id + "-v1");
      if (run && isObj(run.ans)) for (var i in run.ans) put(id, +i, run.ans[i]);
      if (tk && isObj(tk.answers)) for (var j in tk.answers) put(id, +j, tk.answers[j]);
    });
    if (n) save(s);
    return s;
  }
  function state() { return harvest(load()); }
  function sectionOf(x) { return ((x.M.sectionLabels || {})[x.q.section]) || x.q.section || "Mixed"; }
  /* active misses in scope, the JSS paper first (27 Oct), newest misses next */
  function pool(s, all) {
    return Object.keys(s.it).filter(function (k) {
      var o = s.it[k]; if (!Q(k)) return false;
      if (!all && o.x) return false;
      return s.scope === "all" || k.indexOf(s.scope + ":") === 0;
    }).sort(function (a, b) {
      var ja = a.indexOf("jss-") === 0 ? 0 : 1, jb = b.indexOf("jss-") === 0 ? 0 : 1;
      if (ja !== jb) return ja - jb;
      var ia = Q(a), ib = Q(b);
      if (ia.id !== ib.id) return s.it[b].t - s.it[a].t || (ia.id < ib.id ? -1 : 1);
      return ia.i - ib.i;
    });
  }
  function due(s) { var now = Date.now(); return pool(s).filter(function (k) { return s.it[k].d <= now; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function inWords(ms) {
    if (ms <= 0) return "now";
    if (ms < HOUR) return Math.max(1, Math.round(ms / MIN)) + " min";
    if (ms < DAY) return Math.round(ms / HOUR) + " h";
    var d = Math.round(ms / DAY); return d + (d === 1 ? " day" : " days");
  }

  /* comeback ladder: right climbs a rung, wrong drops to the bottom and returns sooner each time you keep missing */
  function grade(s, k, ok) {
    var o = s.it[k], now = Date.now();
    if (ok) {
      o.r++;
      if (o.d <= now) { o.b = Math.min(GAPS.length, o.b + 1); o.d = now + GAPS[o.b - 1]; if (o.b >= GAPS.length) o.x = 1; }
    } else {
      o.w++; o.b = 0; o.x = 0; o.d = now + Math.max(2, 10 - 2 * Math.min(4, o.w - 1)) * MIN;
    }
    save(s);
    return o;
  }

  /* ---------- teaching blocks ---------- */
  function paras(arr) { return arr.map(function (p) { return "<p>" + T.boldFig(p) + "</p>"; }).join(""); }
  function lesson(k, s) {
    var x = Q(k), o = s.it[k], les = LES[k], q = x.q, pick = o && o.p, d = T.DEEP[x.id] && T.DEEP[x.id][x.i];
    var trap = (d && d.traps && d.traps[pick]) || "";
    var h = '<div class="exp rg-les">';
    if (les && les.k) h += '<div class="rg-flag"><b>Key note</b>' + T.esc(les.k) + "</div>";
    if (les && les.s) h += '<div class="exp-sec rg-first"><div class="exp-h">Learn it from scratch</div>' + paras(les.s) + "</div>";
    if (pick && q.options[pick]) {
      h += '<div class="exp-sec"><div class="exp-h">Why ' + pick.toUpperCase() + " fooled you</div>" +
        '<div class="rg-fool"><span class="tk">' + pick + "</span><span>" + q.options[pick] + "</span></div>" +
        paras([les && les.f ? les.f : trap]) + "</div>";
    }
    if (les && les.h) h += '<div class="exp-sec"><div class="exp-h">Memory hook</div><p class="rg-hook">' + T.esc(les.h) + "</p></div>";
    return h + "</div>" + T.explainHTML(x.id, q, x.i);
  }
  function chips(k, extra) {
    var x = Q(k);
    return '<div class="qmeta"><span class="chip qn">' + T.esc(T.title_of(x.id)) + " · Q" + (x.i + 1) + '</span><span class="chip">' + T.esc(sectionOf(x)) + "</span>" + (extra || "") + "</div>";
  }
  function optsHTML(q, st, cls) {
    return '<div class="opts ' + (cls || "") + '" id="rgO">' + L.filter(function (k) { return q.options[k] != null; }).map(function (k) {
      return '<button class="opt' + (st && st[k] ? " " + st[k] : "") + '" data-k="' + k + '"><span class="k">' + k + '</span><span class="ot">' + q.options[k] + "</span></button>";
    }).join("") + "</div>";
  }
  function bindOpts(fn) { T.app.querySelectorAll("#rgO .opt").forEach(function (b) { b.onclick = function () { if (!b.classList.contains("fade")) fn(b.getAttribute("data-k"), b); }; }); }
  function cheer(el, xp, big) {
    T.flash("ok"); T.buzz([18]); T.tone([660, 880]); T.fx.boost(0.6); if (xp) { T.gain(xp); T.floater("+" + xp + " XP"); }
    var rc = el ? el.getBoundingClientRect() : null;
    T.fx.confetti(big ? 120 : 22, rc ? rc.left + rc.width / 2 : null, rc ? rc.top + rc.height / 2 : null);
  }
  function boo() { var o = document.getElementById("rgO"); if (o) o.classList.add("shake"); T.flash("bad"); T.buzz([40, 60, 40]); T.tone([300, 220]); }
  function frame(title, body, foot, prog) {
    T.app.innerHTML = '<div class="screen"><div class="ptop"><button class="xbtn" id="rgX">' + (view.v === "hub" ? "‹" : "✕") + "</button>" +
      (prog != null ? '<div class="pbar"><i style="width:' + prog + '%"></i></div>' : '<div style="flex:1;font-weight:900">' + title + "</div>") +
      (prog != null ? '<div class="score">' + title + "</div>" : "") + '</div><div class="scroll narrow" id="rgS">' + body + "</div>" + (foot ? '<div class="pfoot">' + foot + "</div>" : "") + "</div>";
    document.getElementById("rgX").onclick = function () { back(); };
  }
  function top() { var el = document.getElementById("rgS"); if (el) el.scrollTop = 0; }
  function scrollTo(id) { setTimeout(function () { var s = document.getElementById("rgS"), a = document.getElementById(id); if (s && a) s.scrollTo({ top: Math.max(0, a.offsetTop - 140), behavior: "smooth" }); }, 200); }

  /* ---------- hub ---------- */
  function hub() {
    var s = state(), all = pool(s, true), act = pool(s), dn = due(s), mastered = all.length - act.length;
    var mocks = {}; Object.keys(s.it).forEach(function (k) { var x = Q(k); if (!x) return; mocks[x.id] = mocks[x.id] || { n: 0, open: 0 }; mocks[x.id].n++; if (!s.it[k].x) mocks[x.id].open++; });
    var ids = Object.keys(mocks).sort(function (a, b) { return (a.indexOf("jss-") === 0 ? -1 : 0) - (b.indexOf("jss-") === 0 ? -1 : 0) || mocks[b].n - mocks[a].n; });
    if (s.scope !== "all" && !mocks[s.scope]) { s.scope = "all"; save(s); }
    var next = act.length ? Math.min.apply(null, act.map(function (k) { return s.it[k].d; })) - Date.now() : 0;
    var bosses = bossList(s);
    var count = { flip: act.length, cross: act.length, trap: act.length, boss: bosses.filter(function (b) { return !b.down; }).length, comeback: dn.length };
    var body = T.hud() + '<div class="hero">REVENGE <span>MODE</span></div><div class="hero-s">' + all.length + " misses · " + mastered + " mastered · " + act.length + " to beat</div>" +
      '<div class="rg-master"><i style="width:' + (all.length ? Math.round(100 * mastered / all.length) : 0) + '%"></i></div>' +
      (ids.length > 1 ? '<div class="rg-scope"><button data-sc="all" class="' + (s.scope === "all" ? "on" : "") + '">All mocks</button>' + ids.map(function (id) {
        return '<button data-sc="' + T.esc(id) + '" class="' + (s.scope === id ? "on" : "") + '">' + T.esc(T.title_of(id)) + " · " + mocks[id].open + "</button>";
      }).join("") + "</div>" : "") +
      (act.length ? "" : '<div class="rg-empty">' + (all.length ? "Every miss in here is mastered. Take a mock; anything you get wrong lands here automatically." : "No misses yet. Take any mock in the Tests app or on the site and every wrong answer lands here automatically.") + "</div>") +
      '<div class="rg-modes">' + MODES.map(function (m) {
        var c = count[m[0]], off = !c;
        var tag = m[0] === "comeback" ? (dn.length ? dn.length + " due now" : act.length ? "next in " + inWords(next) : "nothing due") : m[0] === "boss" ? c + " boss" + (c === 1 ? "" : "es") + " left" : c + " cards";
        return '<button class="rg-mode m-' + m[0] + '" data-m="' + m[0] + '"' + (off ? " disabled" : "") + '><i>' + m[1] + "</i><b>" + m[2] + "</b><span>" + m[3] + "</span><em>" + tag + "</em></button>";
      }).join("") + "</div>" +
      (all.length ? '<h2 class="sh">Your misses</h2><p class="gsub">Tap one to study it. Dots = comeback rungs climbed (5 = mastered).</p>' + all.map(function (k) {
        var x = Q(k), o = s.it[k], dots = "";
        for (var i = 0; i < GAPS.length; i++) dots += '<i class="' + (i < o.b ? "on" : "") + '"></i>';
        return '<button class="rg-row' + (o.x ? " won" : "") + '" data-k="' + k + '"><span class="rn">' + (x.i + 1) + '</span><span class="rq">' + x.q.q + '<small>' + T.esc(T.title_of(x.id)) + " · " + T.esc(sectionOf(x)) + "</small></span><span class=\"rg-dots\">" + dots + "</span></button>";
      }).join("") : "");
    frame("Revenge", body);
    T.app.querySelectorAll(".rg-scope button").forEach(function (b) { b.onclick = function () { var s2 = load(); s2.scope = b.getAttribute("data-sc"); save(s2); hub(); }; });
    T.app.querySelectorAll(".rg-mode").forEach(function (b) { b.onclick = function () { start(b.getAttribute("data-m")); }; });
    T.app.querySelectorAll(".rg-row").forEach(function (b) { b.onclick = function () { study(b.getAttribute("data-k")); }; });
  }
  function study(k) {
    var s = state(), x = Q(k), o = s.it[k];
    T.closeSheet();
    var bg = document.createElement("div"); bg.className = "sheet-bg"; bg.onclick = T.closeSheet;
    var sh = document.createElement("div"); sh.className = "sheet rg-sheet"; sh.style.overflowY = "auto";
    var st = {}; st[x.q.correct] = "right"; if (o.p && o.p !== x.q.correct) st[o.p] = "wrong";
    sh.innerHTML = chips(k) + '<div class="qcard">' + x.q.q + "</div>" + optsHTML(x.q, st, "locked") + lesson(k, s) +
      '<p class="hint" style="margin-top:12px">' + (o.x ? "Mastered." : "Comes back " + (o.d <= Date.now() ? "now" : "in " + inWords(o.d - Date.now())) + " in the Comeback timer.") + "</p>";
    T.app.appendChild(bg); T.app.appendChild(sh);
  }
  function cta() {
    if (!T) T = window.TAPP;
    var s = state(), act = pool(s, false), dn = due(s).length;
    var jss = act.filter(function (k) { return k.indexOf("jss-") === 0; }).length;
    return '<button class="rg-cta" data-go="revenge"><i>💀</i><span><b>Revenge mode</b><small>' + (act.length ? act.length + " misses to beat" + (jss ? " · " + jss + " from JSS" : "") + (dn ? " · " + dn + " due" : "") : "Your wrong answers, 5 game modes") + "</small></span><em>›</em></button>";
  }

  /* ---------- sessions ---------- */
  function start(mode) {
    var s = state();
    if (mode === "boss") { view = { v: "bosses" }; return render(); }
    var list = mode === "comeback" ? due(s) : pool(s);
    if (mode !== "comeback") list = shuffle(list);
    if (!list.length) { T.toast(mode === "comeback" ? "Nothing due yet. Come back later." : "Nothing to play here."); return; }
    sess = { mode: mode, list: list.slice(0, mode === "comeback" ? 40 : 20), at: 0, ok: 0, bad: 0, xp: 0, step: null };
    view = { v: mode }; render();
  }
  function cur() { return sess.list[sess.at]; }
  function progress() { return Math.round(100 * sess.at / sess.list.length); }
  function next() { sess.at++; sess.step = null; if (sess.at >= sess.list.length) { view = { v: "done" }; } render(); top(); }
  function done() {
    var m = MODES.filter(function (x) { return x[0] === sess.mode; })[0];
    frame("Done", '<div class="fin-h" style="margin-top:28px">' + (sess.bad ? "Revenge in progress" : "Revenge served") + '</div><div class="fin-s">' + m[2] + "</div>" +
      '<div class="stats"><div class="stat"><b style="color:var(--ok)">' + sess.ok + '</b><span>Beaten</span></div><div class="stat"><b style="color:var(--bad)">' + sess.bad +
      '</b><span>Still biting</span></div><div class="stat"><b style="color:var(--gold)">+' + sess.xp + "</b><span>XP</span></div></div>" +
      '<button class="btn" id="rgA">Go again</button><button class="btn ghost" id="rgH">Revenge home</button>');
    document.getElementById("rgA").onclick = function () { start(sess.mode); };
    document.getElementById("rgH").onclick = function () { view = { v: "hub" }; render(); };
    if (!sess.bad) { T.fx.confetti(140); T.fx.boost(1); T.tone([523, 659, 784, 1047]); }
  }
  function addXP(n) { sess.xp += n; }

  /* 1. Flip cards */
  function flip() {
    var s = state(), k = cur(), x = Q(k), q = x.q, flipped = sess.step === "back";
    var st = {}; if (flipped) { L.forEach(function (l) { if (q.options[l]) st[l] = l === q.correct ? "right" : l === s.it[k].p ? "wrong" : "fade"; }); }
    var body = chips(k, '<span class="chip src">Card ' + (sess.at + 1) + "/" + sess.list.length + "</span>") +
      '<div class="rg-card' + (flipped ? " back" : "") + '" id="rgC"><div class="rg-face">' + (flipped ? "THE ANSWER" : "TAP TO FLIP") + "</div>" + '<div class="qcard">' + q.q + "</div>" + optsHTML(q, st, "locked") + "</div>" +
      (flipped ? '<div id="rgL">' + lesson(k, s) + "</div>" : "");
    var foot = flipped ? '<button class="btn bad" id="rgN">✗ Didn\'t know</button><button class="btn ok" id="rgY">✓ Knew it</button>' : '<button class="btn" id="rgF">Flip</button>';
    frame((sess.at + 1) + "/" + sess.list.length, body, foot, progress());
    if (!flipped) {
      document.getElementById("rgF").onclick = document.getElementById("rgC").onclick = function () { sess.step = "back"; flip(); var c = document.getElementById("rgC"); c.classList.add("turn"); T.tone([520]); };
    } else {
      document.getElementById("rgY").onclick = function () { var s2 = load(); s2.it[k].f++; save(s2); sess.ok++; addXP(5); cheer(document.getElementById("rgY"), 5); setTimeout(next, 350); };
      document.getElementById("rgN").onclick = function () { var s2 = load(); var o = s2.it[k]; o.b = Math.min(o.b, 1); o.d = Math.min(o.d, Date.now()); save(s2); sess.bad++; T.buzz([30]); T.toast("Back in the comeback queue"); next(); };
    }
  }

  /* 2. Cross questioning: answer, then defend why each wrong option is wrong */
  function cross() {
    var s = state(), k = cur(), x = Q(k), q = x.q, d = (T.DEEP[x.id] && T.DEEP[x.id][x.i]) || {}, traps = d.traps || {};
    var wrongs = L.filter(function (l) { return q.options[l] && l !== q.correct && traps[l]; });
    var st = sess.step || (sess.step = { ph: "ans", tried: {}, j: 0, sub: "type", firstTry: true });
    var head = chips(k, '<span class="chip src">' + (sess.at + 1) + "/" + sess.list.length + "</span>") + '<div class="qcard">' + q.q + "</div>";
    if (st.ph === "ans" || st.ph === "relearn") {
      var os = {}; for (var t in st.tried) os[t] = "wrong fade";
      var body = head + optsHTML(q, os) + (st.ph === "relearn" ? '<div class="verdict bad" id="rgV">✗ Not yet. Read the concept again, then pick again.</div><div id="rgL">' + lesson(k, s) + "</div>" : "");
      frame((sess.at + 1) + "/" + sess.list.length, body, null, progress());
      if (st.ph === "relearn") scrollTo("rgV");
      bindOpts(function (l, b) {
        if (l === q.correct) {
          if (st.firstTry) { grade(load(), k, true); sess.ok++; } else sess.bad++;
          addXP(st.firstTry ? 10 : 3); cheer(b, st.firstTry ? 10 : 3);
          st.ph = wrongs.length ? "grill" : "end"; setTimeout(cross, 450);
        } else {
          if (st.firstTry) grade(load(), k, false);
          st.firstTry = false; st.tried[l] = 1; st.ph = "relearn"; boo(); setTimeout(cross, 300);
        }
      });
      return;
    }
    if (st.ph === "grill") {
      var l = wrongs[st.j], keyW = k + ":" + l, typed = s.why[keyW] || "";
      var b2 = head + '<div class="verdict ok">✓ ' + q.correct.toUpperCase() + " is right. Now defend it.</div>" +
        '<div class="rg-grill"><div class="rg-gh">Cross question ' + (st.j + 1) + " of " + wrongs.length + '</div><p>Why is this one <b>wrong</b>?</p><div class="rg-fool"><span class="tk">' + l + "</span><span>" + q.options[l] + "</span></div>";
      if (st.sub === "type") {
        b2 += '<textarea class="rg-ta" id="rgT" placeholder="In your own words: what is it really, and why doesn\'t it fit this question?">' + T.esc(typed) + "</textarea></div>";
        frame((sess.at + 1) + "/" + sess.list.length, b2, '<button class="btn" id="rgK">Check my reason</button>', progress());
        document.getElementById("rgK").onclick = function () {
          var v = document.getElementById("rgT").value.trim();
          if (v.length < 4) { T.toast("Write your reason first, even one line"); return; }
          var s2 = load(); s2.why[keyW] = v; save(s2); st.sub = "judge"; cross();
        };
        return;
      }
      if (st.sub === "judge") {
        b2 += '<div class="rg-you"><b>You said</b>' + T.esc(typed) + '</div><div class="rg-model"><b>The model reason</b>' + T.boldFig(traps[l]) + '</div><p class="hint" style="margin:10px 2px 0">Same idea, even if worded differently?</p></div>';
        frame((sess.at + 1) + "/" + sess.list.length, b2, '<button class="btn bad" id="rgOff">I was off</button><button class="btn ok" id="rgOn">Matched</button>', progress());
        scrollTo("rgOn");
        document.getElementById("rgOn").onclick = function () { addXP(5); cheer(document.getElementById("rgOn"), 5); setTimeout(function () { nextGrill(st, wrongs); }, 300); };
        document.getElementById("rgOff").onclick = function () { st.sub = "re"; st.pickBad = {}; cross(); top(); };
        return;
      }
      /* "re": walk through the concept again, then prove it by picking the right reason */
      var choices = st.choices || (st.choices = shuffle(wrongs));
      b2 += "</div>" + '<div id="rgL">' + lesson(k, s) + '</div><div class="rg-grill" id="rgR"><div class="rg-gh">Now pick it</div><p>Which of these is why <b>' + l.toUpperCase() + ") " + q.options[l] + "</b> is wrong?</p>" +
        '<div class="opts" id="rgO">' + choices.map(function (c) {
          return '<button class="opt' + (st.pickBad[c] ? " wrong fade" : "") + '" data-k="' + c + '"><span class="ot">' + T.boldFig(traps[c]) + "</span></button>";
        }).join("") + "</div></div>";
      frame((sess.at + 1) + "/" + sess.list.length, b2, null, progress());
      bindOpts(function (c, b) {
        if (c === l) { addXP(2); cheer(b, 2); setTimeout(function () { nextGrill(st, wrongs); }, 400); }
        else { st.pickBad[c] = 1; boo(); setTimeout(function () { cross(); scrollTo("rgR"); }, 300); }
      });
      return;
    }
    /* end */
    frame((sess.at + 1) + "/" + sess.list.length, head + '<div class="verdict ok">✓ Cross-examination survived</div><div id="rgL">' + lesson(k, s) + "</div>",
      '<button class="btn" id="rgN">' + (sess.at + 1 >= sess.list.length ? "Finish" : "Next question") + "</button>", progress());
    document.getElementById("rgN").onclick = next;
  }
  function nextGrill(st, wrongs) {
    st.j++; st.sub = "type"; st.choices = null;
    if (st.j >= wrongs.length) st.ph = "end";
    cross(); top();
  }

  /* 3. Spot the trap */
  function trap() {
    var s = state(), k = cur(), x = Q(k), q = x.q, o = s.it[k], keyW = k + ":trap";
    var st = sess.step || (sess.step = { ph: "face", tried: {}, firstTry: true });
    var head = chips(k, '<span class="chip src">' + (sess.at + 1) + "/" + sess.list.length + "</span>") + '<div class="qcard">' + q.q + "</div>";
    var les = LES[k], d = (T.DEEP[x.id] && T.DEEP[x.id][x.i]) || {}, why = (les && les.f) || (d.traps && d.traps[o.p]) || "";
    if (st.ph === "face") {
      var fs = {}; fs[o.p] = "wrong";
      frame((sess.at + 1) + "/" + sess.list.length, head + '<div class="rg-gh" style="margin:0 2px 8px">This is the option that fooled you</div>' +
        '<div class="opts locked">' + '<button class="opt wrong"><span class="k">' + o.p + '</span><span class="ot">' + q.options[o.p] + "</span></button></div>" +
        '<div class="rg-grill"><p>What made it look right? Be honest, one line is enough.</p><textarea class="rg-ta" id="rgT" placeholder="It looked right because...">' + T.esc(s.why[keyW] || "") + "</textarea></div>",
        '<button class="btn" id="rgK">Reveal the trap</button>', progress());
      document.getElementById("rgK").onclick = function () {
        var v = document.getElementById("rgT").value.trim();
        if (v.length < 3) { T.toast("Say what pulled you in first"); return; }
        var s2 = load(); s2.why[keyW] = v; save(s2); st.ph = "pick"; trap(); top();
      };
      return;
    }
    if (st.ph === "pick" || st.ph === "relearn") {
      var os = {}; os[o.p] = "wrong fade"; for (var t in st.tried) os[t] = "wrong fade";
      frame((sess.at + 1) + "/" + sess.list.length, head + '<div class="rg-you"><b>You said</b>' + T.esc(s.why[keyW] || "") + "</div>" +
        '<div class="rg-model"><b>The trap</b>' + T.boldFig(why) + "</div>" +
        '<p class="hint" style="margin:12px 2px 8px">Trap disarmed. Now pick the right answer.</p>' + optsHTML(q, os) +
        (st.ph === "relearn" ? '<div class="verdict bad" id="rgV">✗ Another trap. Here is the whole concept.</div><div id="rgL">' + lesson(k, s) + "</div>" : ""), null, progress());
      if (st.ph === "relearn") scrollTo("rgV");
      bindOpts(function (l, b) {
        if (l === o.p) return;
        if (l === q.correct) {
          if (st.firstTry) { grade(load(), k, true); sess.ok++; } else sess.bad++;
          addXP(st.firstTry ? 10 : 3); cheer(b, st.firstTry ? 10 : 3); st.ph = "end"; setTimeout(function () { trap(); scrollTo("rgV"); }, 450);
        } else { if (st.firstTry) grade(load(), k, false); st.firstTry = false; st.tried[l] = 1; st.ph = "relearn"; boo(); setTimeout(trap, 300); }
      });
      return;
    }
    var es = {}; L.forEach(function (l) { if (q.options[l]) es[l] = l === q.correct ? "right" : l === o.p ? "wrong" : "fade"; });
    frame((sess.at + 1) + "/" + sess.list.length, head + optsHTML(q, es, "locked") + '<div class="verdict ok" id="rgV">✓ Trap beaten</div><div id="rgL">' + lesson(k, s) + "</div>",
      '<button class="btn" id="rgN">' + (sess.at + 1 >= sess.list.length ? "Finish" : "Next trap") + "</button>", progress());
    document.getElementById("rgN").onclick = next;
  }

  /* 4. Boss battles: one boss per topic; every question right 3 times in a row */
  function bossList(s) {
    var by = {};
    pool(s, true).forEach(function (k) { var x = Q(k), n = sectionOf(x); (by[n] = by[n] || []).push(k); });
    return Object.keys(by).map(function (n) {
      var ks = by[n], open = ks.filter(function (k) { return !s.it[k].x; });
      var won = +s.boss[n] || 0, newest = Math.max.apply(null, ks.map(function (k) { return s.it[k].t; }));
      /* a beaten boss stays down until a newer miss in its topic wakes it up */
      return { name: n, keys: open.length ? open : ks, n: ks.length, open: open.length, won: won, down: !open.length || won > newest };
    }).sort(function (a, b) { return (a.down ? 1 : 0) - (b.down ? 1 : 0) || b.open - a.open; });
  }
  function bosses() {
    var s = state(), list = bossList(s);
    frame("Boss battles", '<p class="hint" style="margin-top:8px">One boss per topic, built from your misses. Every question needs 3 right in a row; a miss resets it and the boss hits back. Beat a boss and it stays down until a new miss in that topic wakes it up.</p>' +
      (list.length ? list.map(function (b, i) {
        return '<button class="rg-boss' + (b.down ? " won" : "") + '" data-i="' + i + '"><i>' + (b.down ? "🏆" : "👹") + '</i><span><b>' + T.esc(b.name) + "</b><small>" +
          (b.down ? (b.won ? "Defeated " : "All mastered") + (b.won ? "" + new Date(b.won).toLocaleDateString([], { day: "numeric", month: "short" }) : "") + " · tap to fight again" : b.keys.length + " question" + (b.keys.length === 1 ? "" : "s") + " · HP " + b.keys.length * 3) + "</small></span><em>›</em></button>";
      }).join("") : '<div class="rg-empty">No bosses yet: they spawn from your misses.</div>'));
    T.app.querySelectorAll(".rg-boss").forEach(function (b) {
      b.onclick = function () {
        var B = list[+b.getAttribute("data-i")];
        sess = { mode: "boss", name: B.name, keys: B.keys.slice(), c: {}, q: null, last: null, ok: 0, bad: 0, xp: 0, hits: 0, ans: null, fresh: {} };
        B.keys.forEach(function (k) { sess.c[k] = 0; sess.fresh[k] = 1; });
        view = { v: "fight" }; pickBoss(); render();
      };
    });
  }
  function pickBoss() {
    var left = sess.keys.filter(function (k) { return sess.c[k] < 3; });
    if (!left.length) { sess.q = null; return; }
    var pool2 = left.length > 1 ? left.filter(function (k) { return k !== sess.last; }) : left;
    sess.q = pool2[Math.floor(Math.random() * pool2.length)]; sess.ans = null;
  }
  function fight() {
    var s = state();
    if (!sess.q) return bossWin(s);
    var k = sess.q, x = Q(k), q = x.q, total = sess.keys.length * 3, dmg = 0;
    sess.keys.forEach(function (kk) { dmg += Math.min(3, sess.c[kk]); });
    var hp = Math.round(100 * (total - dmg) / total), a = sess.ans;
    var st = {}; if (a) L.forEach(function (l) { if (q.options[l]) st[l] = l === q.correct ? "right" : l === a ? "wrong" : "fade"; });
    var pips = ""; for (var i = 0; i < 3; i++) pips += '<i class="' + (i < sess.c[k] ? "on" : "") + '"></i>';
    var body = '<div class="rg-bossbar"><div class="rg-bn">👹 ' + T.esc(sess.name) + '</div><div class="rg-hp"><i style="width:' + hp + '%"></i><span>BOSS HP ' + hp + "%</span></div></div>" +
      chips(k, '<span class="chip rg-pips">' + pips + "</span>") + '<div class="qcard">' + q.q + "</div>" + optsHTML(q, st, a ? "locked" : "") +
      (a ? '<div class="verdict ' + (a === q.correct ? "ok" : "bad") + '" id="rgV">' + (a === q.correct ? "✓ Hit! " + sess.c[k] + "/3 on this one" : "✗ The boss hits back. Streak reset to 0/3") + "</div>" +
        (a === q.correct ? '<details class="rg-more"><summary>Show the concept</summary><div id="rgL">' + lesson(k, s) + "</div></details>" : '<div id="rgL">' + lesson(k, s) + "</div>") : "");
    frame("HP " + hp + "%", body, a ? '<button class="btn" id="rgN">Next attack</button>' : null, 100 - hp);
    if (a) { scrollTo("rgV"); document.getElementById("rgN").onclick = function () { sess.last = k; pickBoss(); fight(); top(); }; return; }
    bindOpts(function (l, b) {
      sess.ans = l;
      var ok = l === q.correct;
      if (sess.fresh[k]) { grade(load(), k, ok); delete sess.fresh[k]; if (ok) sess.ok++; else sess.bad++; }
      if (ok) { sess.c[k]++; addXP(5); cheer(b, 5); if (sess.c[k] === 3) T.banner("CRITICAL HIT", "question cleared"); }
      else { sess.c[k] = 0; sess.hits++; boo(); }
      fight();
    });
  }
  function bossWin(s) {
    s.boss[sess.name] = Date.now(); save(s); addXP(50); T.gain(50);
    frame("Victory", '<div class="fin-stars"><span class="on">🏆</span></div><div class="fin-h">BOSS DOWN</div><div class="fin-s">' + T.esc(sess.name) + "</div>" +
      '<div class="stats"><div class="stat"><b>' + sess.keys.length + '</b><span>Questions</span></div><div class="stat"><b style="color:var(--bad)">' + sess.hits +
      '</b><span>Hits taken</span></div><div class="stat"><b style="color:var(--gold)">+' + sess.xp + "</b><span>XP</span></div></div>" +
      '<button class="btn" id="rgB">Next boss</button><button class="btn ghost" id="rgH">Revenge home</button>');
    T.banner("BOSS DOWN", sess.hits ? "" : "FLAWLESS"); T.fx.confetti(200); T.fx.boost(1.4); T.tone([523, 659, 784, 1047, 1319]); T.buzz([30, 50, 30, 50, 120]);
    document.getElementById("rgB").onclick = function () { view = { v: "bosses" }; render(); };
    document.getElementById("rgH").onclick = function () { view = { v: "hub" }; render(); };
  }

  /* 5. Comeback timer */
  function comeback() {
    var s = state(), k = cur(), x = Q(k), q = x.q, a = sess.step, o = s.it[k];
    var st = {}; if (a) L.forEach(function (l) { if (q.options[l]) st[l] = l === q.correct ? "right" : l === a ? "wrong" : "fade"; });
    var rung = ""; for (var i = 0; i < GAPS.length; i++) rung += '<i class="' + (i < o.b ? "on" : "") + '"></i>';
    var body = chips(k, '<span class="chip rg-dots">' + rung + "</span>") + '<div class="qcard">' + q.q + "</div>" + optsHTML(q, st, a ? "locked" : "") +
      (a ? '<div class="verdict ' + (a === q.correct ? "ok" : "bad") + '" id="rgV">' + (a === q.correct ? (o.x ? "✓ Mastered. It won't come back." : "✓ Back in " + inWords(o.d - Date.now())) : "✗ Back in " + inWords(o.d - Date.now()) + ". It keeps coming sooner till you nail it.") + "</div>" + '<div id="rgL">' + lesson(k, s) + "</div>" : "");
    frame((sess.at + 1) + "/" + sess.list.length, body, a ? '<button class="btn" id="rgN">' + (sess.at + 1 >= sess.list.length ? "Finish" : "Next") + "</button>" : null, progress());
    if (a) { scrollTo("rgV"); document.getElementById("rgN").onclick = next; return; }
    bindOpts(function (l, b) {
      var ok = l === q.correct, o2 = grade(load(), k, ok);
      sess.step = l;
      if (ok) { sess.ok++; addXP(o2.x ? 30 : 10); cheer(b, o2.x ? 30 : 10, o2.x); if (o2.x) T.banner("MASTERED", "revenge complete"); } else { sess.bad++; boo(); }
      comeback();
    });
  }

  /* ---------- router ---------- */
  function render() {
    T = window.TAPP;
    ({ hub: hub, flip: flip, cross: cross, trap: trap, comeback: comeback, bosses: bosses, fight: fight, done: done })[view.v]();
  }
  function back() {
    if (T.app.querySelector(".sheet")) { T.closeSheet(); return true; }
    if (view.v === "hub") { T.go("home"); return true; }
    if (view.v === "fight") view = { v: "bosses" };
    else view = { v: "hub" };
    render(); return true;
  }
  window.REVENGE = { render: render, enter: function () { view = { v: "hub" }; sess = null; render(); }, back: back, cta: cta, _state: function () { return state(); }, _view: function () { return view; }, _sess: function () { return sess; } };
  window.addEventListener("sihan-sync", function (e) { if (e.detail && e.detail.pulled && T && view.v === "hub" && T.app.querySelector(".rg-modes")) hub(); });
})();
