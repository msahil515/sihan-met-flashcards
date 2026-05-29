/* Notes for Exam — single-page library + reader.
   No framework. Loads manifest.json, renders a textbook-library home and a
   full-screen book reader (per-note pages live in content/<slug>.html). */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var DATA = null;          // manifest.json
  var FLAT = [];            // ordered [{slug,title,short,section,sectionName,grad,minutes,words}]
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
    html += appbar({ home: true });
    html += '<div class="library">';

    // hero
    html += '<div class="hero">' +
      '<h1>Notes for Exam</h1>' +
      '<p>Every cheatsheet, primer, debrief and deep-dive from your prep, rebuilt as one clean reading library. Tap a book to read it like a chapter.</p>' +
      '<div class="stats">' +
        '<span><b>' + DATA.chapters + '</b> chapters</span>' +
        '<span><b>' + Math.round(DATA.words / 1000) + 'k</b> words</span>' +
        '<span><b>' + DATA.shelves.length + '</b> sections</span>' +
      '</div></div>';

    // search
    html += '<div class="searchbar" id="openSearch">' +
      '<span class="sicon">&#128269;</span>' +
      '<input type="search" placeholder="Search all notes..." readonly></div>';

    // continue
    if (lastE) {
      html += '<div class="continue" data-go="' + esc(lastE.slug) + '">' +
        '<div class="cv" style="background:linear-gradient(135deg,' + lastE.grad[0] + ',' + lastE.grad[1] + ')"></div>' +
        '<div class="meta">' +
          '<div class="kicker">Continue reading</div>' +
          '<div class="ttl">' + esc(lastE.short) + '</div>' +
          '<div class="sub">' + esc(lastE.sectionName) + ' &middot; ' + lastE.minutes + ' min</div>' +
        '</div>' +
        '<button class="go">Resume</button></div>';
    }

    // shelves
    DATA.shelves.forEach(function (sh) {
      html += '<section class="shelf">' +
        '<div class="shelf-head"><h2>' + esc(sh.name) + '</h2>' +
        '<span class="st">' + esc(sh.subtitle) + '</span>' +
        '<span class="ct">' + sh.chapters.length + ' ' + (sh.chapters.length === 1 ? 'book' : 'books') + '</span></div>' +
        '<div class="shelf-row">';
      sh.chapters.forEach(function (c) {
        html += '<a class="book" data-go="' + esc(c.slug) + '" href="#/read/' + esc(c.slug) + '" ' +
          'style="background:linear-gradient(150deg,' + sh.grad[0] + ',' + sh.grad[1] + ')">' +
          '<span class="b-kicker">' + esc(sh.name) + '</span>' +
          '<span class="b-title">' + esc(c.short) + '</span>' +
          '<span class="b-blurb">' + esc(c.blurb) + '</span>' +
          '<span class="b-foot">' + c.minutes + ' min read <i class="dot"></i> ' + Math.round(c.words / 100) / 10 + 'k words</span>' +
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

    var html = '<div class="reader">';
    html += '<div class="appbar">' +
      '<button class="backbtn" id="backBtn"><span>&#8592;</span> Library</button>' +
      '<div class="crumb"><span class="sec">' + esc(e.sectionName) + '</span>' +
      '<span class="tt">' + esc(e.short) + '</span></div>' +
      '<span class="spacer"></span>' +
      '<div class="fontctl"><button id="fsDown" aria-label="Smaller text">A&#8722;</button>' +
      '<button id="fsUp" aria-label="Larger text">A&#43;</button></div>' +
      '<button class="iconbtn" id="readerSearch" aria-label="Search">&#128269;</button>' +
      '</div>';
    html += '<iframe id="reader" title="' + esc(e.title) + '" src="content/' + esc(slug) + '.html"></iframe>';
    html += '<div class="readernav">' +
      '<button id="prevBtn" ' + (prev ? '' : 'disabled') + '><span>&#8592;</span><span class="lbl">' + (prev ? esc(prev.short) : 'Start') + '</span></button>' +
      '<span class="pos">' + (idx + 1) + ' / ' + FLAT.length + '</span>' +
      '<button id="nextBtn" ' + (next ? '' : 'disabled') + '><span class="lbl">' + (next ? esc(next.short) : 'End') + '</span><span>&#8594;</span></button>' +
      '</div>';
    html += '</div>';
    app.innerHTML = html;

    var frame = document.getElementById("reader");
    frame.addEventListener("load", function () {
      applyFontSize(frame);
      // restore scroll
      try {
        var sc = JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}");
        if (sc[slug]) frame.contentWindow.scrollTo(0, sc[slug]);
      } catch (e2) {}
      // persist scroll
      try {
        frame.contentWindow.addEventListener("scroll", function () {
          var sc = {};
          try { sc = JSON.parse(localStorage.getItem(SCROLL_KEY) || "{}"); } catch (e3) {}
          sc[slug] = frame.contentWindow.scrollY;
          localStorage.setItem(SCROLL_KEY, JSON.stringify(sc));
        }, { passive: true });
      } catch (e4) {}
    });

    document.getElementById("backBtn").addEventListener("click", function () { location.hash = ""; });
    document.getElementById("readerSearch").addEventListener("click", openSearch);
    if (prev) document.getElementById("prevBtn").addEventListener("click", function () { go(prev.slug); });
    if (next) document.getElementById("nextBtn").addEventListener("click", function () { go(next.slug); });
    document.getElementById("fsUp").addEventListener("click", function () { bumpFont(1, frame); });
    document.getElementById("fsDown").addEventListener("click", function () { bumpFont(-1, frame); });
    window.scrollTo(0, 0);
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
    results.innerHTML = '<div class="searchempty">Type to search ' + (DATA ? DATA.chapters : "") + ' chapters.</div>';
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
    if (!SEARCH) { results.innerHTML = '<div class="searchempty">Loading index...</div>'; return; }
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
    if (i === -1) return esc(text.slice(0, 150)) + "...";
    var s = Math.max(0, i - 60), e = Math.min(text.length, i + 90);
    var out = (s > 0 ? "..." : "") + text.slice(s, e) + (e < text.length ? "..." : "");
    var re = new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
    return esc(out).replace(new RegExp(esc(term), "ig"), function (m) { return "<mark>" + m + "</mark>"; });
  }

  /* ---------- shared wiring ---------- */
  function appbar(opts) {
    return '<div class="appbar"><span class="brand"><span class="mark">&#128214;</span> Notes for Exam</span>' +
      '<span class="spacer"></span>' +
      '<button class="iconbtn" id="topSearch" aria-label="Search">&#128269;</button></div>';
  }
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
      if (e.key === "Escape") location.hash = "";
    }
  });
})();
