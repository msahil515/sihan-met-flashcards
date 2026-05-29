/* Notes for Exam — single-page library + reader ("The Reading Desk").
   No framework. Loads manifest.json, renders an editorial library home and a
   desk-framed book reader (per-note pages live in content/<slug>.html).
   On wide screens the reader flanks the page with live rails: a scroll-spy
   Contents rail (left) and a chapter-progress / up-next rail (right). */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var DATA = null;          // manifest.json
  var FLAT = [];            // ordered [{slug,title,short,blurb,section,sectionName,grad,minutes,words}]
  var BYSLUG = {};          // slug -> flat entry
  var SEARCH = null;        // lazy search index
  var FS_KEY = "nfe:fs", LAST_KEY = "nfe:last", SCROLL_KEY = "nfe:scroll";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fontSize() {
    var v = parseInt(localStorage.getItem(FS_KEY), 10);
    return (v >= 14 && v <= 26) ? v : 18;
  }

  /* ---------- load ---------- */
  fetch("manifest.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      DATA = d;
      d.shelves.forEach(function (sh) {
        sh.chapters.forEach(function (c) {
          var e = {
            slug: c.slug, title: c.title, short: c.short || c.title,
            blurb: c.blurb || "", minutes: c.minutes, words: c.words,
            section: sh.key, sectionName: sh.name, grad: sh.grad
          };
          FLAT.push(e); BYSLUG[c.slug] = e;
        });
      });
      route();
    })
    .catch(function () {
      app.innerHTML = '<div class="library"><p style="padding:40px">Could not load the library. Pull to refresh.</p></div>';
    });

  window.addEventListener("hashchange", route);

  function route() {
    if (!DATA) return;
    closeSearch();
    document.body.classList.remove("toc-open");
    var h = location.hash || "";
    var m = h.match(/^#\/read\/([a-z0-9\-.]+)/i);
    if (m && BYSLUG[m[1]]) { renderReader(m[1]); }
    else { renderLibrary(); }
  }

  function go(slug) { location.hash = "#/read/" + slug; }

  /* ---------- library ---------- */
  function renderLibrary() {
    document.body.classList.remove("reading");
    var last = localStorage.getItem(LAST_KEY);
    var lastE = last && BYSLUG[last];

    var html = "";
    html += '<div class="appbar"><span class="brand"><span class="mark">N</span> Notes for Exam</span>' +
      '<span class="spacer"></span>' +
      '<button class="iconbtn" id="topSearch" aria-label="Search">&#128269;</button></div>';
    html += '<div class="library">';

    // masthead (title page)
    html += '<div class="masthead">' +
      '<span class="eyebrow">A Study Library &middot; MET 2026 &amp; NIMHANS</span>' +
      '<h1>Notes for Exam</h1>' +
      '<p class="sub">Every cheatsheet, primer, debrief and deep-dive from your prep, merged so each concept lives in one clean entry. Detail kept, nothing cut. Read it like a book.</p>' +
      '<div class="rule"><span class="orn">&#10086;</span></div>' +
      '<div class="stats">' +
        '<span><b>' + DATA.chapters + '</b> Books</span>' +
        '<span><b>' + Math.round(DATA.words / 1000) + 'k</b> Words</span>' +
        '<span><b>' + DATA.shelves.length + '</b> Sections</span>' +
      '</div></div>';

    // search
    html += '<div class="searchbar" id="openSearch">' +
      '<span class="sicon">&#128269;</span>' +
      '<input type="search" placeholder="Search every book…" readonly>' +
      '<span class="hint">/</span></div>';

    // continue
    if (lastE) {
      html += '<div class="continue" data-go="' + esc(lastE.slug) + '">' +
        '<div class="cv" style="background:linear-gradient(135deg,' + lastE.grad[0] + ',' + lastE.grad[1] + ')"></div>' +
        '<div class="meta">' +
          '<div class="kicker">Continue reading</div>' +
          '<div class="ttl">' + esc(lastE.short) + '</div>' +
          '<div class="sub">' + esc(lastE.sectionName) + ' &middot; ' + lastE.minutes + ' min read</div>' +
        '</div>' +
        '<button class="go">Resume &#8594;</button></div>';
    }

    // shelves
    DATA.shelves.forEach(function (sh) {
      html += '<section class="shelf">' +
        '<div class="shelf-head"><h2>' + esc(sh.name) + '</h2>' +
        '<span class="st">' + esc(sh.subtitle) + '</span>' +
        '<span class="ct">' + sh.chapters.length + ' ' + (sh.chapters.length === 1 ? 'book' : 'books') + '</span></div>' +
        '<div class="shelf-rule"></div>' +
        '<div class="shelf-row">';
      sh.chapters.forEach(function (c) {
        html += '<a class="book" data-go="' + esc(c.slug) + '" href="#/read/' + esc(c.slug) + '" ' +
          'style="background:linear-gradient(150deg,' + sh.grad[0] + ',' + sh.grad[1] + ')">' +
          '<span class="b-kicker">' + esc(sh.name) + '</span>' +
          '<span class="b-rule"></span>' +
          '<span class="b-title">' + esc(c.short) + '</span>' +
          '<span class="b-blurb">' + esc(c.blurb) + '</span>' +
          '<span class="b-foot">' + c.minutes + ' min &middot; ' + Math.round(c.words / 100) / 10 + 'k words</span>' +
          '</a>';
      });
      html += '</div></section>';
    });

    html += '</div>';
    app.innerHTML = html;
    wireCommon();
    var os = document.getElementById("openSearch");
    if (os) os.addEventListener("click", openSearch);
    window.scrollTo(0, 0);
  }

  /* ---------- reader (the open book) ----------
     On landscape/wide screens the chapter is laid out as a true two-page
     spread: the in-frame article becomes a multi-column flow whose columns
     ARE the printed pages (two visible), and a page turn slides the flow by
     one spread. On narrow/portrait it falls back to a single page that
     scrolls. State below is shared with the keyboard handler. */
  var FRAME = null, RSLUG = null, PREV = null, NEXT = null, RIDX = 0;
  var PAGED = false, SPREAD_W = 0, NSPREADS = 1, CUR = 0;
  var SECS = [];                                   // [{id,label,el,spread}]
  var SPREAD_KEY = "nfe:spread";
  var PAGED_MQ = window.matchMedia("(min-width: 1000px)");
  var pendingOpenLast = false;                     // arrive at a chapter's last page
  var relayoutTimer = null;

  function renderReader(slug) {
    document.body.classList.add("reading");
    var e = BYSLUG[slug];
    RSLUG = slug; RIDX = FLAT.indexOf(e);
    PREV = FLAT[RIDX - 1]; NEXT = FLAT[RIDX + 1];
    SECS = []; PAGED = false; NSPREADS = 1; CUR = 0;
    localStorage.setItem(LAST_KEY, slug);

    var html = '<div class="reader">';

    // top bar
    html += '<div class="appbar">' +
      '<button class="backbtn" id="backBtn"><span>&#8592;</span> Library</button>' +
      '<button class="iconbtn tocbtn" id="tocBtn" aria-label="Contents">&#9776;</button>' +
      '<div class="crumb"><span class="sec">' + esc(e.sectionName) + '</span>' +
      '<span class="tt">' + esc(e.short) + '</span></div>' +
      '<span class="spacer"></span>' +
      '<div class="fontctl"><button id="fsDown" aria-label="Smaller text">A&#8722;</button>' +
      '<button id="fsUp" aria-label="Larger text">A&#43;</button></div>' +
      '<button class="iconbtn" id="readerSearch" aria-label="Search">&#128269;</button>' +
      '</div>';

    // the desk: a page-turn handle, the open book, a page-turn handle
    html += '<div class="desk">' +
      '<button class="turn turn-prev" id="turnPrev" aria-label="Previous page">&#8249;</button>' +
      '<div class="openbook" id="openbook">' +
        '<div class="leaf-hi"></div>' +
        '<iframe id="reader" title="' + esc(e.title) + '" src="content/' + esc(slug) + '.html"></iframe>' +
        '<div class="gutter-l"></div><div class="gutter-r"></div>' +
        '<div class="spine"></div>' +
      '</div>' +
      '<button class="turn turn-next" id="turnNext" aria-label="Next page">&#8250;</button>' +
      '</div>';

    // footer: chapter nav + page position + progress
    html += '<div class="readerfoot">' +
      '<button class="foot-nav" id="prevBtn" ' + (PREV ? '' : 'disabled') + '>&#8249; ' + (PREV ? esc(PREV.short) : 'Start') + '</button>' +
      '<div class="foot-mid">' +
        '<div class="pagelabel" id="pageLabel">&nbsp;</div>' +
        '<div class="progbar"><span id="progBar"></span></div>' +
        '<div class="booklabel">Book ' + (RIDX + 1) + ' of ' + FLAT.length + ' &middot; ' + esc(e.short) + '</div>' +
      '</div>' +
      '<button class="foot-nav" id="nextBtn" ' + (NEXT ? '' : 'disabled') + '>' + (NEXT ? esc(NEXT.short) : 'End') + ' &#8250;</button>' +
      '</div>';

    // contents drawer + scrim
    html += '<aside class="rail rail-left">' +
      '<div class="rail-h">Contents</div>' +
      '<ul class="toclist" id="tocList"><li><a style="opacity:.5">Loading…</a></li></ul>' +
      '</aside>';
    html += '<div class="tocscrim" id="tocScrim"></div>';
    html += '</div>'; // reader
    app.innerHTML = html;

    FRAME = document.getElementById("reader");
    FRAME.addEventListener("load", function () {
      applyFontSize(FRAME);
      buildContents(FRAME);
      wireFrameAnchors(FRAME);
      layoutReader();
    });

    document.getElementById("backBtn").addEventListener("click", function () { location.hash = ""; });
    document.getElementById("readerSearch").addEventListener("click", openSearch);
    document.getElementById("turnPrev").addEventListener("click", function () { turnPage(-1); });
    document.getElementById("turnNext").addEventListener("click", function () { turnPage(1); });
    if (PREV) document.getElementById("prevBtn").addEventListener("click", function () { go(PREV.slug); });
    if (NEXT) document.getElementById("nextBtn").addEventListener("click", function () { go(NEXT.slug); });
    document.getElementById("fsUp").addEventListener("click", function () { bumpFont(1); });
    document.getElementById("fsDown").addEventListener("click", function () { bumpFont(-1); });

    var tocBtn = document.getElementById("tocBtn");
    var tocScrim = document.getElementById("tocScrim");
    if (tocBtn) tocBtn.addEventListener("click", function () { document.body.classList.toggle("toc-open"); });
    if (tocScrim) tocScrim.addEventListener("click", function () { document.body.classList.remove("toc-open"); });

    wireCommon();
    window.scrollTo(0, 0);
  }

  /* decide + apply the layout mode for the current frame */
  function layoutReader() {
    var doc; try { doc = FRAME.contentDocument; } catch (e) { return; }
    if (!doc) return;
    if (PAGED_MQ.matches) paginate();
    else scrollSetup();
  }

  function clearPaged(doc) {
    try {
      doc.documentElement.classList.remove("nfe-paged");
      doc.body.classList.remove("nfe-paged");
      var a = doc.querySelector(".nfe-article");
      if (a) { a.classList.remove("nfe-paged-article"); a.style.transition = ""; a.style.removeProperty("--pg-x"); }
    } catch (e) {}
  }

  /* ----- paged (two-page spread) ----- */
  function paginate() {
    var doc, art; try { doc = FRAME.contentDocument; } catch (e) { return; }
    art = doc.querySelector(".nfe-article");
    if (!art) return;
    var W = FRAME.clientWidth, H = FRAME.clientHeight;
    if (W < 4 || H < 4) { return; }

    var gap = Math.round(Math.min(110, Math.max(58, W * 0.072)));   // the spine gutter
    var ph  = Math.round(Math.min(70,  Math.max(30, W * 0.038)));   // outer page margins
    var pv  = Math.round(Math.min(70,  Math.max(28, H * 0.072)));   // top/bottom margins

    var de = doc.documentElement;
    de.style.setProperty("--pg-gap", gap + "px");
    de.style.setProperty("--pg-ph", ph + "px");
    de.style.setProperty("--pg-pv", pv + "px");
    de.classList.add("nfe-paged");
    doc.body.classList.add("nfe-paged");
    art.classList.add("nfe-paged-article");

    // Some passthrough pages (the one-page cram reference) hide their bulk in
    // collapsible <details> accordions. A printed book has no folds, so open
    // them all and keep them open, then the whole text paginates linearly.
    var dets = doc.querySelectorAll("details");
    if (dets.length && !FRAME._accWired) {
      Array.prototype.forEach.call(dets, function (d) { d.open = true; });
      doc.addEventListener("toggle", function (e) {
        if (e.target && e.target.tagName === "DETAILS" && !e.target.open) {
          e.target.open = true; scheduleRemeasure();
        }
      }, true);
      FRAME._accWired = true;
    } else if (dets.length) {
      Array.prototype.forEach.call(dets, function (d) { d.open = true; });
    }

    art.style.transition = "none";
    art.style.setProperty("--pg-x", "0px");
    void art.offsetWidth;                          // force layout at offset 0

    SPREAD_W = W;
    measureSpreads();
    PAGED = true;

    var want = pendingOpenLast ? (NSPREADS - 1) : restoredSpread(RSLUG);
    pendingOpenLast = false;
    CUR = Math.min(NSPREADS - 1, Math.max(0, want));

    requestAnimationFrame(function () { try { art.style.transition = ""; } catch (e) {} });
    applySpread();
    // late layout (web fonts, term-popover) can shift boundaries; re-measure once
    scheduleRemeasure();
  }

  /* (re)compute spread count + each section's spread from current layout */
  function measureSpreads() {
    var doc, art; try { doc = FRAME.contentDocument; } catch (e) { return; }
    art = doc && doc.querySelector(".nfe-paged-article");
    if (!art || !SPREAD_W) return;
    // child rects and the article rect carry the same translateX, so the
    // offset cancels in (child.left - art.left); no need to un-translate.
    var base = art.getBoundingClientRect().left;
    var total = SPREAD_W;
    var kids = art.children;
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect();
      var right = (r.left - base) + r.width;
      if (right > total) total = right;
    }
    NSPREADS = Math.max(1, Math.ceil((total - 2) / SPREAD_W));
    SECS.forEach(function (s) {
      if (s.el) {
        var x = s.el.getBoundingClientRect().left - base;
        s.spread = Math.min(NSPREADS - 1, Math.max(0, Math.floor((x + 2) / SPREAD_W)));
      } else s.spread = 0;
    });
  }

  function scheduleRemeasure() {
    clearTimeout(FRAME && FRAME._remTimer);
    if (!FRAME) return;
    FRAME._remTimer = setTimeout(function () {
      if (!PAGED) return;
      var beforeN = NSPREADS;
      measureSpreads();
      CUR = Math.min(NSPREADS - 1, Math.max(0, CUR));
      if (NSPREADS !== beforeN) applySpread(); else { setTurnState(); spyActive(CUR); }
    }, 420);
  }

  function applySpread() {
    var doc, art; try { doc = FRAME.contentDocument; } catch (e) { return; }
    art = doc && doc.querySelector(".nfe-paged-article");
    if (art) art.style.setProperty("--pg-x", (CUR * SPREAD_W) + "px");

    var leftPg = CUR * 2 + 1, total = NSPREADS * 2;
    var lab = document.getElementById("pageLabel");
    if (lab) lab.textContent = NSPREADS > 1
      ? "Pages " + leftPg + "–" + (leftPg + 1) + " of " + total
      : " ";
    setProgress((CUR + 1) / NSPREADS);
    setTurnState();
    spyActive(CUR);
    persistSpread();
  }

  function turnPage(dir) {
    if (!PAGED) return;
    if (dir > 0) {
      if (CUR < NSPREADS - 1) { CUR++; applySpread(); }
      else if (NEXT) { go(NEXT.slug); }
    } else {
      if (CUR > 0) { CUR--; applySpread(); }
      else if (PREV) { pendingOpenLast = true; go(PREV.slug); }
    }
  }

  function goToSpread(i) {
    if (!PAGED) return;
    CUR = Math.min(NSPREADS - 1, Math.max(0, i));
    applySpread();
  }

  function setTurnState() {
    var p = document.getElementById("turnPrev"), n = document.getElementById("turnNext");
    if (p) p.disabled = (CUR === 0 && !PREV);
    if (n) n.disabled = (CUR >= NSPREADS - 1 && !NEXT);
  }

  function setProgress(frac) {
    var bar = document.getElementById("progBar");
    if (bar) bar.style.width = Math.round(Math.min(1, Math.max(0, frac)) * 100) + "%";
  }

  /* ----- scroll (single page, narrow) ----- */
  function scrollSetup() {
    var win, doc; try { win = FRAME.contentWindow; doc = FRAME.contentDocument; } catch (e) { return; }
    clearPaged(doc);
    PAGED = false;
    var lab = document.getElementById("pageLabel");
    if (lab) lab.textContent = " ";

    try {
      var sc = JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}");
      if (sc[RSLUG]) win.scrollTo(0, sc[RSLUG]);
    } catch (e2) {}

    var ticking = false;
    function update() {
      ticking = false;
      var de = doc.documentElement, b = doc.body;
      var sh = Math.max(de.scrollHeight, b.scrollHeight);
      var ch = win.innerHeight || de.clientHeight;
      var st = win.scrollY || de.scrollTop || 0;
      var frac = sh > ch ? Math.min(1, Math.max(0, st / (sh - ch))) : 1;
      setProgress(frac);
      var lab2 = document.getElementById("pageLabel");
      if (lab2) lab2.textContent = Math.round(frac * 100) + "% read";
      try {
        var s = JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}");
        s[RSLUG] = st; localStorage.setItem(SCROLL_KEY, JSON.stringify(s));
      } catch (e3) {}
      // scroll-spy
      if (SECS.length) {
        var line = st + 130, activeId = SECS[0].id;
        for (var i = 0; i < SECS.length; i++) {
          var el = SECS[i].el; if (!el) continue;
          var top = el.getBoundingClientRect().top + st;
          if (top <= line) activeId = SECS[i].id; else break;
        }
        spyActiveId(activeId);
      }
    }
    function onScroll() { if (!ticking) { ticking = true; (win.requestAnimationFrame || setTimeout)(update); } }
    try { win.addEventListener("scroll", onScroll, { passive: true }); } catch (e4) {}
    update();
  }

  /* ----- live contents (built once per chapter) ----- */
  function buildContents(frame) {
    SECS = [];
    var list = document.getElementById("tocList");
    if (!list) return;
    var doc; try { doc = frame.contentDocument; } catch (err) { doc = null; }
    if (!doc) { list.innerHTML = ""; return; }

    var items = [];
    var tocLinks = doc.querySelectorAll(".booktoc a[href^='#']");
    if (tocLinks.length) {
      Array.prototype.forEach.call(tocLinks, function (a) {
        var id = (a.getAttribute("href") || "").slice(1);
        if (id && doc.getElementById(id)) items.push({ id: id, label: a.textContent.trim() });
      });
    }
    if (!items.length) {
      // prose pages expose <h2>; accordion cram pages expose <summary>
      var seen = {};
      Array.prototype.forEach.call(doc.querySelectorAll("h2, details.acc > summary"), function (h, i) {
        if (!h.id) h.id = "nfe-sec-" + i;
        var label = h.textContent.trim();
        if (label && !seen[label]) { seen[label] = 1; items.push({ id: h.id, label: label }); }
      });
    }
    if (!items.length) { list.innerHTML = '<li><a style="opacity:.45">No sections</a></li>'; return; }

    var html = "";
    items.forEach(function (it) {
      html += '<li><a data-sec="' + esc(it.id) + '">' + esc(it.label) + '</a></li>';
      SECS.push({ id: it.id, label: it.label, el: doc.getElementById(it.id), spread: 0 });
    });
    list.innerHTML = html;
    Array.prototype.forEach.call(list.querySelectorAll("a[data-sec]"), function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        jumpTo(a.getAttribute("data-sec"));
        document.body.classList.remove("toc-open");
      });
    });
  }

  function jumpTo(id) {
    var sec = null;
    for (var i = 0; i < SECS.length; i++) if (SECS[i].id === id) { sec = SECS[i]; break; }
    if (!sec) return;
    if (PAGED) { goToSpread(sec.spread); return; }
    try {
      var win = FRAME.contentWindow, doc = FRAME.contentDocument;
      var el = doc.getElementById(id);
      if (!el) return;
      var y = el.getBoundingClientRect().top + win.scrollY - 14;
      win.scrollTo({ top: y, behavior: "smooth" });
    } catch (err) {}
  }

  function spyActive(spread) {
    var activeId = SECS.length ? SECS[0].id : null;
    for (var i = 0; i < SECS.length; i++) { if (SECS[i].spread <= spread) activeId = SECS[i].id; else break; }
    spyActiveId(activeId);
  }
  function spyActiveId(activeId) {
    var list = document.getElementById("tocList"); if (!list) return;
    var links = list.querySelectorAll("a[data-sec]"), cur = null;
    Array.prototype.forEach.call(links, function (a) {
      var on = a.getAttribute("data-sec") === activeId;
      a.classList.toggle("active", on);
      if (on) cur = a;
    });
    if (cur && !document.body.classList.contains("toc-open")) {
      var r = cur.getBoundingClientRect(), pr = list.getBoundingClientRect();
      if (r.top < pr.top || r.bottom > pr.bottom) cur.scrollIntoView({ block: "nearest" });
    }
  }

  /* in-frame anchors (booktoc / cross-links) jump within the spread */
  function wireFrameAnchors(frame) {
    var doc; try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc) return;
    doc.addEventListener("click", function (ev) {
      var a = ev.target;
      while (a && a.tagName !== "A") a = a.parentNode;
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (href.charAt(0) !== "#" || href.length < 2) return;
      ev.preventDefault();
      jumpTo(href.slice(1));
    }, true);
  }

  /* per-chapter spread memory */
  function persistSpread() {
    try {
      var sp = JSON.parse(localStorage.getItem(SPREAD_KEY) || "{}");
      sp[RSLUG] = CUR; localStorage.setItem(SPREAD_KEY, JSON.stringify(sp));
    } catch (e) {}
  }
  function restoredSpread(slug) {
    try { var sp = JSON.parse(localStorage.getItem(SPREAD_KEY) || "{}"); return sp[slug] || 0; }
    catch (e) { return 0; }
  }

  function applyFontSize(frame) {
    try {
      var doc = frame.contentDocument;
      if (doc && doc.documentElement) doc.documentElement.style.setProperty("--nfe-fs", fontSize() + "px");
    } catch (e) {}
  }
  function bumpFont(dir) {
    var v = Math.max(14, Math.min(26, fontSize() + dir * 2));
    localStorage.setItem(FS_KEY, v);
    applyFontSize(FRAME);
    // re-flow: font change moves every page boundary
    var doc; try { doc = FRAME.contentDocument; } catch (e) { return; }
    if (doc) { clearPaged(doc); layoutReader(); }
  }

  /* re-paginate on resize / orientation change (debounced) */
  window.addEventListener("resize", function () {
    if (!document.body.classList.contains("reading") || !FRAME) return;
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(function () {
      var doc; try { doc = FRAME.contentDocument; } catch (e) { return; }
      if (!doc) return;
      clearPaged(doc);
      layoutReader();
    }, 180);
  });

  /* ---------- search ---------- */
  var pane = document.getElementById("searchPane");
  var input = document.getElementById("searchInput");
  var results = document.getElementById("searchResults");
  document.getElementById("searchClose").addEventListener("click", closeSearch);
  pane.addEventListener("click", function (e) { if (e.target === pane) closeSearch(); });
  input.addEventListener("input", function () { runSearch(input.value); });

  function openSearch() {
    pane.classList.add("open");
    input.value = "";
    results.innerHTML = '<div class="searchempty">Type to search ' + (DATA ? DATA.chapters : "") + ' books.</div>';
    setTimeout(function () { input.focus(); }, 30);
    if (!SEARCH) {
      fetch("search-index.json", { cache: "no-cache" })
        .then(function (r) { return r.json(); })
        .then(function (d) { SEARCH = d; if (input.value) runSearch(input.value); });
    }
  }
  function closeSearch() { pane.classList.remove("open"); }

  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { results.innerHTML = '<div class="searchempty">Type to search.</div>'; return; }
    if (!SEARCH) { results.innerHTML = '<div class="searchempty">Loading index…</div>'; return; }
    var terms = q.split(/\s+/);
    var hits = [];
    SEARCH.forEach(function (it) {
      var hay = (it.title + " " + it.text).toLowerCase();
      var score = 0, ok = true;
      terms.forEach(function (t) {
        var ti = it.title.toLowerCase().indexOf(t);
        var bi = hay.indexOf(t);
        if (bi === -1) ok = false;
        if (ti !== -1) score += 10;
        if (bi !== -1) score += 1;
      });
      if (ok) hits.push({ it: it, score: score, pos: hay.indexOf(terms[0]) });
    });
    if (!hits.length) { results.innerHTML = '<div class="searchempty">No matches for &ldquo;' + esc(q) + '&rdquo;.</div>'; return; }
    hits.sort(function (a, b) { return b.score - a.score; });
    var sm = {}; FLAT.forEach(function (e) { sm[e.slug] = e.sectionName; });
    var html = "";
    hits.slice(0, 40).forEach(function (h) {
      html += '<a class="sres" data-go="' + esc(h.it.slug) + '" href="#/read/' + esc(h.it.slug) + '">' +
        '<div class="sec">' + esc(sm[h.it.slug] || "") + '</div>' +
        '<div class="tt">' + esc(BYSLUG[h.it.slug] ? BYSLUG[h.it.slug].short : h.it.title) + '</div>' +
        '<div class="snip">' + snippet(h.it.text, terms[0]) + '</div></a>';
    });
    results.innerHTML = html;
    Array.prototype.forEach.call(results.querySelectorAll(".sres"), function (a) {
      a.addEventListener("click", function (ev) { ev.preventDefault(); closeSearch(); go(a.getAttribute("data-go")); });
    });
  }
  function snippet(text, term) {
    var i = text.toLowerCase().indexOf(term);
    if (i === -1) return esc(text.slice(0, 150)) + "…";
    var s = Math.max(0, i - 60), e = Math.min(text.length, i + 90);
    var out = (s > 0 ? "…" : "") + text.slice(s, e) + (e < text.length ? "…" : "");
    return esc(out).replace(new RegExp(esc(term), "ig"), function (m) { return "<mark>" + m + "</mark>"; });
  }

  /* ---------- shared wiring ---------- */
  function wireCommon() {
    var ts = document.getElementById("topSearch");
    if (ts) ts.addEventListener("click", openSearch);
    Array.prototype.forEach.call(document.querySelectorAll("[data-go]"), function (el) {
      el.addEventListener("click", function (ev) {
        if (el.tagName === "A") ev.preventDefault();
        go(el.getAttribute("data-go"));
      });
    });
  }

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", function (e) {
    if (pane.classList.contains("open")) { if (e.key === "Escape") closeSearch(); return; }
    if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); openSearch(); return; }
    var m = (location.hash || "").match(/^#\/read\/([a-z0-9\-.]+)/i);
    if (m && BYSLUG[m[1]]) {
      var idx = FLAT.indexOf(BYSLUG[m[1]]);
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        // turn a page in the spread; falls through to the next chapter at the end
        if (PAGED) { e.preventDefault(); turnPage(1); }
        else if (FLAT[idx + 1]) go(FLAT[idx + 1].slug);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        if (PAGED) { e.preventDefault(); turnPage(-1); }
        else if (FLAT[idx - 1]) go(FLAT[idx - 1].slug);
      } else if (e.key === "Home" && PAGED) { e.preventDefault(); goToSpread(0); }
      else if (e.key === "End" && PAGED) { e.preventDefault(); goToSpread(NSPREADS - 1); }
      else if (e.key === "Escape") { if (document.body.classList.contains("toc-open")) document.body.classList.remove("toc-open"); else location.hash = ""; }
    }
  });
})();
