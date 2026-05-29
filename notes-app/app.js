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
  var RING_C = 2 * Math.PI * 20;   // progress-ring circumference (r=20)

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

  /* ---------- reader ---------- */
  function renderReader(slug) {
    document.body.classList.add("reading");
    var e = BYSLUG[slug];
    var idx = FLAT.indexOf(e);
    var prev = FLAT[idx - 1], next = FLAT[idx + 1];
    localStorage.setItem(LAST_KEY, slug);

    // "More in this section"
    var fam = FLAT.filter(function (f) { return f.section === e.section; });

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

    // desk: [contents rail] [stage] [meta rail]
    html += '<div class="deskwrap">';

    // left rail — live contents (filled after iframe loads)
    html += '<aside class="rail rail-left">' +
      '<div class="rail-h">Contents</div>' +
      '<ul class="toclist" id="tocList"><li><a style="opacity:.5">Loading…</a></li></ul>' +
      '</aside>';

    // centre stage
    html += '<div class="stage"><div class="sheet">' +
      '<iframe id="reader" title="' + esc(e.title) + '" src="content/' + esc(slug) + '.html"></iframe>' +
      '</div></div>';

    // right rail — progress + up next + more in section
    html += '<aside class="rail rail-right">' +
      '<div class="rail-h">Your place</div>' +
      '<div class="progwrap">' +
        '<svg class="progring" width="48" height="48" viewBox="0 0 48 48">' +
          '<circle class="track" cx="24" cy="24" r="20"></circle>' +
          '<circle class="fill" id="progFill" cx="24" cy="24" r="20" ' +
            'stroke-dasharray="' + RING_C.toFixed(1) + '" stroke-dashoffset="' + RING_C.toFixed(1) + '"></circle>' +
          '<text class="pct" id="progPct" x="24" y="28" text-anchor="middle">0%</text>' +
        '</svg>' +
        '<div class="progmeta"><div class="ch">Book ' + (idx + 1) + ' of ' + FLAT.length + '</div>' +
        '<div class="nm">' + esc(e.short) + '</div></div>' +
      '</div>' +
      '<div class="upnext">' +
        navCard("Previous", prev) +
        navCard("Up next", next) +
      '</div>' +
      '<div class="morein"><div class="rail-h">More in ' + esc(e.sectionName) + '</div>' +
        fam.map(function (f) {
          return '<a class="moreitem' + (f.slug === slug ? ' cur' : '') + '" data-go="' + esc(f.slug) + '" href="#/read/' + esc(f.slug) + '">' +
            '<span class="sp" style="background:linear-gradient(180deg,' + f.grad[0] + ',' + f.grad[1] + ')"></span>' +
            '<span>' + esc(f.short) + '</span></a>';
        }).join("") +
      '</div>' +
      '</aside>';

    html += '</div>'; // deskwrap

    // bottom nav (narrow only) + scrim for contents drawer
    html += '<div class="readernav">' +
      '<button id="prevBtn" ' + (prev ? '' : 'disabled') + '><span>&#8592;</span><span class="lbl">' + (prev ? esc(prev.short) : 'Start') + '</span></button>' +
      '<span class="pos">' + (idx + 1) + ' / ' + FLAT.length + '</span>' +
      '<button id="nextBtn" ' + (next ? '' : 'disabled') + '><span class="lbl">' + (next ? esc(next.short) : 'End') + '</span><span>&#8594;</span></button>' +
      '</div>';
    html += '<div class="tocscrim" id="tocScrim"></div>';
    html += '</div>'; // reader
    app.innerHTML = html;

    var frame = document.getElementById("reader");
    frame.addEventListener("load", function () {
      applyFontSize(frame);
      buildContents(frame, slug);
      restoreScroll(frame, slug);
      wireScrollTracking(frame, slug);
    });

    document.getElementById("backBtn").addEventListener("click", function () { location.hash = ""; });
    document.getElementById("readerSearch").addEventListener("click", openSearch);
    if (prev) document.getElementById("prevBtn").addEventListener("click", function () { go(prev.slug); });
    if (next) document.getElementById("nextBtn").addEventListener("click", function () { go(next.slug); });
    document.getElementById("fsUp").addEventListener("click", function () { bumpFont(1, frame); });
    document.getElementById("fsDown").addEventListener("click", function () { bumpFont(-1, frame); });

    // contents drawer (narrow)
    var tocBtn = document.getElementById("tocBtn");
    var tocScrim = document.getElementById("tocScrim");
    if (tocBtn) tocBtn.addEventListener("click", function () { document.body.classList.toggle("toc-open"); });
    if (tocScrim) tocScrim.addEventListener("click", function () { document.body.classList.remove("toc-open"); });

    wireCommon();   // wires [data-go] incl. the rail nav cards + more-in items
    window.scrollTo(0, 0);
  }

  function navCard(dir, e) {
    if (!e) return '<div class="navcard disabled"><div class="dir">' + dir + '</div><div class="ttl">—</div></div>';
    return '<a class="navcard" data-go="' + esc(e.slug) + '" href="#/read/' + esc(e.slug) + '">' +
      '<div class="dir">' + dir + '</div><div class="ttl">' + esc(e.short) + '</div></a>';
  }

  /* ---------- reader: live contents + scroll-spy ---------- */
  var SECS = [];      // [{id, el}]
  function buildContents(frame, slug) {
    SECS = [];
    var list = document.getElementById("tocList");
    if (!list) return;
    var doc;
    try { doc = frame.contentDocument; } catch (err) { doc = null; }
    if (!doc) { list.innerHTML = ""; return; }

    var items = [];   // {id, label}
    var tocLinks = doc.querySelectorAll(".booktoc a[href^='#']");
    if (tocLinks.length) {
      Array.prototype.forEach.call(tocLinks, function (a) {
        var id = (a.getAttribute("href") || "").slice(1);
        if (id && doc.getElementById(id)) items.push({ id: id, label: a.textContent.trim() });
      });
    }
    if (!items.length) {   // fall back to headings (pass-through notes)
      var heads = doc.querySelectorAll("h2");
      Array.prototype.forEach.call(heads, function (h, i) {
        if (!h.id) h.id = "nfe-sec-" + i;
        var label = h.textContent.trim();
        if (label) items.push({ id: h.id, label: label });
      });
    }
    if (!items.length) { list.innerHTML = '<li><a style="opacity:.45">No sections</a></li>'; return; }

    var html = "";
    items.forEach(function (it) {
      html += '<li><a data-sec="' + esc(it.id) + '">' + esc(it.label) + '</a></li>';
      SECS.push({ id: it.id, el: doc.getElementById(it.id) });
    });
    list.innerHTML = html;
    Array.prototype.forEach.call(list.querySelectorAll("a[data-sec]"), function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        jumpTo(frame, a.getAttribute("data-sec"));
        document.body.classList.remove("toc-open");
      });
    });
  }

  function jumpTo(frame, id) {
    try {
      var win = frame.contentWindow, doc = frame.contentDocument;
      var el = doc.getElementById(id);
      if (!el) return;
      var y = el.getBoundingClientRect().top + win.scrollY - 14;
      win.scrollTo({ top: y, behavior: "smooth" });
    } catch (err) {}
  }

  function wireScrollTracking(frame, slug) {
    var win, doc;
    try { win = frame.contentWindow; doc = frame.contentDocument; } catch (e) { return; }
    var fill = document.getElementById("progFill");
    var pct = document.getElementById("progPct");
    var list = document.getElementById("tocList");
    var ticking = false;

    function update() {
      ticking = false;
      var de = doc.documentElement, b = doc.body;
      var sh = Math.max(de.scrollHeight, b.scrollHeight);
      var ch = win.innerHeight || de.clientHeight;
      var st = win.scrollY || de.scrollTop || 0;
      var frac = sh > ch ? Math.min(1, Math.max(0, st / (sh - ch))) : 1;
      if (fill) fill.setAttribute("stroke-dashoffset", (RING_C * (1 - frac)).toFixed(1));
      if (pct) pct.textContent = Math.round(frac * 100) + "%";

      // persist scroll
      try {
        var sc = JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}");
        sc[slug] = st; localStorage.setItem(SCROLL_KEY, JSON.stringify(sc));
      } catch (e2) {}

      // scroll-spy: last section whose top is above the fold line
      if (SECS.length && list) {
        var line = st + 130, activeId = SECS[0].id;
        for (var i = 0; i < SECS.length; i++) {
          var el = SECS[i].el; if (!el) continue;
          var top = el.getBoundingClientRect().top + st;
          if (top <= line) activeId = SECS[i].id; else break;
        }
        var links = list.querySelectorAll("a[data-sec]"), cur = null;
        Array.prototype.forEach.call(links, function (a) {
          var on = a.getAttribute("data-sec") === activeId;
          a.classList.toggle("active", on);
          if (on) cur = a;
        });
        if (cur && document.body.classList.contains("toc-open") === false) {
          // keep active item in view within the rail (no page jump)
          var r = cur.getBoundingClientRect(), pr = list.getBoundingClientRect();
          if (r.top < pr.top || r.bottom > pr.bottom) cur.scrollIntoView({ block: "nearest" });
        }
      }
    }
    function onScroll() { if (!ticking) { ticking = true; (win.requestAnimationFrame || setTimeout)(update); } }
    try { win.addEventListener("scroll", onScroll, { passive: true }); } catch (e3) {}
    update();
  }

  function restoreScroll(frame, slug) {
    try {
      var sc = JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}");
      if (sc[slug]) frame.contentWindow.scrollTo(0, sc[slug]);
    } catch (e) {}
  }

  function applyFontSize(frame) {
    try {
      var doc = frame.contentDocument;
      if (doc && doc.documentElement) doc.documentElement.style.setProperty("--nfe-fs", fontSize() + "px");
    } catch (e) {}
  }
  function bumpFont(dir, frame) {
    var v = Math.max(14, Math.min(26, fontSize() + dir * 2));
    localStorage.setItem(FS_KEY, v);
    applyFontSize(frame);
  }

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
      if (e.key === "ArrowRight" && FLAT[idx + 1]) go(FLAT[idx + 1].slug);
      if (e.key === "ArrowLeft" && FLAT[idx - 1]) go(FLAT[idx - 1].slug);
      if (e.key === "Escape") { if (document.body.classList.contains("toc-open")) document.body.classList.remove("toc-open"); else location.hash = ""; }
    }
  });
})();
