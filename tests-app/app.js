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
    var m = Object.assign({ xp: 0, days: {}, best: {}, last: null, sound: true, haptic: true, bestCombo: 0 }, load("tapp-meta-v1") || {});
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


  /* ---------- sunset world: dust motes on #sky, spark bursts on #fx ---------- */
  var CALM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FX = (function () {
    var sky = document.getElementById("sky"), fxc = document.getElementById("fx");
    var sx = sky.getContext("2d"), fx = fxc.getContext("2d"), W = 0, H = 0, DPR = Math.min(2, window.devicePixelRatio || 1);
    var motes = [], bits = [], warp = 0, fxOn = false;
    var PC = ["#FFE7A0", "#FFC24B", "#FF8257", "#3FD8BF", "#FFF6E0"];
    function size() {
      W = window.innerWidth; H = window.innerHeight;
      [sky, fxc].forEach(function (c) { c.width = W * DPR; c.height = H * DPR; c.getContext("2d").setTransform(DPR, 0, 0, DPR, 0, 0); });
      var n = Math.round(Math.max(18, Math.min(46, W * H / 12000)));
      motes = [];
      for (var i = 0; i < n; i++) motes.push({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 1.8, s: 0.012 + Math.random() * 0.03, p: Math.random() * 6.28 });
    }
    function drawSky(dt, t) {
      sx.clearRect(0, 0, W, H);
      var sp = 1 + warp * 5;
      warp = Math.max(0, warp - dt * 0.0012);
      sx.fillStyle = "#FFE2B0"; sx.shadowColor = "#FFC27A"; sx.shadowBlur = 8;
      for (var i = 0; i < motes.length; i++) {
        var d = motes[i];
        d.y -= d.s * dt * sp;
        if (d.y < -6) { d.y = H + 6; d.x = Math.random() * W; }
        sx.globalAlpha = 0.25 + 0.3 * (1 + Math.sin(t / 900 + d.p)) / 2 + Math.min(0.3, warp * 0.3);
        sx.beginPath(); sx.arc(d.x + Math.sin(t / 2400 + d.p) * 10, d.y, d.r, 0, 6.283); sx.fill();
      }
      sx.globalAlpha = 1; sx.shadowBlur = 0;
    }
    function drawFx(dt) {
      var f = dt / 16.7;
      fx.clearRect(0, 0, W, H);
      for (var i = bits.length - 1; i >= 0; i--) {
        var b = bits[i];
        b.x += b.vx * f; b.y += b.vy * f; b.vy += 0.22 * f; b.vx *= Math.pow(0.98, f); b.life -= b.fade * f;
        if (b.life <= 0 || b.y > H + 30) { bits.splice(i, 1); continue; }
        fx.globalAlpha = Math.max(0, Math.min(1, b.life)); fx.fillStyle = b.c; fx.shadowColor = b.c; fx.shadowBlur = 10;
        if (b.star) {
          fx.save(); fx.translate(b.x, b.y); fx.rotate(b.life * 6);
          fx.fillRect(-b.r * 1.4, -b.r * 0.35, b.r * 2.8, b.r * 0.7); fx.fillRect(-b.r * 0.35, -b.r * 1.4, b.r * 0.7, b.r * 2.8); fx.restore();
        } else { fx.beginPath(); fx.arc(b.x, b.y, b.r, 0, 6.283); fx.fill(); }
      }
      fx.globalAlpha = 1; fx.shadowBlur = 0;
      if (!bits.length) { fx.clearRect(0, 0, W, H); fxOn = false; }
    }
    var last = 0;
    function frame(t) {
      var dt = Math.min(50, t - (last || t)); last = t;
      if (!document.hidden) { drawSky(dt, t); if (fxOn) drawFx(dt); }
      requestAnimationFrame(frame);
    }
    size(); window.addEventListener("resize", size);
    if (CALM) drawSky(0, 0); else requestAnimationFrame(frame);
    /* spark burst from (x, y); same name the game code (and revenge.js) already calls */
    function confetti(n, x, y) {
      if (CALM) return;
      x = x == null ? W / 2 : x; y = y == null ? H * 0.35 : y;
      n = Math.min(n, 420 - bits.length);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283, v = 3 + Math.random() * (n > 60 ? 10 : 7);
        bits.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 1, fade: 0.014 + Math.random() * 0.008,
          r: 2 + Math.random() * 3.5, c: PC[i % PC.length], star: i % 4 === 0 });
      }
      fxOn = true;
    }
    return { confetti: confetti, boost: function (k) { warp = Math.min(1.4, warp + (k || 1)); } };
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

  /* ---------- "Study this" (../study.js, the list Name Lock shares) ---------- */
  var SL = window.StudyList, SI = {};
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
  function go(s, id) { if (window.Speak && Speak.stop) Speak.stop(); cur = { s: s, id: id || cur.id }; render(); }
  function render() {
    document.body.setAttribute("data-s", cur.s);
    ({ home: home, lobby: lobby, play: play, finish: finish, review: review, study: study, revenge: function () { window.REVENGE.enter(); } })[cur.s]();
  }
  window.nlBack = function () {
    var sh = app.querySelector(".sheet");
    if (sh) { closeSheet(); return true; }
    if (cur.s === "revenge") { if (!window.REVENGE.back()) go("home"); return true; }
    var up = { lobby: "home", play: "lobby", finish: "lobby", review: "finish", study: "home" }[cur.s];
    if (!up) return false;
    go(up); return true;
  };
  app.addEventListener("click", function (e) {
    var sb = e.target.closest("[data-study]");
    if (sb && SL) {
      var it = SI[sb.getAttribute("data-study")]; if (!it) return;
      var on = SL.toggle(it); SL.paintButtons(app); buzz([12]);
      toast(on ? "Added to To study: " + it.t : "Taken off To study");
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
  var STUB = ["linear-gradient(180deg,#FF9A62,#E2553C)", "linear-gradient(180deg,#3FD8BF,#118C80)", "linear-gradient(180deg,#FFC85A,#E68A2E)",
    "linear-gradient(180deg,#F86A8F,#C23762)", "linear-gradient(180deg,#2FA7B5,#0E6E73)"];
  function mockCard(id, c) {
    var r = getRun(id), sc = score(id, r), best = meta.best[id], pct = Math.round(100 * sc.answered / sc.N);
    var st = best != null ? starsFor(best) : 0;
    var status = r.done ? "Finished · " + fmt(sc.marks) + " / " + sc.N : sc.answered ? pct + "% done · " + sc.right + " right" : "Not started";
    return '<button class="mock ticket' + (r.done ? " done" : "") + '" data-go="lobby" data-id="' + id + '"><span class="stub" style="--c:' + c + '">' + sc.N + "<small>Qs</small></span>" +
      '<span class="mb"><span class="mt">' + esc(title_of(id)) + '</span><span class="ms">' + status + '</span><span class="mbar"><i style="width:' + pct + '%"></i></span></span>' +
      '<span class="best">' + (best != null ? best + "%<small>best</small>" : "<small>new</small>") + '<span class="stars">' + starHTML(st) + "</span></span></button>";
  }
  function groupHTML(g, gi) {
    var c = STUB[(gi || 0) % STUB.length];
    return '<section class="catalog-group"><h2 class="sh">' + esc(g.title) + '</h2><p class="gsub">' + esc(g.sub) + "</p><div class=\"mgrid\">" +
      g.members.map(function (id) { return mockCard(id, c); }).join("") + "</div></section>";
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
    var open = GROUPS.filter(function (g) { return !g.archived; }), closed = GROUPS.filter(function (g) { return g.archived; });
    var nQ = 0, nM = 0; GROUPS.forEach(function (g) { g.members.forEach(function (id) { nM++; nQ += P[id].questions.length; }); });
    var last = meta.last && P[meta.last] ? meta.last : null, ex = nextExam();
    var poster = ex ? '<section class="poster"><div class="kick">Next exam</div><h1>' + esc(ex.name) + '<span class="soft">' +
        (ex.days === 0 ? "today" : ex.days === 1 ? "tomorrow" : "in " + ex.days + " days") + "</span></h1><p>" + esc(String(ex.g.sub).split(/\.\s/)[0].replace(/\.$/, "")) + ".</p></section>"
      : '<section class="poster"><h1>Tests<span class="soft">' + nM + " mocks ready</span></h1><p>" + nQ.toLocaleString() + " questions. Untimed, +1 / −0.25.</p></section>";
    var resume;
    if (last) {
      var lr = getRun(last), ls = score(last, lr), lp = Math.round(100 * ls.answered / ls.N);
      resume = '<section class="glass resume"><div class="ring" style="--p:' + lp + '"><b>' + ls.answered + "<small>of " + ls.N + "</small></b></div>" +
        "<div><h3>" + esc(title_of(last)) + "</h3><p>" + (lr.done ? "Finished · " + fmt(ls.marks) + " / " + ls.N : ls.answered ? "Score so far " + fmt(ls.marks) + ", " + ls.right + " right" : "Not started yet") +
        (meta.best[last] != null ? " · best " + meta.best[last] + "%" : "") + "</p></div>" +
        '<button class="btn primary-action" data-go="play" data-id="' + last + '">Continue ' + I.next + "</button></section>";
    } else {
      resume = '<section class="glass resume none"><div><h3>Pick a paper</h3><p>' + nM + " mocks, " + nQ.toLocaleString() + ' questions. Every right answer feeds your combo.</p></div><a class="btn primary-action" href="#catalog">Choose a test ' + I.next + "</a></section>";
    }
    var h = '<div class="screen home-screen">' + hud() + '<div class="scroll home-scroll"><div class="home-layout"><aside class="briefing">' + poster + resume +
      '<div class="today' + (frac >= 1 ? " met" : "") + '"><b>' + (frac >= 1 ? "Daily goal done" : done + " of " + DAILY_GOAL + " today") + "</b>" +
      (meta.bestCombo ? '<span class="chip sun">' + I.spark + " Best combo " + meta.bestCombo + "</span>" : "") +
      '<div class="bar"><i style="width:' + Math.round(100 * frac) + '%"></i></div><p>' + (frac >= 1 ? "Streak safe for today. Keep the combo going." : (DAILY_GOAL - done) + " to go today") + "</p></div>" +
      '<div class="secondary-tools">' + (window.REVENGE ? window.REVENGE.cta() : "") +
      (SL ? '<button class="btn ghost" data-go="study">To study · ' + SL.counts().open + " open</button>" : "") + '</div></aside><main class="catalog" id="catalog"><h2 class="sec">Papers</h2>' +
      open.map(groupHTML).join("") +
      (closed.length ? '<details class="closed"><summary>Closed cycles (still playable)<small>' + closed.map(function (g) { return g.title; }).join(", ") +
        "</small></summary>" + closed.map(function (g, i) { return groupHTML(g, open.length + i); }).join("") + "</details>" : "") + "</main></div>" +
      '<div class="toggles"><button class="tg' + (meta.sound ? " on" : "") + '" id="tgS">Sound ' + (meta.sound ? "on" : "off") + '</button><button class="tg' +
      (meta.haptic ? " on" : "") + '" id="tgH">Vibration ' + (meta.haptic ? "on" : "off") + '</button></div><div class="toggles" style="margin-top:8px"><button class="tg' + (syncCode() ? " on" : "") + '" id="tgY">Sync ' + (syncCode() || "off") + " ›</button></div>" +
      '<div class="foot">' + nM + " mocks · " + nQ.toLocaleString() + " questions · untimed · +1 / −0.25</div></div></div>";
    app.innerHTML = h;
    document.getElementById("tgS").onclick = function () { meta.sound = !meta.sound; saveMeta(); home(); };
    document.getElementById("tgH").onclick = function () { meta.haptic = !meta.haptic; saveMeta(); home(); };
    document.getElementById("tgY").onclick = syncSheet;
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
      if (r.done) { r = { i: 0, ans: {}, mode: "practice", done: false, redo: null, xp: 0 }; saveRun(id, r); }
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
      saveRun(id, { i: 0, ans: {}, mode: "practice", done: false, redo: null, xp: 0 }); lobby();
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
      return '<button class="' + cls + '" data-k="' + k + '"><span class="k">' + k + '</span><span class="ot">' + q.options[k] + "</span></button>";
    }).join("");
    var lastStep = pos >= len - 1;
    var nextLbl = a == null ? (lastStep ? "Finish" : "Skip") : lastStep ? "Finish" : "Continue";
    app.innerHTML = '<div class="screen play-screen"><div class="ptop play-top"><button class="xbtn" id="pX" aria-label="Back to the paper">' + I.close + '</button><div class="pmid"><b>' + esc(title_of(id)) +
      "</b><span>" + (list ? "Redo " + (pos + 1) + " of " + len : "Question " + (r.i + 1) + " of " + N) + "</span></div>" +
      '<div class="pill xpp" id="xpp">' + I.spark + '<span id="xpn">' + meta.xp.toLocaleString("en-IN") + "</span></div></div>" +
      '<div class="pstrip"><div class="pbar"><i style="width:' + Math.round(100 * (pos + (a != null ? 1 : 0)) / len) + '%"></i></div><div id="heat">' + heat(combo) + "</div></div>" +
      '<div class="scroll" id="ps"><div class="qmeta"><span class="chip qn">' + (list ? "Redo " + (pos + 1) + "/" + len + " · " : "") + "Q" + (r.i + 1) + " of " + N + "</span>" +
      (sec ? '<span class="chip">' + esc(sec) + "</span>" : "") + (src ? '<span class="chip src">' + esc(src) + "</span>" : "") +
      (window.Speak && Speak.ok ? '<button class="chip spk" id="spk">🔊 Listen</button>' : "") + studyBtn(id, q, r.i) + "</div>" +
      '<div class="qcard">' + q.q + '</div><div class="opts' + (shown ? " locked" : "") + '" id="opts">' + opts + '</div><div id="after">' + (shown ? afterHTML(id, q, r.i, a) : "") + "</div></div>" +
      '<div class="pfoot"><button class="nav" id="pPrev">‹</button><button class="grid" id="pGrid">☰ ' + (r.i + 1) + '</button><button class="btn' + (shown ? (a === q.correct ? " ok" : " bad") : " ghost") +
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
  var TCOL = ["#FFD36B", "#FFC24B", "#FFB04F", "#FF9C55", "#FF8257", "#FF7360", "#F9646B", "#F45872", "#F04E78", "#F04E78"];
  function heat(c, crack) {
    var t = "";
    for (var i = 0; i < 10; i++) t += '<i class="' + (i < c ? "on" : "") + '" style="--tc:' + TCOL[i] + '"></i>';
    return '<div class="heat"><span class="lbl' + (c ? "" : " cold") + '">' + I.flame + (c ? c + " in a row" : crack ? "Combo broken" : "No combo yet") + "</span>" +
      '<div class="ticks' + (crack ? " crack" : "") + '">' + t + "</div></div>";
  }
  function afterHTML(id, q, idx, a) {
    var ok = a === q.correct;
    return '<div class="verdict ' + (ok ? "ok" : "bad") + '">' + (ok ? "✓ Correct" : "✗ Not quite, it's " + q.correct.toUpperCase()) +
      "<small>" + (ok ? "+1" : "−0.25") + "</small></div>" + explainHTML(id, q, idx);
  }
  function answer(id, k) {
    var r = getRun(id), q = P[id].questions[r.i];
    if (r.ans[r.i] != null) return;
    r.ans[r.i] = k;
    meta.days[today()] = (meta.days[today()] || 0) + 1;
    if (k !== q.correct) studyWrong(id, r.i);
    var ok = k === q.correct, gain = 0, lvBefore = level(), hadCombo = combo;
    if (ok) {
      combo++; gain = 10 + (combo >= 3 ? 5 : 0) + (combo >= 10 ? 5 : 0);
      meta.xp += gain; r.xp = (r.xp || 0) + gain; meta.bestCombo = Math.max(meta.bestCombo || 0, combo);
    } else combo = 0;
    saveRun(id, r); saveMeta();
    play();
    var opts = document.getElementById("opts");
    var hit = opts.querySelector('[data-k="' + k + '"]'), rc = hit.getBoundingClientRect();
    if (ok) {
      hit.classList.add("pop"); buzz([18]); tone(combo >= 3 ? [660, 880, 1100] : [660, 880]);
      var gn = document.createElement("span"); gn.className = "gain"; gn.textContent = "+" + gain + " XP"; hit.appendChild(gn);
      if (combo >= 2) { var stp = document.createElement("div"); stp.className = "stamp"; stp.innerHTML = "x" + combo + "<small>combo</small>"; document.querySelector("#ps .qcard").appendChild(stp); }
      var xpn = document.getElementById("xpn"), xpp = document.getElementById("xpp");
      if (xpn) {
        xpn.textContent = (meta.xp - gain).toLocaleString("en-IN");
        setTimeout(function () { xpn.textContent = meta.xp.toLocaleString("en-IN"); xpp.classList.remove("bump"); void xpp.offsetWidth; xpp.classList.add("bump"); }, 480);
      }
      flash("ok", rc); FX.boost(0.6);
      FX.confetti(combo >= 3 ? 40 : 26, rc.left + rc.width / 2, rc.top + rc.height / 2);
      if (combo === 3 || combo === 5 || combo % 10 === 0) {
        banner("COMBO x" + combo, combo >= 10 ? "UNSTOPPABLE" : combo >= 5 ? "ON FIRE" : "HEATING UP");
        FX.confetti(combo >= 5 ? 110 : 60); tone([784, 988, 1175, 1568]); buzz([20, 30, 20, 30, 40]);
      }
    }
    else {
      hit.classList.add("shake"); flash("bad", rc); buzz([40, 60, 40]); tone([300, 220]);
      var ht = document.getElementById("heat"); if (ht && hadCombo) ht.innerHTML = heat(0, true);
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
      L.filter(function (k) { return q.options[k] != null; }).map(function (k) { return '<div class="opt' + (k === q.correct ? " right" : " fade") + '"><span class="k">' + k + '</span><span class="ot">' + q.options[k] + "</span></div>"; }).join("") +
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
    toast: toast, flash: flash, banner: banner, tone: tone, buzz: buzz, floater: floater, gain: gain, addWrongQuestion: addWrongQuestion, studyWrong: studyWrong, closeSheet: closeSheet };
  render();
})();
