/* learn.js: the Tests app learning engine (Sihan's spec, 20 Nov 2026).
   - Tag a single option you don't know: an "o:<mock>:<idx>:<letter>" item in the shared
     To study list (study.js), so it syncs and shows in Name Lock too.
   - Where to read it: every question maps to a Final Textbook section (book-map.js).
   - The Safehouse (the To study list, upgraded): by Final Textbook chapter, by subject,
     unknown options, search; red / amber / green; Read as briefing; Interrogation drill.
   Reads window.TAPP (app.js) at call time, so it can load before app.js. */
(function () {
  "use strict";
  var SL = window.StudyList, BM = window.BOOK_MAP;
  var L4 = ["a", "b", "c", "d"];
  var NOTES_KEY = "tapp-book-notes-v1"; /* {sectionId: text}; sync.js carries every *-notes-v1 key */
  function T() { return window.TAPP; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function strip(s) { var d = document.createElement("div"); d.innerHTML = s == null ? "" : s; return d.textContent.trim(); }
  if (SL && SL.loadPageMap) SL.loadPageMap(); /* reviewed exact pages (study-pages.json) */

  /* ---------- the Final Textbook map ---------- */
  var SEC = {}, SUBS = (BM && BM.subs) || {}, CHN = {}, SEC_LIST = [];
  if (BM) {
    BM.chapters.forEach(function (c) { CHN[c[0]] = c[1]; });
    BM.sections.forEach(function (s, i) { SEC[s[0]] = { id: s[0], t: s[1], p: s[2], i: i, ch: parseInt(s[1], 10) }; SEC_LIST.push(SEC[s[0]]); });
  }
  function secOf(loc) { return loc ? SEC[String(loc).replace(/^([a-z]+-\d+)-\d+$/, "$1")] || null : null; }
  function normStem(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function h3(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36).slice(-3); }
  /* same light stemmer book-map.js was built with */
  function stem(w) {
    if (w.length > 5) w = w.replace(/(ations?|ization|isation)$/, "ate").replace(/(ies)$/, "y").replace(/(ing|ed|ly|es|s)$/, "");
    else if (w.length > 3) w = w.replace(/s$/, "");
    return w;
  }
  function toks(text) {
    return String(text).toLowerCase().replace(/[’']s\b/g, "").replace(/[^a-z0-9]+/g, " ").split(" ")
      .filter(function (w) { return w.length > 2 && !/^\d+$/.test(w); }).map(stem);
  }
  var AREA_CH = { general: 1, assessment: 2, social: 3, personality: 4, physio: 5, dev: 6, clinical: 7, disorders: 8, research: 9 };
  var KW = null;
  /* anything that isn't a mapped mock question (Name Lock cards, own topics, a question that moved) */
  function kwMatch(text, area) {
    if (!BM) return null;
    if (!KW) { KW = {}; for (var k in BM.kw) KW[k] = BM.kw[k].split(" "); }
    var tk = {}; toks(text).forEach(function (w) { tk[w] = 1; });
    var best = null, bx = 0, ch = AREA_CH[area];
    for (var s in KW) {
      var x = 0, ws = KW[s];
      for (var i = 0; i < ws.length; i++) if (tk[ws[i]]) x += 1 - i / ws.length;
      if (ch && SEC[s] && SEC[s].ch === ch) x *= 1.3;
      if (x > bx) { bx = x; best = s; }
    }
    return best && bx >= 0.9 ? { loc: best, kw: 1 } : null;
  }
  var QC = {};
  function qArea(id, q) { var lab = (T().P[id].sectionLabels || {})[q.section] || ""; return SL ? SL.areaOf((q.section || "") + " " + lab) : "other"; }
  function qLoc(id, idx) {
    var P = T().P, q = P[id] && P[id].questions[idx];
    if (!q || !BM) return null;
    if (!QC[id]) QC[id] = BM.q[id] ? BM.q[id].split(" ") : [];
    var e = QC[id][idx], parts = e ? e.split("|") : null;
    if (parts && parts[1] === h3(normStem(q.q))) return parts[0] === "none" ? { none: 1 } : { loc: parts[0] };
    return kwMatch(strip(q.q) + " " + strip(q.options[q.correct] || ""), qArea(id, q));
  }
  function refOf(it) {
    var m = /^m:(.+):(\d+)$/.exec((it && it.r) || ""), P = T().P;
    return m && P[m[1]] && P[m[1]].questions[+m[2]] ? { id: m[1], i: +m[2], q: P[m[1]].questions[+m[2]] } : null;
  }
  function locOf(it) {
    if (it.s && secOf(it.s)) return { loc: it.s, mine: 1 };
    var rf = refOf(it);
    if (rf) return qLoc(rf.id, rf.i);
    return kwMatch((it.t || "") + " " + (it.q || ""), it.a);
  }
  function pageOf(lc, it) {
    var s = secOf(lc && lc.loc);
    if (!s) return null;
    if (it && it.pg) return { p: +it.pg, how: "mine" };
    if (it && SL && SL.resolvePage) {
      var r = SL.resolvePage(it);
      if (r.state === "matched") {
        var hit = r.locations.filter(function (l) { return l.sectionId === s.id; })[0];
        if (hit) return { p: hit.pages[0], how: "exact" };
      }
    }
    return { p: s.p, how: "start" };
  }
  function root() { return (SL && SL.root) || "https://msahil515.github.io/sihan-met-flashcards/"; }
  function libUrl(loc, s) { return root() + "notes-app/#/read/final-book-0" + s.ch + "?at=" + encodeURIComponent(loc); }
  function pdfUrl(p) { return root() + BM.pdf + "#page=" + p; }
  /* "Read in Final Textbook" badge. edit = the data attribute that opens the spot editor */
  function badge(lc, it, edit) {
    if (!BM) return "";
    var ed = edit ? '<button class="bk-ed" ' + edit + ' aria-label="Change where to read this">✎ Change</button>' : "";
    if (lc && lc.none) return '<div class="bk none"><span class="bk-l">Final Textbook</span><b>Not in the book</b><span class="bk-row"><span class="bk-p">English and language skills aren\'t covered there</span>' + ed + "</span></div>";
    var s = secOf(lc && lc.loc);
    if (!s) return '<div class="bk none"><span class="bk-l">Final Textbook</span><b>No section matched yet</b><span class="bk-row">' + (ed || "") + "</span></div>";
    var sub = lc.loc !== s.id && SUBS[lc.loc] ? SUBS[lc.loc] : "", pg = pageOf(lc, it);
    var pl = pg.how === "mine" ? "Your page: p. " + pg.p : pg.how === "exact" ? "Page " + pg.p : "Section starts p. " + pg.p;
    return '<div class="bk' + (lc.mine ? " mine" : "") + '"><span class="bk-l">Read in Final Textbook</span><b>Ch ' + s.ch + " · " + esc(s.t) + "</b>" +
      (sub ? '<span class="bk-sub">› ' + esc(sub) + "</span>" : "") +
      '<span class="bk-row"><span class="bk-p">' + pl + '</span><a href="' + esc(libUrl(lc.loc, s)) + '" target="_blank" rel="noopener">Library</a>' +
      '<a href="' + esc(pdfUrl(pg.p)) + '" target="_blank" rel="noopener">PDF</a>' + ed + "</span></div>";
  }
  function shortLoc(lc, it) {
    if (lc && lc.none) return "Not in the book";
    var s = secOf(lc && lc.loc); if (!s) return "No section yet";
    var pg = pageOf(lc, it);
    return "Ch " + s.ch + " · " + s.t.replace(/:.*$/, "") + " · p. " + pg.p;
  }

  /* ---------- items ---------- */
  function qid(id, i) { return "m:" + id + ":" + i; }
  function oid(id, i, k) { return "o:" + id + ":" + i + ":" + k; }
  function optItem(id, i, k) {
    var q = T().P[id].questions[i];
    return { id: oid(id, i, k), t: strip(q.options[k]), a: qArea(id, q), f: T().title_of(id) + " · Q" + (i + 1) + " · option " + k.toUpperCase(),
      q: strip(q.q), r: qid(id, i), o: k };
  }
  function ensureQ(id, i) {
    var x = qid(id, i);
    if (!SL.has(x)) SL.add(T().studyItem(id, T().P[id].questions[i], i));
    return x;
  }
  function heatOf(it) { return it.d ? "g" : +it.h === 1 ? "a" : "r"; }
  var HEAT = { r: "Red · clueless", a: "Amber · reviewing", g: "Green · locked in" };
  function setHeat(id, h) {
    if (h === "g") SL.update(id, { d: Date.now() });
    else if (h === "a") SL.update(id, { d: 0, h: 1 });
    else SL.update(id, { d: 0, h: 0, c: 0 });
  }
  function itemsAll() { return SL ? SL.all() : []; }
  function active(items) { return items.filter(function (x) { return !x.d; }); }
  function byHeat(a, b) { var o = { r: 0, a: 1, g: 2 }; return (o[heatOf(a)] - o[heatOf(b)]) || b.at - a.at; }

  /* ---------- in the test: option tags, trap tags, quick note ---------- */
  var TAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.8" fill="currentColor"/></svg>';
  function otag(id, i, k) {
    if (!SL) return "";
    var on = SL.has(oid(id, i, k));
    return '<span class="otag' + (on ? " on" : "") + '" role="button" tabindex="0" data-otag="' + esc(id + "|" + i + "|" + k) + '" aria-label="' +
      (on ? "Untag" : "Tag") + " option " + k.toUpperCase() + ' as don\'t know">' + TAG + "</span>";
  }
  function trapTag(id, i, k) {
    if (!SL) return "";
    var on = SL.has(oid(id, i, k));
    return '<button class="ttag' + (on ? " on" : "") + '" data-otag="' + esc(id + "|" + i + "|" + k) + '">' + (on ? "✓ Tagged, in the Safehouse" : "⚑ Don't know this one") + "</button>";
  }
  function paint(rootEl) {
    (rootEl || document).querySelectorAll("[data-otag]").forEach(function (el) {
      var p = el.getAttribute("data-otag").split("|"), on = SL.has(oid(p[0], +p[1], p[2]));
      el.classList.toggle("on", on);
      if (el.classList.contains("ttag")) el.textContent = on ? "✓ Tagged, in the Safehouse" : "⚑ Don't know this one";
    });
    if (SL.paintButtons) SL.paintButtons(rootEl);
  }
  function noteRow(id, i) {
    var it = SL && SL.get(qid(id, i)), m = it && it.m;
    return '<div class="db-note" data-qn="' + esc(id + "|" + i) + '">' + (m ? '<div class="db-my"><span>Your note</span>' + esc(m) + "</div>" : "") +
      '<div class="db-ni hide"><input maxlength="200" placeholder="One-line memory hook or mnemonic" value="' + esc(m || "") + '"><button class="db-ns">Save</button></div></div>';
  }
  /* returns true when it handled the click */
  function click(e) {
    if (!SL) return false;
    var t = e.target.closest("[data-otag],[data-qnote],.db-ns,[data-spot]");
    if (!t) return false;
    var TA = T();
    if (t.hasAttribute("data-otag")) {
      var p = t.getAttribute("data-otag").split("|"), x = optItem(p[0], +p[1], p[2]), on = SL.toggle(x);
      paint(TA.app); TA.buzz([12]);
      TA.toast(on ? "Option " + p[2].toUpperCase() + " tagged · in the Safehouse" : "Option " + p[2].toUpperCase() + " untagged");
      if (cur === "study") renderSafe();
      return true;
    }
    if (t.hasAttribute("data-qnote")) {
      var box = TA.app.querySelector('.db-note[data-qn="' + t.getAttribute("data-qnote") + '"] .db-ni');
      if (box) { box.classList.toggle("hide"); var inp = box.querySelector("input"); if (!box.classList.contains("hide")) inp.focus(); }
      return true;
    }
    if (t.classList.contains("db-ns")) {
      var wrap = t.closest(".db-note"), q = wrap.getAttribute("data-qn").split("|"), v = wrap.querySelector("input").value.trim();
      var sid = ensureQ(q[0], +q[1]); SL.update(sid, { m: v.slice(0, 200) });
      wrap.outerHTML = noteRow(q[0], +q[1]);
      paint(TA.app); TA.toast(v ? "Note saved · question is in the Safehouse" : "Note cleared");
      return true;
    }
    if (t.hasAttribute("data-spot")) { spotSheet(t.getAttribute("data-spot")); return true; }
    return false;
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target && e.target.closest && e.target.closest(".db-ni")) e.target.closest(".db-ni").querySelector(".db-ns").click();
  });
  /* the badge under an answered question (it = the saved item if it's in the Safehouse) */
  function debriefBadge(id, i) {
    var x = SL && SL.get(qid(id, i)), it = x ? Object.assign({ id: qid(id, i) }, x) : { r: qid(id, i), q: strip(T().P[id].questions[i].q).slice(0, 400) };
    return badge(x ? locOf(it) : qLoc(id, i), it, 'data-spot="q|' + esc(id + "|" + i) + '"');
  }

  /* ---------- "where to read it" editor ---------- */
  function spotSheet(spec) {
    var TA = T(), p = spec.split("|"), itemId = p[0] === "q" ? qid(p[1], +p[2]) : p.slice(1).join("|"), it = SL.get(itemId);
    var autoLc = p[0] === "q" ? qLoc(p[1], +p[2]) : it ? locOf(Object.assign({ id: itemId }, it, { s: null })) : null;
    var lc = it && it.s ? locOf(Object.assign({ id: itemId }, it)) : autoLc, curSec = secOf(lc && lc.loc);
    TA.closeSheet();
    var bg = document.createElement("div"); bg.className = "sheet-bg"; bg.onclick = TA.closeSheet;
    var sh = document.createElement("div"); sh.className = "sheet"; sh.style.overflowY = "auto";
    var opts = BM.chapters.map(function (c) {
      return '<optgroup label="Ch ' + c[0] + " · " + esc(c[1]) + '">' + SEC_LIST.filter(function (s) { return s.ch === c[0]; }).map(function (s) {
        return '<option value="' + s.id + '"' + (curSec && curSec.id === s.id ? " selected" : "") + ">" + esc(s.t) + " (p. " + s.p + ")</option>";
      }).join("") + "</optgroup>";
    }).join("");
    sh.innerHTML = "<h3>Where to read this</h3><p class=\"hint\" style=\"margin:0 4px 12px\">Pick the Final Textbook section. Add the exact page if you found it.</p>" +
      '<select id="spSec" class="sp-in">' + (curSec ? "" : '<option value="">Choose a section</option>') + opts + "</select>" +
      '<input id="spPg" class="sp-in" inputmode="numeric" maxlength="4" placeholder="Page number (optional)" value="' + esc(it && it.pg ? it.pg : "") + '">' +
      '<button class="btn" id="spOk">Save</button>' + (it && (it.s || it.pg) ? '<button class="btn ghost" id="spAuto">Go back to the automatic match</button>' : "");
    TA.app.appendChild(bg); TA.app.appendChild(sh);
    document.getElementById("spOk").onclick = function () {
      var sec = document.getElementById("spSec").value, pg = parseInt(document.getElementById("spPg").value, 10);
      if (!sec) { TA.toast("Pick a section"); return; }
      if (p[0] === "q") ensureQ(p[1], +p[2]);
      var autoSec = secOf(autoLc && autoLc.loc); /* same section as the automatic match: keep its subsection, store only the page */
      SL.update(itemId, { s: autoSec && autoSec.id === sec ? null : sec, pg: pg > 0 && pg < 2000 ? pg : null });
      TA.closeSheet(); TA.toast("Saved · " + SEC[sec].t.replace(/:.*$/, "")); refresh();
    };
    var au = document.getElementById("spAuto");
    if (au) au.onclick = function () { SL.update(itemId, { s: null, pg: null }); TA.closeSheet(); TA.toast("Back to the automatic match"); refresh(); };
  }
  function refresh() {
    if (cur === "study") renderSafe();
    else if (cur === "brief") renderBrief();
    else if (T().cur().s === "play") T().go("play");
  }

  /* ---------- the Safehouse ---------- */
  var cur = null, tab = "ch", query = "", heatF = "act", openCh = {};
  function bookNotes() { var o = T().load(NOTES_KEY); return o && typeof o === "object" ? o : {}; }
  function saveBookNote(sec, v) { var o = bookNotes(); if (v) o[sec] = String(v).slice(0, 2000); else delete o[sec]; T().store(NOTES_KEY, o); }
  function explainOpt(it) {
    var rf = refOf(it); if (!rf || !it.o) return null;
    var q = rf.q, d = T().DEEP[rf.id] && T().DEEP[rf.id][rf.i], ok = d && !(d.q && q.q && d.q.trim() !== q.q.trim());
    if (it.o === q.correct) return { right: 1, text: ok && d.concept ? d.concept : q.explanation || "" };
    return { right: 0, text: ok && d.traps && d.traps[it.o] ? d.traps[it.o] : "" };
  }
  function itemCard(x) {
    var h = heatOf(x), rf = refOf(x), lc = locOf(x), ex = x.o ? explainOpt(x) : null;
    var body = "";
    if (x.o && rf) {
      body = '<div class="sh-ctx">' + (ex && ex.right ? '<span class="sh-r">The right answer</span> ' : '<span class="sh-w">A wrong option</span> ') + "in: " + esc(strip(rf.q.q).slice(0, 160)) + "</div>" +
        (ex && ex.text ? '<p class="sh-ex">' + T().boldFig(esc(ex.text)) + "</p>" : '<p class="sh-ex">No breakdown for this option yet. The answer is ' + rf.q.correct.toUpperCase() + ") " + esc(strip(rf.q.options[rf.q.correct])) + ".</p>");
    } else if (x.q) body = '<div class="sh-q">' + esc(x.q) + "</div>";
    return '<div class="sh-it h-' + h + '" data-id="' + esc(x.id) + '"><button class="sh-heat" data-act="heat" aria-label="Change mastery">' + HEAT[h] + "</button>" +
      '<div class="sh-t">' + (x.o ? '<span class="sh-ol">' + esc(String(x.o).toUpperCase()) + "</span> " : "") + esc(x.t) + "</div>" +
      '<div class="sh-f">' + esc(x.f) + "</div>" + body + (x.m ? '<div class="db-my"><span>Your note</span>' + esc(x.m) + "</div>" : "") +
      '<div class="sh-loc">' + esc(shortLoc(lc, x)) + "</div>" +
      '<div class="sh-ac">' + (rf ? '<button data-act="open">' + (x.o ? "Show question" : "Open") + "</button>" : '<a href="' + esc(SL.notesUrl(x)) + '" target="_blank" rel="noopener">📖 Notes</a>') +
      '<button data-act="note">✎ Note</button><button data-act="spot">Book spot</button><button class="sh-x" data-act="rm">Remove</button></div></div>';
  }
  function scopeItems(scope, items) {
    items = active(items || itemsAll());
    var p = scope.split(":");
    return items.filter(function (x) {
      if (p[0] === "all") return true;
      if (p[0] === "opts") return !!x.o;
      if (p[0] === "area") return x.a === p[1];
      var lc = locOf(x), s = secOf(lc && lc.loc);
      if (p[0] === "sec") return s ? s.id === p[1] : p[1] === "none";
      if (p[0] === "ch") return s && s.ch === +p[1];
      return false;
    });
  }
  function scopeName(scope) {
    var p = scope.split(":");
    if (p[0] === "sec") return SEC[p[1]] ? SEC[p[1]].t : "Not in the book";
    if (p[0] === "ch") return "Ch " + p[1] + " · " + CHN[p[1]];
    if (p[0] === "area") return SL.areaName(p[1]);
    if (p[0] === "opts") return "Unknown options";
    return "Everything in the Safehouse";
  }
  function groupBtns(scope, n) {
    return '<div class="sh-gb"><button data-brief="' + esc(scope) + '">Read as briefing</button><button data-drill="' + esc(scope) + '">Run drill · ' + n + "</button></div>";
  }
  function archive(items) {
    var g = items.filter(function (x) { return x.d; });
    return g.length ? '<details class="sh-arc"><summary>Locked in · ' + g.length + "</summary>" + g.sort(byHeat).map(itemCard).join("") + "</details>" : "";
  }
  function counts(xs) { var o = 0, q = 0; xs.forEach(function (x) { if (x.o) o++; else q++; }); var oo = o + (o === 1 ? " option" : " options"); return q ? q + (q === 1 ? " Q" : " Qs") + (o ? " · " + oo : "") : oo; }
  function tabChapters(items) {
    var act = active(items), bySec = {}, none = [];
    act.forEach(function (x) { var s = secOf((locOf(x) || {}).loc); if (s) (bySec[s.id] = bySec[s.id] || []).push(x); else none.push(x); });
    var chN = {}; act.forEach(function (x) { var s = secOf((locOf(x) || {}).loc); if (s) chN[s.ch] = (chN[s.ch] || 0) + 1; });
    var top = Object.keys(chN).sort(function (a, b) { return chN[b] - chN[a]; }).slice(0, 3);
    var notes = bookNotes();
    var h = top.length ? '<p class="sh-top">Costing you most: ' + top.map(function (c) { return "<b>Ch " + c + " " + esc(CHN[c]) + "</b> (" + chN[c] + ")"; }).join(", ") + "</p>" : "";
    BM.chapters.forEach(function (c) {
      var secs = SEC_LIST.filter(function (s) { return s.ch === c[0] && bySec[s.id]; });
      if (!secs.length) return;
      var all = []; secs.forEach(function (s) { all = all.concat(bySec[s.id]); });
      h += '<details class="sh-ch" data-ch="' + c[0] + '"' + (openCh[c[0]] ? " open" : "") + '><summary><span class="sh-cn">Ch ' + c[0] + '</span><span class="sh-ct">' + esc(c[1]) +
        '</span><span class="sh-cc">' + counts(all) + "</span></summary>" + groupBtns("ch:" + c[0], all.length) +
        secs.map(function (s) {
          var g = bySec[s.id].sort(byHeat);
          return '<section class="sh-sec"><div class="sh-sh"><b>' + esc(s.t) + "</b><span>" + counts(g) + " · starts p. " + s.p + "</span></div>" + groupBtns("sec:" + s.id, g.length) +
            '<label class="sh-bn"><span>My textbook notes</span><textarea data-bnote="' + s.id + '" rows="2" maxlength="2000" placeholder="Page, summary, diagram, anything from the book">' + esc(notes[s.id] || "") + "</textarea></label>" +
            g.map(itemCard).join("") + "</section>";
        }).join("") + "</details>";
    });
    if (none.length) h += '<details class="sh-ch"><summary><span class="sh-cn">–</span><span class="sh-ct">Not in the book / no section yet</span><span class="sh-cc">' + counts(none) + "</span></summary>" +
      none.sort(byHeat).map(itemCard).join("") + "</details>";
    return h + archive(items);
  }
  function tabSubjects(items) {
    var act = active(items), h = "";
    SL.AREAS.forEach(function (a) {
      var g = act.filter(function (x) { return x.a === a[0]; }).sort(byHeat);
      if (!g.length) return;
      h += '<div class="sh-area"><span>' + esc(a[1]) + "</span><span>" + counts(g) + "</span></div>" + groupBtns("area:" + a[0], g.length) + g.map(itemCard).join("");
    });
    return h + archive(items);
  }
  function tabOptions(items) {
    var g = active(items).filter(function (x) { return x.o; }).sort(byHeat);
    var h = g.length ? '<p class="sh-top">Every option you tagged "don\'t know", with what it means.</p>' + groupBtns("opts", g.length) + g.map(itemCard).join("")
      : '<div class="stl-empty">No tagged options yet. In a test, tap the tag on any option (before or after answering) to save just that option here.</div>';
    return h + archive(items.filter(function (x) { return x.o; }));
  }
  function matches(x, w) {
    if (!w) return true;
    var rf = refOf(x), ex = x.o ? explainOpt(x) : null, hay = [x.t, x.q, x.f, x.m, ex && ex.text].join(" ");
    if (rf) hay += " " + L4.map(function (k) { return strip(rf.q.options[k] || ""); }).join(" ") + " " + strip(rf.q.explanation || "");
    hay = hay.toLowerCase();
    return w.toLowerCase().split(/\s+/).every(function (t) { return hay.indexOf(t) >= 0; });
  }
  function allList(items) {
    var g = items.filter(function (x) { return heatF === "every" ? true : heatF === "act" ? !x.d : heatOf(x) === heatF; }).filter(function (x) { return matches(x, query); }).sort(byHeat);
    return '<p class="sh-top">' + g.length + (g.length === 1 ? " item" : " items") + "</p>" + (g.length ? g.map(itemCard).join("") : '<div class="stl-empty">Nothing matches.</div>');
  }
  function tabAll(items) {
    var f = [["act", "To study"], ["r", "Red"], ["a", "Amber"], ["g", "Locked in"], ["every", "Everything"]];
    return '<input class="sh-search" id="shQ" type="search" placeholder="Search questions, options, explanations, notes" value="' + esc(query) + '">' +
      '<div class="sh-hf">' + f.map(function (x) { return '<button data-hf="' + x[0] + '" class="' + (heatF === x[0] ? "on" : "") + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<div class="stl-add"><input id="stl-new" maxlength="120" placeholder="Add a topic yourself"><button id="stl-addb">Add</button></div>' +
      '<div id="shList">' + allList(items) + "</div>" + groupBtns("all", active(items).length) + '<button class="btn ghost" id="shCopy" style="margin-top:14px">Copy the whole list</button>';
  }
  function renderSafe() {
    var TA = T(), app = TA.app, items = itemsAll();
    var act = active(items), red = act.filter(function (x) { return heatOf(x) === "r"; }).length, amb = act.length - red, grn = items.length - act.length;
    var sc = (app.querySelector("#shs") || {}).scrollTop || 0;
    var tabs = [["ch", "Book chapters"], ["sub", "Subjects"], ["opt", "Options"], ["all", "Search"]];
    var body = !items.length ? '<div class="stl-empty">Nothing here yet. Wrong answers land here by themselves. In a test, tap <b>☆ Study this</b> for a whole question, or the tag on any option you don\'t know.</div>'
      : tab === "ch" ? tabChapters(items) : tab === "sub" ? tabSubjects(items) : tab === "opt" ? tabOptions(items) : tabAll(items);
    app.innerHTML = '<div class="screen safe-screen"><div class="ptop"><button class="xbtn" data-go="home" aria-label="Back">' + TA.icons.back + '</button><div class="ptitle">Safehouse</div></div>' +
      '<div class="scroll narrow" id="shs"><div class="sh-head"><div class="sh-stat r"><b>' + red + '</b><span>Red</span></div><div class="sh-stat a"><b>' + amb +
      '</b><span>Amber</span></div><div class="sh-stat g"><b>' + grn + '</b><span>Locked in</span></div></div>' +
      '<div class="seg sh-tabs">' + tabs.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (tab === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      body + "</div></div>";
    app.querySelector("#shs").scrollTop = sc;
    wireSafe(items);
  }
  var noteTimer = null;
  function wireSafe(items) {
    var TA = T(), app = TA.app;
    app.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { tab = b.getAttribute("data-tab"); renderSafe(); app.querySelector("#shs").scrollTop = 0; }; });
    app.querySelectorAll("details.sh-ch[data-ch]").forEach(function (d) { d.addEventListener("toggle", function () { openCh[d.getAttribute("data-ch")] = d.open; }); });
    app.querySelectorAll("[data-bnote]").forEach(function (ta) {
      ta.oninput = function () { clearTimeout(noteTimer); noteTimer = setTimeout(function () { saveBookNote(ta.getAttribute("data-bnote"), ta.value.trim()); }, 500); };
      ta.onblur = function () { clearTimeout(noteTimer); saveBookNote(ta.getAttribute("data-bnote"), ta.value.trim()); };
    });
    var q = app.querySelector("#shQ");
    if (q) q.oninput = function () { query = q.value; app.querySelector("#shList").innerHTML = allList(itemsAll()); };
    app.querySelectorAll("[data-hf]").forEach(function (b) { b.onclick = function () { heatF = b.getAttribute("data-hf"); renderSafe(); }; });
    var ab = app.querySelector("#stl-addb");
    if (ab) {
      var inp = app.querySelector("#stl-new");
      ab.onclick = function () { var t = inp.value.trim(); if (!t) return; SL.add({ id: "u:" + Date.now().toString(36), t: t, a: SL.areaOf(t), f: "Added by you" }); renderSafe(); TA.toast("Added"); };
      inp.onkeydown = function (e) { if (e.key === "Enter") ab.onclick(); };
    }
    var cp = app.querySelector("#shCopy");
    if (cp) cp.onclick = function () { TA.copyText(SL.exportText(itemsAll(), "all")); };
  }
  /* item actions + group buttons, delegated from the app's click handler */
  function safeClick(e) {
    var TA = T(), g = (cur === "study" || cur === "brief") && e.target.closest("[data-brief],[data-drill]");
    if (g) {
      if (g.hasAttribute("data-brief")) openBrief(g.getAttribute("data-brief")); else drillSheet(g.getAttribute("data-drill"));
      return true;
    }
    var b = cur === "study" && e.target.closest(".sh-it [data-act]");
    if (!b) return false;
    var id = b.closest(".sh-it").getAttribute("data-id"), x = SL.get(id), a = b.getAttribute("data-act");
    if (!x) return true;
    x = Object.assign({ id: id }, x);
    if (a === "heat") {
      var nx = { r: "a", a: "g", g: "r" }[heatOf(x)]; setHeat(id, nx); TA.buzz([12]);
      TA.toast(nx === "g" ? "Locked in. Moved to the archive." : nx === "a" ? "Amber · reviewing" : "Back to red");
      if (nx === "g") TA.fx.confetti(30, e.clientX, e.clientY);
      renderSafe();
    } else if (a === "open") { var rf = refOf(x); TA.questionSheet(rf.id, rf.i); }
    else if (a === "note") { var t = prompt("Your note (memory hook, page, anything)", x.m || ""); if (t == null) return true; SL.update(id, { m: t.trim().slice(0, 200) }); renderSafe(); }
    else if (a === "spot") spotSheet("i|" + id);
    else if (a === "rm") { SL.remove(id); TA.toast("Removed"); renderSafe(); }
    return true;
  }

  /* ---------- Read as briefing: one continuous sheet, no motion ---------- */
  var briefScope = "all";
  function openBrief(scope) { briefScope = scope; T().go("brief"); }
  function bySection(items) {
    var out = {}, order = [];
    items.forEach(function (x) { var s = secOf((locOf(x) || {}).loc), k = s ? s.id : "none"; if (!out[k]) { out[k] = []; order.push(k); } out[k].push(x); });
    order.sort(function (a, b) { return (SEC[a] ? SEC[a].i : 999) - (SEC[b] ? SEC[b].i : 999); });
    return order.map(function (k) { return { sec: SEC[k] || null, items: out[k] }; });
  }
  function renderBrief() {
    var TA = T(), app = TA.app, items = scopeItems(briefScope), notes = bookNotes();
    var h = '<div class="screen brief-screen"><div class="ptop"><button class="xbtn" data-go="study" aria-label="Back">' + TA.icons.back + '</button><div class="ptitle">Briefing</div></div><div class="scroll narrow bf">' +
      "<h1>" + esc(scopeName(briefScope)) + '</h1><p class="bf-s">' + counts(items) + " to study. Every question, the options you tagged, the full explanation, your notes and where to read it.</p>";
    if (!items.length) h += '<div class="stl-empty">Nothing left here. All locked in.</div>';
    bySection(items).forEach(function (g) {
      var s = g.sec;
      h += '<section class="bf-sec"><h2>' + (s ? esc(s.t) : "Not in the book / no section yet") + "</h2>" +
        (s ? '<p class="bf-p">Ch ' + s.ch + " " + esc(CHN[s.ch]) + " · section starts p. " + s.p + ' · <a href="' + esc(libUrl(s.id, s)) + '" target="_blank" rel="noopener">Library</a></p>' : "") +
        (s && notes[s.id] ? '<div class="db-my"><span>My textbook notes</span>' + esc(notes[s.id]) + "</div>" : "");
      var seen = {};
      g.items.forEach(function (x) {
        var rf = refOf(x);
        if (!rf) {
          h += '<article class="bf-q"><div class="bf-src">' + esc(x.f) + " · " + HEAT[heatOf(x)] + "</div><h3>" + esc(x.t) + "</h3>" + (x.q ? "<p>" + esc(x.q) + "</p>" : "") +
            (x.m ? '<div class="db-my"><span>Your note</span>' + esc(x.m) + "</div>" : "") + '<a class="bf-l" href="' + esc(SL.notesUrl(x)) + '" target="_blank" rel="noopener">📖 Notes</a></article>';
          return;
        }
        if (seen[x.r]) return; seen[x.r] = 1;
        var mine = items.filter(function (y) { return y.r === x.r; }), tagged = {}, qItem = null;
        mine.forEach(function (y) { if (y.o) tagged[y.o] = 1; else qItem = y; });
        var q = rf.q, pg = pageOf(locOf(x), x);
        h += '<article class="bf-q"><div class="bf-src">' + esc(TA.title_of(rf.id)) + " · Q" + (rf.i + 1) + (pg && pg.how !== "start" ? " · p. " + pg.p : "") + " · " + HEAT[heatOf(qItem || x)] + "</div>" +
          '<div class="bf-stem">' + q.q + '</div><ol class="bf-opts">' + L4.filter(function (k) { return q.options[k] != null; }).map(function (k) {
            return '<li class="' + (k === q.correct ? "ok" : "") + (tagged[k] ? " tg" : "") + '"><b>' + k.toUpperCase() + "</b> " + q.options[k] + (k === q.correct ? " ✓" : "") + (tagged[k] ? ' <span class="bf-tg">you tagged this</span>' : "") + "</li>";
          }).join("") + "</ol>" + TA.explainHTML(rf.id, q, rf.i) +
          mine.filter(function (y) { return y.m; }).map(function (y) { return '<div class="db-my"><span>Your note' + (y.o ? " on " + esc(String(y.o).toUpperCase()) : "") + "</span>" + esc(y.m) + "</div>"; }).join("") + "</article>";
      });
      h += "</section>";
    });
    h += (items.length ? groupBtns(briefScope, items.length).replace(/<button data-brief[^>]*>[^<]*<\/button>/, "") : "") + "</div></div>";
    app.innerHTML = h;
  }

  /* ---------- Interrogation: re-test the MCQs, or reveal and rate ---------- */
  var D = null;
  function drillSheet(scope) {
    var TA = T(), items = scopeItems(scope), qs = uniqQ(items);
    TA.closeSheet();
    var bg = document.createElement("div"); bg.className = "sheet-bg"; bg.onclick = TA.closeSheet;
    var sh = document.createElement("div"); sh.className = "sheet";
    sh.innerHTML = "<h3>Run drill</h3><p class=\"hint\" style=\"margin:0 4px 14px\">" + esc(scopeName(scope)) + ". Right twice and it asks to lock the item in green.</p>" +
      '<button class="btn" id="drQ"' + (qs.length ? "" : " disabled") + ">Question drill · " + qs.length + " MCQs</button>" +
      '<button class="btn ghost" id="drC"' + (items.length ? "" : " disabled") + ">Flashcards · " + items.length + " cards</button>";
    TA.app.appendChild(bg); TA.app.appendChild(sh);
    document.getElementById("drQ").onclick = function () { TA.closeSheet(); startDrill(scope, "q"); };
    document.getElementById("drC").onclick = function () { TA.closeSheet(); startDrill(scope, "c"); };
  }
  function uniqQ(items) {
    var seen = {}, out = [];
    items.forEach(function (x) { var rf = refOf(x); if (rf && !seen[x.r]) { seen[x.r] = 1; out.push(x.r); } });
    return out;
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function startDrill(scope, fmt) {
    var items = scopeItems(scope);
    var list = fmt === "q" ? uniqQ(items) : items.sort(byHeat).map(function (x) { return x.id; });
    D = { scope: scope, fmt: fmt, list: shuffle(list), i: 0, right: 0, done: 0, locked: 0, ans: null, rev: false, ask: [] };
    T().go("drill");
  }
  function linked(ref) { return itemsAll().filter(function (y) { return y.r === ref && !y.d; }); }
  /* one clear: red -> amber, count it, offer green at 2 */
  function clear(ids) {
    var ask = [];
    ids.forEach(function (id) {
      var x = SL.get(id); if (!x) return;
      var c = (+x.c || 0) + 1; SL.update(id, { c: c, h: 1 });
      if (c >= 2 && !x.d) ask.push(id);
    });
    return ask;
  }
  function miss(ids) { ids.forEach(function (id) { if (SL.get(id)) SL.update(id, { c: 0, h: 0, d: 0 }); }); }
  function askHTML() {
    if (!D.ask.length) return "";
    return '<div class="dr-ask"><b>Cleared twice.</b> Lock ' + (D.ask.length > 1 ? "these " + D.ask.length + " in" : "it in") + ' as green?<div class="sh-gb"><button id="drLock">Lock in · green</button><button id="drKeep">Not yet</button></div></div>';
  }
  function renderDrill() {
    var TA = T(), app = TA.app;
    if (!D) { TA.go("study"); return; }
    var n = D.list.length, h = '<div class="screen drill-screen"><div class="ptop"><button class="xbtn" data-go="study" aria-label="Back">' + TA.icons.close + '</button><div class="pmid"><b>Drill · ' +
      esc(scopeName(D.scope)) + "</b><span>" + (D.i < n ? (D.i + 1) + " of " + n : "Done") + " · " + D.right + ' right</span></div></div><div class="pstrip"><div class="pbar"><i style="width:' + Math.round(100 * Math.min(D.i, n) / Math.max(1, n)) + '%"></i></div></div><div class="scroll narrow" id="drs">';
    if (D.i >= n) {
      h += '<div class="dr-end"><div class="big">' + D.right + "<small>of " + n + "</small></div><p>" + (D.locked ? D.locked + " locked in green this round." : "Keep drilling: twice right and it goes green.") +
        '</p><button class="btn" id="drAgain">Run it again</button><button class="btn ghost" data-go="study">Back to the Safehouse</button></div>';
    } else if (D.fmt === "q") {
      var p = /^m:(.+):(\d+)$/.exec(D.list[D.i]), id = p[1], i = +p[2], q = TA.P[id] && TA.P[id].questions[i], a = D.ans;
      if (!q) { D.i++; renderDrill(); return; }
      h += '<div class="qmeta"><span class="chip qn">' + esc(TA.title_of(id)) + " · Q" + (i + 1) + "</span></div><div class=\"qcard\">" + q.q + '</div><div class="opts' + (a ? " locked" : "") + '" id="dro">' +
        L4.filter(function (k) { return q.options[k] != null; }).map(function (k) {
          var cls = "opt has-tag" + (a ? (k === q.correct ? " right" : k === a ? " wrong" : " fade") : "");
          return '<button class="' + cls + '" data-k="' + k + '"><span class="k">' + k + '</span><span class="ot">' + q.options[k] + "</span>" + otag(id, i, k) + "</button>";
        }).join("") + "</div>" +
        (a ? '<div class="verdict ' + (a === q.correct ? "ok" : "bad") + '">' + (a === q.correct ? "✓ Cleared" : "✗ It's " + q.correct.toUpperCase()) + "</div>" + askHTML() + TA.explainHTML(id, q, i) +
          '<button class="btn" id="drNext" style="margin-top:16px">' + (D.i + 1 < n ? "Next" : "Finish") + "</button>" : "");
    } else {
      var x = SL.get(D.list[D.i]);
      if (!x) { D.i++; renderDrill(); return; }
      x = Object.assign({ id: D.list[D.i] }, x);
      var rf = refOf(x), ex = x.o ? explainOpt(x) : null;
      h += '<div class="qmeta"><span class="chip qn">' + esc(x.f) + '</span></div><div class="qcard fc">' +
        (x.o ? '<span class="fc-k">What is this, and why is it ' + (ex && ex.right ? "the right answer" : "a trap") + ' here?</span><b class="fc-t">' + esc(x.t) + '</b><span class="fc-c">in: ' + esc(strip(rf ? rf.q.q : x.q).slice(0, 200)) + "</span>"
          : rf ? '<span class="fc-k">Recall the answer and the concept</span>' + rf.q.q : '<span class="fc-k">Explain it to yourself</span><b class="fc-t">' + esc(x.t) + "</b>" + (x.q ? '<span class="fc-c">' + esc(x.q) + "</span>" : "")) + "</div>";
      if (!D.rev) h += '<button class="btn" id="drRev">Reveal</button>';
      else {
        if (x.o && rf) h += '<div class="exp"><div class="exp-answer"><span class="ak">' + rf.q.correct.toUpperCase() + '</span><span class="abody"><span class="alabel">Correct answer</span><span class="atext">' + rf.q.options[rf.q.correct] + "</span></span></div>" +
          (ex && ex.text ? '<div class="exp-sec"><div class="exp-h">' + (ex.right ? "The concept" : "Why " + esc(String(x.o).toUpperCase()) + " is a trap") + "</div><p>" + TA.boldFig(esc(ex.text)) + "</p></div>" : "") + "</div>";
        else if (rf) h += TA.explainHTML(rf.id, rf.q, rf.i);
        else h += '<div class="exp"><p>' + esc(x.m || "No explanation saved for this one. Open the notes.") + '</p><a class="bf-l" href="' + esc(SL.notesUrl(x)) + '" target="_blank" rel="noopener">📖 Notes</a></div>';
        if (x.m && rf) h += '<div class="db-my"><span>Your note</span>' + esc(x.m) + "</div>";
        h += D.ask.length ? askHTML() + '<button class="btn" id="drNext" style="margin-top:16px">' + (D.i + 1 < n ? "Next" : "Finish") + "</button>"
          : '<div class="dr-rate"><button data-rate="r">Clueless</button><button data-rate="a">Shaky</button><button data-rate="g">Knew it</button></div>';
      }
    }
    app.innerHTML = h + "</div></div>";
    wireDrill();
  }
  function wireDrill() {
    var TA = T(), app = TA.app;
    function next() { D.i++; D.ans = null; D.rev = false; D.ask = []; renderDrill(); app.querySelector("#drs").scrollTop = 0; }
    var again = app.querySelector("#drAgain"); if (again) again.onclick = function () { startDrill(D.scope, D.fmt); };
    app.querySelectorAll("#dro .opt").forEach(function (b) {
      b.onclick = function (e) {
        if (e.target.closest(".otag") || D.ans) return;
        var k = b.getAttribute("data-k"), p = /^m:(.+):(\d+)$/.exec(D.list[D.i]), q = TA.P[p[1]].questions[+p[2]], ids = linked(D.list[D.i]).map(function (y) { return y.id; });
        D.ans = k;
        if (k === q.correct) { D.right++; D.ask = clear(ids); TA.gain(5); TA.tone([660, 880]); TA.buzz([18]); var rc = b.getBoundingClientRect(); TA.fx.confetti(24, rc.left + rc.width / 2, rc.top + rc.height / 2); }
        else { miss(ids); TA.tone([300, 220]); TA.buzz([40, 60, 40]); }
        renderDrill();
      };
    });
    var rev = app.querySelector("#drRev"); if (rev) rev.onclick = function () { D.rev = true; renderDrill(); };
    app.querySelectorAll("[data-rate]").forEach(function (b) {
      b.onclick = function () {
        var r = b.getAttribute("data-rate"), id = D.list[D.i];
        if (r === "g") { D.right++; D.ask = clear([id]); TA.gain(5); TA.tone([660, 880]); if (D.ask.length) { renderDrill(); return; } }
        else if (r === "a") SL.update(id, { h: 1, d: 0 });
        else miss([id]);
        next();
      };
    });
    var lk = app.querySelector("#drLock");
    if (lk) lk.onclick = function () { D.ask.forEach(function (id) { setHeat(id, "g"); }); D.locked += D.ask.length; TA.toast("Locked in green"); TA.fx.confetti(60); D.ask = []; next(); };
    var kp = app.querySelector("#drKeep"); if (kp) kp.onclick = function () { D.ask = []; next(); };
    var nx = app.querySelector("#drNext"); if (nx) nx.onclick = next;
  }

  window.LEARN = {
    otag: otag, trapTag: trapTag, paint: paint, noteRow: noteRow, debriefBadge: debriefBadge, click: function (e) { return click(e) || safeClick(e); },
    safehouse: function () { cur = "study"; renderSafe(); }, brief: function () { cur = "brief"; renderBrief(); }, drill: function () { cur = "drill"; renderDrill(); },
    leave: function () { cur = null; }, qLoc: qLoc, locOf: locOf, secOf: secOf
  };
})();
