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
  postSyncToast();

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
      '<button class="iconbtn" id="topSearch" aria-label="Search">&#128269;</button>' +
      '<button class="iconbtn syncbtn" id="libSync" aria-label="Hard refresh to latest version" title="Hard refresh to latest">&#8635;</button></div>';
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
    var ls = document.getElementById("libSync");
    if (ls) ls.addEventListener("click", forceSync);
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
  // Columns visible per turn: 2 = a landscape two-page spread, 1 = a portrait
  // single page you flip like a real book. Set by paginate() from the viewport;
  // every page-count / section-map / label calc below reads it so the same code
  // path drives both. (CUR counts spreads; one spread = NCOLS columns.)
  var NCOLS = 2;
  // SPREAD_W is the visible frame width (what one spread occupies on screen).
  // SPREAD_PITCH is how far the column flow actually advances per spread:
  // 2 columns = 2*(colWidth + gap) = W - 2*ph + gap, NOT W. Translating by W
  // accumulates (gap - 2*ph) of drift per spread, so deep pages slide out of
  // the margins. PAD_H/COL_PITCH carry the geometry so the page count and the
  // section->spread map use the same true pitch. See paginate().
  var SPREAD_PITCH = 0, COL_PITCH = 0, PAD_H = 0;
  var SECS = [];                                   // [{id,label,el,spread}]
  var SPREAD_KEY = "nfe:spread";
  // How many printed pages to show, by viewport:
  //   2 → wide landscape: the two-page spread.
  //   1 → portrait (incl. a 1024px iPad held upright) or a narrow landscape:
  //       ONE page, turned like a book. This is the portrait single-page mode —
  //       before, a portrait tablet ≥1000px wrongly got a cramped 2-up spread,
  //       and a smaller portrait tablet fell all the way back to scrolling.
  //   0 → phone: continuous scroll (paging one tiny column reads worse).
  function colsForViewport() {
    var portrait = window.matchMedia("(orientation: portrait)").matches;
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    if (!portrait && w >= 1000) return 2;
    if (w >= 680) return 1;
    return 0;
  }
  var pendingOpenLast = false;                     // arrive at a chapter's last page
  var relayoutTimer = null;

  function renderReader(slug) {
    document.body.classList.add("reading");
    var e = BYSLUG[slug];
    RSLUG = slug; RIDX = FLAT.indexOf(e);
    PREV = FLAT[RIDX - 1]; NEXT = FLAT[RIDX + 1];
    SECS = []; PAGED = false; NSPREADS = 1; CUR = 0;
    SPREAD_PITCH = 0; COL_PITCH = 0; PAD_H = 0;
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
      '<button class="iconbtn syncbtn" id="reaSync" aria-label="Hard refresh to latest version" title="Hard refresh to latest">&#8635;</button>' +
      '</div>';

    // the desk holds the open book; pages turn by swipe or an edge tap (no
    // dedicated turn button — you flip it like a real book). See wireGestures.
    html += '<div class="desk" id="desk">' +
      '<div class="openbook" id="openbook">' +
        '<div class="leaf-hi"></div>' +
        '<iframe id="reader" title="' + esc(e.title) + '" src="content/' + esc(slug) + '.html"></iframe>' +
        '<div class="gutter-l"></div><div class="gutter-r"></div>' +
        '<div class="spine"></div>' +
        '<div class="pageturn-hint" id="turnHint">Swipe, or tap a page edge, to turn &#8594;</div>' +
      '</div>' +
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
      wireGestures(FRAME);
      layoutReader();
      maybeShowTurnHint();
    });

    document.getElementById("backBtn").addEventListener("click", function () { location.hash = ""; });
    document.getElementById("readerSearch").addEventListener("click", openSearch);
    document.getElementById("reaSync").addEventListener("click", forceSync);
    // page turns: swipe or tap the page edge (handled in wireGestures); turns
    // also work outside the iframe by swiping/tapping the desk margins.
    wireDeskGestures(document.getElementById("desk"));
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
    var cols = colsForViewport();
    if (cols >= 1) paginate(cols);
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

  /* ----- paged (book pages: 2-up spread or 1-up single page) ----- */
  function paginate(cols) {
    var doc, art; try { doc = FRAME.contentDocument; } catch (e) { return; }
    art = doc.querySelector(".nfe-article");
    if (!art) return;
    var W = FRAME.clientWidth, H = FRAME.clientHeight;
    if (W < 4 || H < 4) { return; }
    NCOLS = (cols === 1) ? 1 : 2;
    document.body.classList.toggle("reading-1up", NCOLS === 1);
    document.body.classList.toggle("reading-2up", NCOLS === 2);

    // 2-up: a wide spine gutter splits the two pages. 1-up: there is no spine,
    // so the "gap" is just the slack between consecutive flipped pages — keep it
    // tight, and give the single page a roomier outer margin (it's the whole
    // reading measure now, not half a spread).
    var gap, ph;
    if (NCOLS === 1) {
      ph  = Math.round(Math.min(96, Math.max(34, W * 0.085)));
      // In 1-up the single page fills the whole measure (colW = cw - 2*ph), so
      // the NEXT page starts at ph + colW + gap = cw - ph + gap. For it to sit
      // fully off the right edge (no sliver of the incoming page bleeding into
      // the outer margin) the gap must be at least the outer margin ph; pad it a
      // touch past that. It's dead space you only see mid-slide, so a wide gap
      // costs nothing but a cleaner turn.
      gap = ph + 12;
    } else {
      gap = Math.round(Math.min(110, Math.max(58, W * 0.072)));   // the spine gutter
      ph  = Math.round(Math.min(70,  Math.max(30, W * 0.038)));   // outer page margins
    }
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
    // True column geometry of the .nfe-paged-article: box-sizing:border-box,
    // horizontal padding ph each side, column-gap = gap, and NCOLS page-columns
    // sitting across the frame. The browser sizes columns from the article's
    // REAL content box, i.e. (art.clientWidth - 2*ph), which can differ from the
    // frame width W by a pixel (sub-pixel rounding / borders). Deriving the
    // pitch from clientWidth is exactly what CSS does, so
    //   colWidth   = (clientWidth - 2*ph - (NCOLS-1)*gap) / NCOLS
    //   COL_PITCH  = colWidth + gap              (exact per-column advance)
    //   SPREAD_PITCH = NCOLS * COL_PITCH         (advance per turn)
    // comes out an exact multiple per page of columns -> paging by it lands
    // every page on the same margins with ZERO accumulated drift. Using W
    // instead leaves ~1px error per column that compounds and slides deep pages
    // out of the margins (the offset bug this fixes). We also feed colWidth back
    // as --pg-colw so CSS lays out exactly NCOLS columns across the frame.
    PAD_H = ph;
    var cw0 = art.clientWidth || W;
    var colW = (cw0 - 2 * ph - (NCOLS - 1) * gap) / NCOLS;
    de.style.setProperty("--pg-colw", colW + "px");
    void art.offsetWidth;                              // ensure paged layout settled
    var cw = art.clientWidth || W;
    colW = (cw - 2 * ph - (NCOLS - 1) * gap) / NCOLS;
    de.style.setProperty("--pg-colw", colW + "px");
    COL_PITCH = colW + gap;          // exact per-column advance
    SPREAD_PITCH = NCOLS * COL_PITCH;
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
    if (!art || !SPREAD_W || !COL_PITCH) return;
    // child rects and the article rect carry the same translateX, so the
    // offset cancels in (child.left - art.left); no need to un-translate.
    // Columns sit at x = PAD_H + col*COL_PITCH (relative to the article's
    // border-box left), so page count and section->spread use COL_PITCH, the
    // true flow advance, not the on-screen frame width.
    var base = art.getBoundingClientRect().left;
    var total = SPREAD_W;
    var kids = art.children;
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect();
      var right = (r.left - base) + r.width;
      if (right > total) total = right;
    }
    // rightmost content pixel = PAD_H + (ncols-1)*COL_PITCH + colWidth, and
    // colWidth < COL_PITCH, so ceil((total - PAD_H)/COL_PITCH) recovers ncols.
    var ncols = Math.max(1, Math.ceil((total - PAD_H - 1) / COL_PITCH));
    NSPREADS = Math.max(1, Math.ceil(ncols / NCOLS));
    SECS.forEach(function (s) {
      if (s.el) {
        var x = s.el.getBoundingClientRect().left - base;     // ~ PAD_H + col*COL_PITCH
        var col = Math.max(0, Math.floor((x - PAD_H + 2) / COL_PITCH));
        s.spread = Math.min(NSPREADS - 1, Math.floor(col / NCOLS));
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
    // advance by the true per-spread pitch (W - 2*ph + gap), not the frame
    // width, so the columns stay inside the margins on every spread, not just
    // the first few. Fall back to SPREAD_W only if geometry isn't measured yet.
    var step = SPREAD_PITCH || SPREAD_W;
    if (art) art.style.setProperty("--pg-x", (CUR * step) + "px");

    var leftPg = CUR * NCOLS + 1, total = NSPREADS * NCOLS;
    var lab = document.getElementById("pageLabel");
    if (lab && NCOLS === 1) lab.textContent = NSPREADS > 1
      ? "Page " + leftPg + " of " + total
      : " ";
    else if (lab) lab.textContent = NSPREADS > 1
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
    document.body.classList.remove("reading-1up", "reading-2up");
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

  /* ---------- page-turn gestures (swipe + edge tap, no button) ----------
     Sihan reads on a tablet and wanted to flip pages like a real book: swipe
     across, or tap a page edge, instead of pressing a dedicated turn button.
     Gestures only fire in PAGED (two-page spread) mode; in scroll mode a
     vertical drag is the native scroll. Handlers sit on the iframe document
     (the reading surface) and on the desk (the margins around the book). */
  var _lastGestureTurn = 0;
  function nowMs() { return Date.now(); }

  function isInteractive(node) {
    while (node && node.nodeType === 1) {
      var t = node.tagName;
      if (t === "A" || t === "BUTTON" || t === "INPUT" || t === "SELECT" ||
          t === "TEXTAREA" || t === "SUMMARY" || t === "LABEL") return true;
      if (node.getAttribute && node.getAttribute("role")) return true;
      node = node.parentNode;
    }
    return false;
  }
  function hasSelection(win) {
    try {
      var s = win && win.getSelection && win.getSelection();
      return !!(s && String(s).length > 0 && !s.isCollapsed);
    } catch (e) { return false; }
  }
  function gestureTurn(dir) { _lastGestureTurn = nowMs(); turnPage(dir); }

  function attachGestures(target, win, fracFn) {
    var sx = 0, sy = 0, st = 0, moved = false, tracking = false;
    var SWIPE = 42, TAP_MOVE = 12, TAP_MS = 450, EDGE = 0.32;
    target.addEventListener("touchstart", function (ev) {
      if (!ev.touches || ev.touches.length !== 1) { tracking = false; return; }
      var t = ev.touches[0]; sx = t.clientX; sy = t.clientY; st = nowMs();
      moved = false; tracking = true;
    }, { passive: true });
    target.addEventListener("touchmove", function (ev) {
      if (!tracking || !ev.touches || !ev.touches.length) return;
      var t = ev.touches[0];
      if (Math.abs(t.clientX - sx) > TAP_MOVE || Math.abs(t.clientY - sy) > TAP_MOVE) moved = true;
    }, { passive: true });
    target.addEventListener("touchend", function (ev) {
      if (!tracking) return; tracking = false;
      if (!PAGED) return;
      var t = ev.changedTouches && ev.changedTouches[0]; if (!t) return;
      var dx = t.clientX - sx, dy = t.clientY - sy, dt = nowMs() - st;
      if (hasSelection(win)) return;
      if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.3) {
        gestureTurn(dx < 0 ? 1 : -1); dismissTurnHint(); return;   // swipe left = next
      }
      if (!moved && Math.abs(dx) < TAP_MOVE && Math.abs(dy) < TAP_MOVE && dt < TAP_MS) {
        if (isInteractive(t.target)) return;
        var f = fracFn(t.clientX);
        if (f < EDGE) { gestureTurn(-1); dismissTurnHint(); }
        else if (f > 1 - EDGE) { gestureTurn(1); dismissTurnHint(); }
      }
    }, { passive: true });
    // desktop mouse: tap a page edge to turn; suppressed for ~600ms after a
    // touch so the synthetic click doesn't double-fire the turn.
    target.addEventListener("click", function (ev) {
      if (!PAGED) return;
      if (nowMs() - _lastGestureTurn < 600) return;
      if (ev.pointerType === "touch") return;
      if (hasSelection(win) || isInteractive(ev.target)) return;
      var f = fracFn(ev.clientX);
      if (f < EDGE) { gestureTurn(-1); dismissTurnHint(); }
      else if (f > 1 - EDGE) { gestureTurn(1); dismissTurnHint(); }
    });
  }

  function wireGestures(frame) {
    var doc, win;
    try { doc = frame.contentDocument; win = frame.contentWindow; } catch (e) { return; }
    if (!doc) return;
    // clientX inside the iframe is already in the frame's own coordinate space
    attachGestures(doc, win, function (clientX) { return clientX / (frame.clientWidth || 1); });
  }
  function wireDeskGestures(desk) {
    if (!desk) return;
    attachGestures(desk, window, function (clientX) {
      var r = desk.getBoundingClientRect();
      return (clientX - r.left) / (r.width || 1);
    });
  }

  function maybeShowTurnHint() {
    try {
      if (!PAGED) return;
      if (localStorage.getItem("nfe:turnhint")) return;
      var h = document.getElementById("turnHint");
      if (!h) return;
      setTimeout(function () { if (PAGED) h.classList.add("show"); }, 650);
      setTimeout(dismissTurnHint, 5200);
    } catch (e) {}
  }
  function dismissTurnHint() {
    var h = document.getElementById("turnHint");
    if (h) h.classList.remove("show");
    try { localStorage.setItem("nfe:turnhint", "1"); } catch (e) {}
  }

  /* ---------- hard refresh (force-sync to the latest deploy) ----------
     The installed PWA is cache-first, so a stuck copy can stay on an old
     build. The ↻ in the app bar unregisters the service worker, drops every
     cache, and reloads with a cache-buster — the manual escape hatch Sihan
     asked for. The SW also self-updates on each deploy (stamped CACHE). */
  var _toastTimer = null;
  function toast(msg, ms) {
    var t = document.getElementById("nfeToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "nfeToast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.innerHTML = msg;
    t.classList.add("show");
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () { t.classList.remove("show"); }, ms || 3200);
  }

  var _syncing = false;
  function forceSync() {
    if (_syncing) return; _syncing = true;
    Array.prototype.forEach.call(document.querySelectorAll(".syncbtn"), function (b) { b.classList.add("spin"); });
    toast("Syncing to the latest version&hellip;", 8000);
    var jobs = [];
    if ("serviceWorker" in navigator) {
      jobs.push(navigator.serviceWorker.getRegistrations()
        .then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); })
        .catch(function () {}));
    }
    if (window.caches && caches.keys) {
      jobs.push(caches.keys()
        .then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })
        .catch(function () {}));
    }
    try { sessionStorage.setItem("nfe:synced", "1"); } catch (e) {}
    Promise.all(jobs).then(function () {
      location.replace(location.pathname + "?s=" + Date.now() + location.hash);
    });
  }
  function postSyncToast() {
    try {
      if (sessionStorage.getItem("nfe:synced")) {
        sessionStorage.removeItem("nfe:synced");
        setTimeout(function () { toast("Synced to the latest version"); }, 300);
        if (location.search.indexOf("s=") !== -1) {
          try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
        }
      }
    } catch (e) {}
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
