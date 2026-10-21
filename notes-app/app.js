/* Library: the app shell and the reader.

   No framework. manifest.json (written by build_app.py) lists the books;
   each book's pages live in content/<slug>.html and are read inside an
   iframe.

   Screens (hash routes):
     #/                    home: continue reading, recently opened, subjects
     #/s/<key>             a subject or the archive: its books + one book's page
     #/b/<slug>            a book's page (cover, blurb, contents) beside its subject
     #/search[/<words>]    search every book
     #/read/<slug>[?at=<section id>|start][&f=<words>&n=<k>]   the reader
   Older links (#/read/<slug>, #/search/<words>, #/archive) still land.

   Reading state is the old app's, kept as is: nfe:last, nfe:prog,
   nfe:spread, nfe:scroll, nfe:opens, nfe:fs. New: nfe:place (section and
   page you are on per book), nfe:recent, nfe:layout. */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var DATA = null;          // manifest.json
  var FLAT = [];            // every book, in subject order
  var BYSLUG = {};          // slug -> book
  var SEARCH = null;        // lazy search index
  var TOCS = {};            // slug -> [{id,label}], fetched for book pages
  var FS_KEY = "nfe:fs", LAST_KEY = "nfe:last", SCROLL_KEY = "nfe:scroll", SPREAD_KEY = "nfe:spread";
  var PROG_KEY = "nfe:prog", OPENS_KEY = "nfe:opens";
  var PLACE_KEY = "nfe:place", RECENT_KEY = "nfe:recent", LAYOUT_KEY = "nfe:layout", HINT_KEY = "lib:hint1";

  /* ---------- where each book is shelved ----------
     Six subjects plus an Archive. manifest.json still owns the books; this
     only decides which subject each one sits under, in reading order. A book
     that is not listed lands in Exam prep, so a rebuild that adds one can't
     hide it. acc = cover colour, ink = the same hue dark enough for text on
     paper, night = light enough for text on the night page. */
  var SUBJECTS = [
    { key: "final", name: "Final Textbook", short: "Final",
      acc: "#155F6B", ink: "#155F6B", night: "#74C3CE",
      sub: "The exam textbook by JSS subject, with A4 PDFs to print",
      books: [] },  /* filled in shelve() from the "final" shelf: one book per chapter */
    { key: "biopsych", name: "Biopsych", short: "Biopsych",
      acc: "#C0462D", ink: "#A3361F", night: "#EC8E76",
      sub: "Neurons, the brain, neurotransmitters, sensation",
      books: ["pinel", "biopsychology", "unit4-biopsych", "psycho-didi-biology"] },
    { key: "cognitive", name: "Cognitive", short: "Cognitive",
      acc: "#1C7684", ink: "#155F6B", night: "#72C3CF",
      sub: "Attention, perception, memory, learning, thinking, intelligence",
      books: ["eysenck", "cognitive", "unit5-cognition1", "unit6-thinking", "psycho-didi-cognitive"] },
    { key: "clinical", name: "Clinical and DSM", short: "Clinical",
      acc: "#6A3A7C", ink: "#5E3270", night: "#C9A0DA",
      sub: "Every disorder, DSM-5-TR, therapy, clinical foundations",
      books: ["dsm5tr", "abnormal-barlow-durand", "abnormal", "psycho-didi-psychopathology",
              "clinical-positive-foundations", "therapy", "psycho-didi-interventions", "psycho-didi-health"] },
    { key: "social", name: "Social and Personality", short: "Social",
      acc: "#3E7C45", ink: "#2F6436", night: "#8FC795",
      sub: "Social, personality, emotion and motivation, lifespan development",
      books: ["social", "personality", "developmental", "unit7-personality", "unit8-social",
              "unit9-development", "unit10-emerging", "psycho-didi-personality", "psycho-didi-social",
              "psycho-didi-developmental"] },
    { key: "stats", name: "Stats and Tests", short: "Stats",
      acc: "#244F8C", ink: "#224A84", night: "#90B2E8",
      sub: "Statistics, research methods, psychometrics, every test",
      books: ["statistics", "research", "research-stats", "psycho-didi-research", "unit3-psychometrics",
              "assessment", "psych-tests", "psycho-didi-testing"] },
    { key: "prep", name: "Exam prep", short: "Exam prep",
      acc: "#CF721C", ink: "#9E500E", night: "#EFA75F",
      sub: "Strategy, quick reference, systems and history, mock fixes, interview",
      books: ["master-guide", "concepts", "lookalikes", "textbook", "requested-topics", "systems-theories",
              "systems-theories-explained", "psycho-didi-history", "psycho-didi-cheatsheets", "mocks",
              "exam-papers", "therapy-style"] }
  ];
  var ARCHIVE = { key: "archive", name: "Archive", short: "Archive",
    acc: "#6D6E66", ink: "#55564F", night: "#B8B9B0",
    sub: "Amity, RML, SGT and the Manipal viva sheet. Closed cycles, every page kept.",
    books: ["amity", "rml-study-material", "sgt-study-material", "manipal-viva"] };
  var GROUPS = {};

  /* the line printed at the foot of each cover: which set the book came from */
  var SERIES = {
    final: "Final textbook", depth: "Full depth", core: "Core notes", syllabus: "Rodrick Sir", psychodidi: "Psycho Didi",
    reference: "Quick reference", strategy: "Exam strategy", coursework: "MA coursework",
    dsm: "DSM-5-TR", tests: "Test bank", requested: "You asked", stats: "From scratch",
    systems: "Systems and theories", amity: "Amity", rml: "RML CET-166", sgt: "SGT",
    mocks: "Mock fixes", interview: "Interview"
  };

  function shelve() {
    var all = SUBJECTS.concat([ARCHIVE]);
    function put(g, e) { e.group = g.key; e.acc = g.acc; g.list.push(e); }
    all.forEach(function (g) { GROUPS[g.key] = g; g.list = []; });
    DATA.shelves.forEach(function (sh) {
      if (sh.key === "final") GROUPS.final.books = sh.chapters.map(function (c) { return c.slug; });
    });
    all.forEach(function (g) {
      g.books.forEach(function (slug) { var e = BYSLUG[slug]; if (e && !e.group) put(g, e); });
    });
    DATA.shelves.forEach(function (sh) {
      sh.chapters.forEach(function (c) { if (!BYSLUG[c.slug].group) put(GROUPS.prep, BYSLUG[c.slug]); });
    });
    all.forEach(function (g) { FLAT = FLAT.concat(g.list); });
  }

  /* ---------- small helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function fontSize() {
    var v = parseInt(localStorage.getItem(FS_KEY), 10);
    return (v >= 14 && v <= 26) ? v : 18;
  }
  function fmtTime(min) {
    if (min < 60) return min + " min";
    return Math.floor(min / 60) + " h" + (min % 60 ? " " + (min % 60) + " min" : "");
  }
  function fmtNum(n) { return Number(n || 0).toLocaleString("en-US"); }
  function fmtWords(n) { return n >= 1e6 ? (n / 1e6).toFixed(2).replace(/0$/, "") + " million" : fmtNum(n); }
  function cvars(e) {
    var g = GROUPS[e.group];
    return "--c:" + g.acc + ";--ci:" + g.ink;
  }

  var ICONS = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    fwd: '<path d="M9 18l6-6-6-6"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/>',
    box: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
    books: '<path d="M4 20V5h4v15M8 20V7.5h4.5V20"/><path d="M13.6 8.2l3.7-1 3.4 12.4-3.7 1z"/><path d="M2.5 20.5h19"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
    zoom: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M11 8v6M8 11h6"/>'
  };
  function icon(n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }

  /* ---------- covers ----------
     The three-band paperback: subject colour, the title on paper, subject
     colour again with the series line and how far you are. The title is the
     book's short name split at its first bracket, dash, colon or comma. */
  function coverParts(e) {
    var s = e.short, m, t = s, by = "";
    if ((m = s.match(/^(.*?)\s*\(([^)]*)\)/))) { t = m[1]; by = m[2]; }
    else if ((m = s.match(/^(.*?)\s+[—–]\s+(.*)$/))) {
      t = m[1]; by = m[2];
      if (/^Unit \d+$/.test(t)) { t = m[2]; by = m[1]; }
    }
    else if ((m = s.match(/^(.*?):\s+(.*)$/))) { t = m[1]; by = m[2]; }
    else if ((m = s.match(/^(.*?),\s+(.*)$/))) { t = m[1]; by = m[2]; }
    return { t: t, by: by };
  }
  // rough width of a word in ems of Cabin Bold: capitals and figures are wide
  function textWidth(word) {
    var u = 0;
    for (var i = 0; i < word.length; i++) {
      var ch = word.charAt(i);
      u += /[A-Z0-9]/.test(ch) ? 0.74 : /[a-z]/.test(ch) ? 0.56 : 0.4;
    }
    return u;
  }
  function cover(e, w, P, tiny) {
    var cp = coverParts(e), g = GROUPS[e.group];
    // title size: by length (it must fit four lines) and by its longest
    // word (which must fit the cover's width)
    var n = cp.t.length, lw = Math.max.apply(null, cp.t.split(/[\s\/]+/).map(textWidth));
    var fs = Math.min(n > 30 ? 1.1 : n > 16 ? 1.3 : 1.62, 7.3 / Math.max(lw, 1));
    var prog = "";
    if (P && P[e.slug] != null) {
      prog = '<span class="cv-prog"><b style="width:' + Math.round(100 * Math.min(1, P[e.slug])) + '%"></b></span>';
    }
    return '<span class="cover' + (tiny ? " tiny" : w < 110 ? " small" : "") + '" style="--w:' + w + 'px;--c:' + g.acc + '" aria-hidden="true">' +
      '<span class="cv-top"><span class="cv-mark">' + esc(g.short) + '</span></span>' +
      '<span class="cv-mid"><span class="cv-t" style="font-size:' + fs.toFixed(2) + 'em">' + esc(cp.t) + '</span>' +
        (cp.by ? '<span class="cv-by">' + esc(cp.by) + '</span>' : '') + '</span>' +
      '<span class="cv-bot"><span class="cv-series">' + esc(SERIES[e.shelfKey] || "") + '</span>' + prog + '</span>' +
    '</span>';
  }

  /* ---------- reading state ---------- */
  function readMap(k) {
    try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; }
  }
  function writeMap(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function readOpens() {
    if (localStorage.getItem(OPENS_KEY) !== null) return readMap(OPENS_KEY);
    var o = {};
    [SCROLL_KEY, SPREAD_KEY].forEach(function (k) { Object.keys(readMap(k)).forEach(function (s) { o[s] = 1; }); });
    var last = localStorage.getItem(LAST_KEY);
    if (last) o[last] = 1;
    writeMap(OPENS_KEY, o);
    return o;
  }
  function countOpen(slug) { var o = readOpens(); o[slug] = (o[slug] || 0) + 1; writeMap(OPENS_KEY, o); }
  function saveProg(slug, frac) { var p = readMap(PROG_KEY); p[slug] = Math.round(frac * 1000) / 1000; writeMap(PROG_KEY, p); }
  function pctOf(e, P) { return Math.floor(100 * Math.min(1, P[e.slug] || 0)); }
  function groupPct(g, P) {
    var w = 0, r = 0;
    g.list.forEach(function (e) { w += e.words; r += e.words * Math.min(1, P[e.slug] || 0); });
    return w ? Math.floor(100 * r / w) : 0;
  }
  function recentList() {
    var r = null;
    try { r = JSON.parse(localStorage.getItem(RECENT_KEY) || "null"); } catch (e) { r = null; }
    if (!Array.isArray(r)) {
      // first run of this version: order by what the old app counted
      var o = readOpens(), last = localStorage.getItem(LAST_KEY);
      r = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; });
      if (last) { r = r.filter(function (s) { return s !== last; }); r.unshift(last); }
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 12))); } catch (e) {}
    }
    return r.map(function (s) { return BYSLUG[s]; }).filter(Boolean);
  }
  function pushRecent(slug) {
    var r = recentList().map(function (e) { return e.slug; }).filter(function (s) { return s !== slug; });
    r.unshift(slug);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 12))); } catch (e) {}
  }
  function stateLabel(e, P, O) {
    var pct = pctOf(e, P);
    if (pct >= 1) return pct + "% read";
    if (P[e.slug] != null) return "Started";
    return O && O[e.slug] ? "Opened" : "New";
  }

  /* ---------- load ---------- */
  fetch("manifest.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      DATA = d;
      d.shelves.forEach(function (sh) {
        sh.chapters.forEach(function (c) {
          BYSLUG[c.slug] = {
            slug: c.slug, title: c.title, short: c.short || c.title,
            blurb: c.blurb || "", minutes: +c.minutes || 0, words: +c.words || 0,
            shelfName: sh.name, shelfKey: sh.key
          };
        });
      });
      shelve();
      route();
    })
    .catch(function () {
      app.innerHTML = '<div class="main"><p class="sv-empty">The library did not load. Check the connection, then tap Update.</p></div>';
    });

  window.addEventListener("hashchange", route);
  postSyncToast();

  /* book-skin.js reaches the live reader frame through this when Day/Night changes */
  window.NFE = window.NFE || {};
  window.NFE.frame = function () { return FRAME; };

  function parseHash() {
    var h = location.hash || "", params = {}, i = h.indexOf("?");
    if (i >= 0) {
      h.slice(i + 1).split("&").forEach(function (kv) {
        var p = kv.split("=");
        if (p[0]) params[p[0]] = safeDecode(p.slice(1).join("="));
      });
      h = h.slice(0, i);
    }
    return { path: h, params: params };
  }

  function route() {
    if (!DATA) return;
    var h = parseHash(), p = h.path, m;
    closeOverlays();
    if ((m = p.match(/^#\/read\/([a-z0-9\-.]+)/i)) && BYSLUG[m[1]]) { renderReader(m[1], h.params); return; }
    leaveReader();
    if ((m = p.match(/^#\/b\/([a-z0-9\-.]+)/i)) && BYSLUG[m[1]]) renderSubject(BYSLUG[m[1]].group, m[1]);
    else if ((m = p.match(/^#\/s\/([a-z]+)/)) && GROUPS[m[1]]) renderSubject(m[1], null);
    else if (p === "#/archive") renderSubject("archive", null);
    else if ((m = p.match(/^#\/search(?:\/(.*))?$/))) renderSearch(m[1] ? safeDecode(m[1]) : "");
    else renderHome();
  }

  /* ---------- the shell: side rail + main ---------- */
  function themeSeg(compact) {
    var p = window.BookSkin ? window.BookSkin.pref() : "auto";
    return '<div class="seg theme-seg">' + [["day", "sun", "Day"], ["night", "moon", "Night"], ["auto", "", "Auto"]].map(function (x) {
      return '<button type="button" data-theme="' + x[0] + '"' + (p === x[0] ? ' class="on"' : '') +
        ' title="' + x[2] + '" aria-label="' + x[2] + ' page">' + (x[1] ? icon(x[1]) : '') +
        (compact && x[1] ? '' : '<span>' + x[2] + '</span>') + '</button>';
    }).join("") + '</div>';
  }
  function paintThemeSegs() {
    var p = window.BookSkin ? window.BookSkin.pref() : "auto";
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme]"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-theme") === p);
    });
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-theme]");
    if (b && window.BookSkin) window.BookSkin.set(b.getAttribute("data-theme"));
  });
  window.addEventListener("libtheme", paintThemeSegs);

  function sidebar(active) {
    var P = readMap(PROG_KEY);
    var h = '<nav class="side" id="side" aria-label="Library">' +
      '<a class="s-brand" href="#/"><span class="s-logo">' + icon("books") + '</span>' +
        '<span><span class="s-name">Library</span><span class="s-count">' + FLAT.length + ' books, ' +
        fmtWords(DATA.words) + ' words</span></span></a>' +
      '<a class="s-search" href="#/search">' + icon("search") + 'Search every book</a>' +
      '<a class="s-item' + (active === "home" ? " on" : "") + '" href="#/">' + icon("home") + '<span>Home</span></a>' +
      '<div class="s-label">Subjects</div>';
    SUBJECTS.forEach(function (g) {
      var pct = groupPct(g, P);
      h += '<a class="s-item' + (active === g.key ? " on" : "") + '" href="#/s/' + g.key + '" style="--c:' + g.acc + '">' +
        '<i class="s-sw"></i><span>' + esc(g.name) + '</span><em>' + (pct ? pct + "%" : "") + '</em></a>';
    });
    h += '<a class="s-item s-arc' + (active === "archive" ? " on" : "") + '" href="#/s/archive">' + icon("box") +
      '<span>Archive</span><em>' + ARCHIVE.list.length + '</em></a></nav>' +
      '<div class="s-foot">' + themeSeg(true) + '</div>';
    return h;
  }
  function mtop() {
    return '<div class="mtop"><button class="rb" type="button" id="navBtn" aria-label="Menu">' + icon("menu") + '</button>' +
      '<b>Library</b><a class="rb" href="#/search" aria-label="Search">' + icon("search") + '</a></div>';
  }
  function shell(active, inner, mainCls) {
    document.body.classList.remove("nav-open");
    app.innerHTML = '<div class="shell">' + sidebar(active) +
      '<main class="main' + (mainCls ? " " + mainCls : "") + '" id="main">' + inner + '</main></div>' +
      '<div class="navscrim" id="navScrim"></div>';
    var nb = $("navBtn");
    if (nb) nb.addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
    $("navScrim").addEventListener("click", function () { document.body.classList.remove("nav-open"); });
    window.scrollTo(0, 0);
  }

  /* ---------- home ---------- */
  function renderHome() {
    var P = readMap(PROG_KEY), PL = readMap(PLACE_KEY), O = readOpens();
    var lastE = BYSLUG[localStorage.getItem(LAST_KEY)] || null;
    var recent = recentList().filter(function (e) { return e !== lastE; }).slice(0, 6);

    var h = mtop() + '<div class="home-top' + (recent.length ? "" : " solo") + '">' +
      heroHTML(lastE || FLAT[0], !!lastE, P, PL);
    if (recent.length) {
      h += '<section class="recent"><h2>Recently opened</h2><div class="recent-grid">';
      recent.forEach(function (e) {
        h += '<a class="rc" href="#/read/' + e.slug + '" title="' + esc(e.short) + '">' + cover(e, 92, P) +
          '<span class="rc-st">' + stateLabel(e, P, O) + '</span></a>';
      });
      h += '</div></section>';
    }
    h += '</div><h2 class="sect-h">Subjects</h2><div class="subjects">';
    SUBJECTS.forEach(function (g) { h += subjCard(g, P); });
    h += '</div>';
    h += '<a class="arc" href="#/s/archive">' + icon("box") + '<b>Archive</b><span>' + esc(ARCHIVE.sub) + '</span>' +
      '<span class="fan">' + ARCHIVE.list.map(function (e) { return cover(e, 34, null, true); }).join("") + '</span></a>';
    shell("home", h, "home");
  }

  function heroHTML(e, isLast, P, PL) {
    var cp = coverParts(e), pl = PL[e.slug] || {}, pct = pctOf(e, P);
    var where = pl.s ? pl.s : (isLast ? "" : e.blurb);
    var pos = pl.p && pl.n ? "Page " + pl.p + " of " + pl.n : (P[e.slug] != null ? pct + "% read" : "Not started");
    return '<section class="hero" style="' + cvars(e) + '">' +
      '<a href="#/read/' + e.slug + '" aria-label="' + (isLast ? "Resume " : "Open ") + esc(e.short) + '">' + cover(e, 168, P) + '</a>' +
      '<div class="hero-txt"><p class="hero-k">' + (isLast ? "Continue reading" : "Start here") + '</p>' +
        '<h1 class="hero-t">' + esc(cp.t) + '</h1>' + (cp.by ? '<p class="hero-by">' + esc(cp.by) + '</p>' : '') +
        (where ? '<p class="hero-sec">' + esc(where) + '</p>' : '') +
        '<div class="hero-prog"><span class="bar"><b style="width:' + pct + '%"></b></span><span>' + pos + '</span></div>' +
        '<div class="hero-btns"><a class="btn btn-fill" href="#/read/' + e.slug + '">' + (isLast ? "Resume reading" : "Start reading") + '</a>' +
        '<a class="btn" href="#/b/' + e.slug + '">Contents</a></div></div></section>';
  }

  function subjCard(g, P) {
    var pct = groupPct(g, P), mins = 0;
    g.list.forEach(function (e) { mins += e.minutes; });
    var fan = g.list.slice(0, 5).map(function (e) { return cover(e, 58, null, true); }).join("");
    return '<a class="subj" href="#/s/' + g.key + '" style="--c:' + g.acc + '">' +
      '<span class="subj-h"><b>' + esc(g.name) + '</b><em>' + (pct ? pct + "% read" : "") + '</em></span>' +
      '<p>' + esc(g.sub) + '</p>' +
      '<span class="fan">' + fan + (g.list.length > 5 ? '<span class="more">+' + (g.list.length - 5) + ' more</span>' : '') + '</span>' +
      '<span class="bar"><b style="width:' + pct + '%"></b></span>' +
      '<span class="subj-f"><span>' + g.list.length + (g.list.length === 1 ? ' book' : ' books') + '</span><span>' + fmtTime(mins) + '</span></span></a>';
  }

  /* ---------- a subject: book list + the chosen book's page ---------- */
  var LIST_SCROLL = { key: null, top: 0 };
  function renderSubject(key, slug) {
    var g = GROUPS[key], P = readMap(PROG_KEY), PL = readMap(PLACE_KEY);
    var sel = slug ? BYSLUG[slug] : defaultBook(g);
    var mins = 0; g.list.forEach(function (e) { mins += e.minutes; });
    var pct = groupPct(g, P);
    var bl = $("blist");
    if (bl && LIST_SCROLL.key === key) LIST_SCROLL.top = bl.scrollTop; else LIST_SCROLL.top = -1;
    LIST_SCROLL.key = key;

    var h = mtop() + '<section class="blist" id="blist" style="--c:' + g.acc + '">' +
      '<div class="bl-h"><h1><i></i>' + esc(g.name) + '</h1><p>' + esc(g.sub) + '</p>' +
      '<p>' + g.list.length + ' books, ' + fmtTime(mins) + ' of reading' + (pct ? ', ' + pct + '% read' : '') + '</p>' +
      '<span class="bar"><b style="width:' + pct + '%"></b></span></div>';
    g.list.forEach(function (e) {
      var cp = coverParts(e), st = pctOf(e, P);
      h += '<a class="brow' + (e === sel ? " on" : "") + '" href="#/b/' + e.slug + '">' + cover(e, 50, null, true) +
        '<span class="br-txt"><span class="br-t">' + esc(cp.t) + '</span>' +
        (cp.by ? '<span class="br-by">' + esc(cp.by) + '</span>' : '') +
        '<span class="br-src">' + esc(e.shelfName) + ', ' + fmtTime(e.minutes) + '</span></span>' +
        '<span class="br-st' + (st ? " on" : "") + '">' + (st ? st + "%" : (P[e.slug] != null ? "Started" : "")) + '</span></a>';
    });
    h += '</section>' + detailHTML(sel, g, P, PL);
    shell(key, h, "split" + (slug ? " show-detail" : ""));

    var nb = $("blist");
    if (LIST_SCROLL.top >= 0) nb.scrollTop = LIST_SCROLL.top;
    else { var on = nb.querySelector(".brow.on"); if (on && on.offsetTop > nb.clientHeight * 0.7) nb.scrollTop = on.offsetTop - 120; }
    fillToc(sel, PL[sel.slug]);
  }
  function defaultBook(g) {
    var r = recentList();
    for (var i = 0; i < r.length; i++) if (r[i].group === g.key) return r[i];
    return g.list[0];
  }
  function detailHTML(e, g, P, PL) {
    var cp = coverParts(e), pct = pctOf(e, P), pl = PL[e.slug], started = P[e.slug] != null;
    return '<section class="detail" id="detail" style="' + cvars(e) + '">' +
      '<a class="rb d-back" href="#/s/' + g.key + '">' + icon("back") + '<span>' + esc(g.name) + '</span></a>' +
      '<div class="d-head">' + cover(e, 184, P) + '<div class="d-info">' +
        '<p class="d-src">' + esc(e.shelfName) + '</p>' +
        '<h1>' + esc(cp.t) + '</h1>' + (cp.by ? '<p class="d-by">' + esc(cp.by) + '</p>' : '') +
        (e.blurb ? '<p class="d-blurb">' + esc(e.blurb) + '</p>' : '') +
        '<p class="d-meta">' + fmtNum(e.words) + ' words, about ' + fmtTime(e.minutes) + ' of reading</p>' +
        (started ? '<div class="d-prog"><span class="bar"><b style="width:' + pct + '%"></b></span><span>' +
          (pl && pl.p ? 'Page ' + pl.p + ' of ' + pl.n + (pl.s ? ', ' + esc(pl.s) : '') : pct + '% read') + '</span></div>' : '') +
        '<div class="d-btns"><a class="btn btn-fill" href="#/read/' + e.slug + '">' + (started ? "Resume reading" : "Start reading") + '</a>' +
        (started ? '<a class="btn" href="#/read/' + e.slug + '?at=start">From the beginning</a>' : '') + '</div>' +
      '</div></div>' +
      '<h2 class="d-h">Contents</h2><ol class="d-toc" id="dToc" data-slug="' + e.slug + '"><li class="ld">Loading the contents</li></ol></section>';
  }

  /* The book page lists the same sections the reader's Contents panel does,
     found by the same rule (tocItems), so a tap lands on the right page. */
  function tocItems(doc) {
    var items = [], ids = {};
    Array.prototype.forEach.call(doc.querySelectorAll(".booktoc a[href^='#']"), function (a) {
      var id = (a.getAttribute("href") || "").slice(1);
      if (id && !ids[id] && doc.getElementById(id)) { ids[id] = 1; items.push({ id: id, label: a.textContent.replace(/\s+/g, " ").trim() }); }
    });
    if (!items.length) {
      // prose pages expose <h2>; accordion cram pages expose <summary>
      var seen = {};
      Array.prototype.forEach.call(doc.querySelectorAll("h2, details.acc > summary"), function (h, i) {
        if (!h.id) h.id = "nfe-sec-" + i;
        var label = h.textContent.replace(/\s+/g, " ").trim();
        if (label && !seen[label]) { seen[label] = 1; items.push({ id: h.id, label: label }); }
      });
    }
    return items;
  }
  function loadToc(slug, cb) {
    if (TOCS[slug]) { cb(TOCS[slug]); return; }
    fetch("content/" + slug + ".html")
      .then(function (r) { return r.text(); })
      .then(function (t) { TOCS[slug] = tocItems(new DOMParser().parseFromString(t, "text/html")); cb(TOCS[slug]); })
      .catch(function () { cb([]); });
  }
  function numbered(items) {
    // don't number a list whose labels already carry numbers
    return !items.some(function (it) {
      var l = it.label.trim();
      return /^\d/.test(l) || /^[IVXL]+[.:)\s]/.test(l) || /^(chapter|part|unit|section|ch\.)\s/i.test(l);
    });
  }
  function fillToc(e, pl) {
    loadToc(e.slug, function (items) {
      var ol = $("dToc");
      if (!ol || ol.getAttribute("data-slug") !== e.slug) return;
      if (!items.length) { ol.innerHTML = '<li class="ld">This one reads straight through, no chapter list. Open it and turn the pages.</li>'; return; }
      var here = pl && pl.id, num = numbered(items);
      ol.innerHTML = items.map(function (it, i) {
        var on = it.id === here;
        return '<li' + (on ? ' class="here"' : '') + '><a href="#/read/' + e.slug + '?at=' + encodeURIComponent(it.id) + '">' +
          '<span class="n">' + (num ? i + 1 : '') + '</span><span>' + esc(it.label) + '</span>' +
          (on ? '<span class="tag">You are here</span>' : '') + '</a></li>';
      }).join("");
    });
  }

  /* ---------- search every book ---------- */
  var TRY = ["Broca's area", "Classical conditioning", "Schizophrenia", "Reliability", "Piaget", "Attachment", "MMPI", "ANOVA"];
  function renderSearch(q) {
    var h = mtop() + '<div class="searchview"><label class="sv-bar">' + icon("search") +
      '<input id="svInput" type="search" placeholder="Search all ' + FLAT.length + ' books" autocomplete="off" ' +
      'autocapitalize="off" spellcheck="false" enterkeyhint="search" value="' + esc(q) + '"></label>' +
      '<div id="svRes"></div></div>';
    shell("search", h, "");
    var inp = $("svInput"), t = null;
    inp.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        try { history.replaceState(null, "", "#/search/" + encodeURIComponent(inp.value)); } catch (e) {}
        runSearch(inp.value);
      }, 160);
    });
    if (!q) inp.focus();
    loadSearch(function () {});
    runSearch(q);
  }
  /* search-full.json (build_search.py) holds every page of every book;
     search-index.json, the old capped index, is the fallback */
  var searchWait = null;
  function loadSearch(cb) {
    if (SEARCH) { cb(); return; }
    if (searchWait) { searchWait.push(cb); return; }
    searchWait = [cb];
    function got(d) {
      d.forEach(function (it) { it.lt = (it.text || "").toLowerCase(); });
      SEARCH = d;
      var w = searchWait; searchWait = null;
      w.forEach(function (f) { f(); });
    }
    function json(u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }); }
    json("search-full.json").catch(function () { return json("search-index.json"); }).then(got)
      .catch(function () {
        searchWait = null;
        var o = $("svRes"); if (o) o.innerHTML = '<div class="sv-empty">The search index did not load. Tap Update and try again.</div>';
      });
  }
  function countOcc(hay, needle, max) {
    var n = 0, i = hay.indexOf(needle);
    while (i !== -1 && n < max) { n++; i = hay.indexOf(needle, i + needle.length); }
    return n;
  }
  function runSearch(q) {
    var out = $("svRes");
    if (!out) return;
    q = (q || "").trim();
    if (!q) {
      out.innerHTML = '<div class="sv-empty"><p>Every page of every book is searchable. Try one of these:</p><div class="sv-try">' +
        TRY.map(function (w) { return '<a href="#/search/' + encodeURIComponent(w) + '">' + esc(w) + '</a>'; }).join("") + '</div></div>';
      return;
    }
    if (!SEARCH) {
      out.innerHTML = '<div class="sv-empty">Loading the index of every page (only slow the first time)</div>';
      loadSearch(function () { var i = $("svInput"); runSearch(i ? i.value : q); });
      return;
    }
    var ql = q.toLowerCase(), terms = ql.split(/\s+/).filter(Boolean);
    var need = Math.max(1, Math.ceil(terms.length / 2)), full = [], part = [];
    SEARCH.forEach(function (it) {
      var e = BYSLUG[it.slug];
      if (!e) return;
      var title = (e.short + " " + it.title).toLowerCase(), text = it.lt;
      var score = 0, got = 0;
      terms.forEach(function (w) {
        var inT = title.indexOf(w) !== -1, inB = text.indexOf(w) !== -1;
        if (inT || inB) got++;
        if (inT) score += 10;
        if (inB) score += 1;
      });
      if (!got) return;
      var phrase = text.indexOf(ql) !== -1;
      var needle = phrase ? ql : terms.slice().sort(function (a, b) { return b.length - a.length; })
        .filter(function (w) { return text.indexOf(w) !== -1; })[0] || "";
      var count = needle ? countOcc(text, needle, 999) : 0;
      score += Math.min(count, 60) / 6 + (phrase && terms.length > 1 ? 25 : 0);
      var rec = { it: it, e: e, score: score, needle: needle, count: count, text: text };
      if (got === terms.length) full.push(rec); else if (got >= need) part.push(rec);
    });
    var list = full.length ? full : part;
    if (!list.length) {
      out.innerHTML = '<div class="sv-empty"><p>Nothing in the library mentions &ldquo;' + esc(q) + '&rdquo;. Check the spelling, or try a shorter word.</p></div>';
      return;
    }
    list.sort(function (a, b) { return b.score - a.score; });
    var html = '<p class="sv-sum">' + list.length + (list.length === 1 ? " book" : " books") +
      (full.length ? " mention" + (list.length === 1 ? "s" : "") : " match some of") + ' &ldquo;' + esc(q) + '&rdquo;</p>';
    list.slice(0, 30).forEach(function (r) {
      var e = r.e, g = GROUPS[e.group], snips = "", pos = -1;
      for (var k = 0; k < 3 && r.needle; k++) {
        pos = r.text.indexOf(r.needle, pos + 1);
        if (pos === -1) break;
        snips += '<a class="sr-snip" href="#/read/' + e.slug + '?f=' + encodeURIComponent(r.needle) + '&n=' + k + '">' +
          snippet(r.it.text, pos, r.needle.length, terms) + '</a>';
      }
      html += '<div class="sr" style="' + cvars(e) + '"><a href="#/b/' + e.slug + '">' + cover(e, 54, null, true) + '</a>' +
        '<div class="sr-body"><a class="sr-t" href="#/b/' + e.slug + '">' + esc(e.short) + '</a>' +
        '<span class="sr-meta">' + esc(g.name) + (r.count ? ', ' + (r.count >= 999 ? "999+" : r.count) + (r.count === 1 ? " match" : " matches") : ", in the title") + '</span>' +
        snips + '</div></div>';
    });
    out.innerHTML = html;
  }
  function snippet(text, pos, len, terms) {
    var s = Math.max(0, pos - 70), e = Math.min(text.length, pos + len + 110);
    var out = esc((s > 0 ? "…" : "") + text.slice(s, e) + (e < text.length ? "…" : ""));
    terms.forEach(function (t) {
      if (t.length < 2) return;
      out = out.replace(new RegExp("(" + esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
    });
    return out;
  }

  /* ============================================================
     READER
     On a landscape tablet the chapter is a true two-page spread: the
     in-frame article becomes a multi-column flow whose columns ARE the
     printed pages, and a turn slides the flow by one spread. Portrait
     tablets get one page at a time, phones scroll. The page carries its
     own running head and folio; the bars appear when you tap the middle.
     ============================================================ */
  var FRAME = null, RSLUG = null, RBOOK = null, RLIST = [], PREV = null, NEXT = null, RIDX = 0, READING = false;
  var PAGED = false, SPREAD_W = 0, NSPREADS = 1, CUR = 0, NPAGES = 1;
  // Columns visible per turn: 2 = landscape spread, 1 = one page flipped
  // like a book. Every page-count / section-map / label calc reads it, so
  // one code path drives both. (CUR counts spreads; one spread = NCOLS.)
  var NCOLS = 2;
  // SPREAD_PITCH is how far the column flow advances per spread:
  // NCOLS*(colWidth + gap), derived from art.clientWidth, NOT the frame
  // width. Translating by the frame width accumulates drift, so deep pages
  // slide out of the margins. See paginate().
  var SPREAD_PITCH = 0, COL_PITCH = 0, PAD_H = 0, PAD_V = 0, COL_W = 0;
  var SECS = [];                         // [{id,label,el,spread,page}]
  var OPEN = {};                         // ?at / ?f params to apply once laid out
  var KEEP_FRAC = null;                  // position to hold across a relayout
  var pendingOpenLast = false;           // arriving from the next book: open on the last page
  var relayoutTimer = null, LAID = { w: 0, h: 0 }, deferRelayout = false;
  var FIND = { q: "", hits: [], cur: -1, sel: false };
  var ANCHOR = null;                     // the block at the top of the open spread, see captureAnchor()
  var KEEP_ANCHOR = null;                // ANCHOR carried across a relayout

  // How many printed pages to show:
  //   2 -> wide landscape, the two-page spread (default)
  //   1 -> portrait tablet, or "One page" picked in Aa
  //   0 -> phone, or "Scroll" picked in Aa: continuous scroll
  function colsForViewport() {
    var portrait = window.matchMedia("(orientation: portrait)").matches;
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    if (w < 680) return 0;
    var L = localStorage.getItem(LAYOUT_KEY);
    if (L === "scroll") return 0;
    if (L === "1") return 1;
    return (!portrait && w >= 1000) ? 2 : 1;
  }

  function frameDoc() { try { return FRAME && FRAME.contentDocument; } catch (e) { return null; } }
  function frameWin() { try { return FRAME && FRAME.contentWindow; } catch (e) { return null; } }

  function leaveReader() {
    if (!READING) return;
    READING = false; FRAME = null;
    document.body.classList.remove("reading", "ui-on", "mode-1up", "mode-2up", "mode-scroll", "panel-open", "aa-open");
  }

  function renderReader(slug, params) {
    var e = BYSLUG[slug], g = GROUPS[e.group], cp = coverParts(e), P = readMap(PROG_KEY);
    READING = true;
    document.body.classList.remove("nav-open", "mode-1up", "mode-2up", "mode-scroll");
    document.body.classList.add("reading", "ui-on");
    RLIST = g.list; RSLUG = slug; RBOOK = e; RIDX = RLIST.indexOf(e);
    PREV = RLIST[RIDX - 1] || null; NEXT = RLIST[RIDX + 1] || null;
    SECS = []; PAGED = false; NSPREADS = 1; NPAGES = 1; CUR = 0; ANCHOR = null;
    SPREAD_PITCH = 0; COL_PITCH = 0; PAD_H = 0;
    FIND = { q: "", hits: [], cur: -1, sel: false };
    OPEN = params || {};
    localStorage.setItem(LAST_KEY, slug);
    countOpen(slug);
    pushRecent(slug);

    var h = '<div class="reader" style="' + cvars(e) + '">' +
      '<div class="stage" id="stage">' +
        '<iframe id="reader" title="' + esc(e.title) + '" src="content/' + esc(slug) + '.html"></iframe>' +
        '<div class="fold"></div>' +
        '<div class="rh rh-l" id="rhL"></div><div class="rh rh-r" id="rhR"></div>' +
        '<div class="fo fo-l" id="foL"></div><div class="fo fo-r" id="foR"></div>' +
        '<div class="hint" id="turnHint">Tap the right edge or swipe to turn. Tap the middle for the menu.<br>Underlined words show their definition when tapped.</div>' +
      '</div>' +
      '<header class="rbar rtop">' +
        '<a class="rb" id="backBtn" href="#/b/' + slug + '" aria-label="Back to ' + esc(g.name) + '">' + icon("back") + '<span>' + esc(g.short) + '</span></a>' +
        '<button class="rb" type="button" id="tocBtn" aria-label="Contents">' + icon("list") + '<span>Contents</span></button>' +
        '<div class="rb-title"><b>' + esc(cp.t) + '</b><span id="secLab">' + esc(cp.by || g.name) + '</span></div>' +
        '<button class="rb" type="button" id="findBtn" aria-label="Find in this book">' + icon("search") + '</button>' +
        '<button class="rb rb-aa" type="button" id="aaBtn" aria-label="Text and page settings">Aa</button>' +
        '<button class="rb" type="button" id="fsBtn" aria-label="Full screen">' + icon(isFS() ? "shrink" : "expand") + '</button>' +
      '</header>' +
      '<footer class="rbar rbot">' +
        '<button class="rb rnav" type="button" id="prevBtn"' + (PREV ? ' title="' + esc(PREV.short) + '"' : ' disabled') + '>' +
          icon("back") + '<span>' + (PREV ? esc(coverParts(PREV).t) : "First book") + '</span></button>' +
        '<div class="scrub"><div class="scrub-lab"><b id="scrubSec"></b><span id="scrubPg"></span></div>' +
          '<div class="scrub-track"><div class="ticks" id="ticks"></div>' +
          '<input type="range" id="scrub" min="0" max="0" value="0" step="1" aria-label="Page"></div></div>' +
        '<button class="rb rnav" type="button" id="nextBtn"' + (NEXT ? ' title="' + esc(NEXT.short) + '"' : ' disabled') + '>' +
          '<span>' + (NEXT ? esc(coverParts(NEXT).t) : "Last book") + '</span>' + icon("fwd") + '</button>' +
      '</footer>' +
      '<aside class="panel" id="panel" aria-label="Contents and find">' +
        '<div class="p-head">' + cover(e, 54, P, true) + '<div><span class="ph-t">' + esc(cp.t) + '</span>' +
          '<span class="ph-s" id="pPos">Book ' + (RIDX + 1) + ' of ' + RLIST.length + ' in ' + esc(g.name) + '</span>' +
          '<span class="bar"><b id="pBar" style="width:' + pctOf(e, P) + '%"></b></span></div>' +
          '<button class="rb" type="button" id="pClose" aria-label="Close">' + icon("close") + '</button></div>' +
        '<div class="p-tabs"><button type="button" id="tabToc" class="on">Contents</button><button type="button" id="tabFind">Find in book</button></div>' +
        '<div class="p-body" id="pToc"><nav class="toc" id="tocList"><a style="opacity:.5">Loading</a></nav></div>' +
        '<div class="p-body" id="pFind" hidden><label class="find-bar">' + icon("search") +
          '<input id="findInput" type="search" placeholder="Find a word or phrase" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></label>' +
          '<div class="find-sum" id="findSum"></div><div id="findList"></div></div>' +
      '</aside>' +
      '<div class="aa" id="aaPop" role="dialog" aria-label="Reading settings">' +
        '<div class="aa-row"><span>Text size</span><div class="seg"><button type="button" id="fsDown" aria-label="Smaller text">A&#8722;</button>' +
          '<output id="fsVal">' + fontSize() + '</output><button type="button" id="fsUp" aria-label="Larger text">A+</button></div></div>' +
        '<div class="aa-row"><span>Page</span>' + themeSeg(false) + '</div>' +
        '<div class="aa-row" id="layRow"><span>Layout</span><div class="seg" id="laySeg"></div></div>' +
        '<button type="button" class="aa-upd" id="updBtn">' + icon("refresh") + 'Check for updates</button>' +
      '</div>' +
      '<div class="scrim" id="scrim"></div>' +
      '<div class="lightbox" id="lightbox" role="dialog" aria-label="Figure">' +
        '<div class="lb-bar"><p id="lbCap"></p><button class="rb" type="button" id="lbZoom" aria-label="Zoom">' + icon("zoom") + '</button>' +
        '<button class="rb" type="button" id="lbClose" aria-label="Close">' + icon("close") + '</button></div>' +
        '<div class="lb-view" id="lbView"><img id="lbImg" alt=""></div></div>' +
      '</div>';
    app.innerHTML = h;

    FRAME = $("reader");
    FRAME.addEventListener("load", onFrameLoad);

    $("tocBtn").addEventListener("click", function () { openPanel("toc"); });
    $("findBtn").addEventListener("click", function () { openPanel("find"); });
    $("aaBtn").addEventListener("click", function () { document.body.classList.toggle("aa-open"); paintLayoutSeg(); });
    $("fsBtn").addEventListener("click", toggleFS);
    $("pClose").addEventListener("click", closeOverlays);
    $("scrim").addEventListener("click", closeOverlays);
    $("tabToc").addEventListener("click", function () { showTab("toc"); });
    $("tabFind").addEventListener("click", function () { showTab("find"); });
    if (PREV) $("prevBtn").addEventListener("click", function () { go(PREV.slug); });
    if (NEXT) $("nextBtn").addEventListener("click", function () { go(NEXT.slug); });
    $("fsUp").addEventListener("click", function () { bumpFont(1); });
    $("fsDown").addEventListener("click", function () { bumpFont(-1); });
    $("updBtn").addEventListener("click", runUpdate);
    $("laySeg").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-lay]");
      if (b) { try { localStorage.setItem(LAYOUT_KEY, b.getAttribute("data-lay")); } catch (er) {} relayout(); }
    });
    var scrub = $("scrub");
    scrub.addEventListener("input", function () { previewScrub(+scrub.value); });
    scrub.addEventListener("change", function () { commitScrub(+scrub.value); });
    var fi = $("findInput"), ft = null;
    fi.addEventListener("input", function () { clearTimeout(ft); ft = setTimeout(function () { runFind(fi.value); }, 220); });
    fi.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { fi.blur(); if (FIND.hits.length) { gotoHit(0); closeOverlays(); } } });
    $("findList").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-k]");
      if (b) { gotoHit(+b.getAttribute("data-k")); closeOverlays(); }
    });
    $("lbClose").addEventListener("click", closeFigure);
    $("lbZoom").addEventListener("click", function () { $("lbView").classList.toggle("zoom"); });
    $("lbImg").addEventListener("click", function () { $("lbView").classList.toggle("zoom"); });
    $("lbView").addEventListener("click", function (ev) { if (ev.target.id === "lbView") closeFigure(); });
    paintLayoutSeg();
    window.scrollTo(0, 0);
  }

  function go(slug) { location.hash = "#/read/" + slug; }

  function onFrameLoad() {
    var doc = frameDoc();
    if (!doc || !doc.documentElement) return;
    if (window.BookSkin) window.BookSkin.applyTo(FRAME);
    var g = GROUPS[RBOOK.group], de = doc.documentElement;
    de.style.setProperty("--subj", g.ink);
    de.style.setProperty("--subj-night", g.night);
    applyFontSize(FRAME);
    // Load every figure up front. Lazy images left unloaded off-screen give
    // the flow the wrong height, so page numbers would keep shifting as you
    // read; each load re-measures and keeps you on the same text.
    Array.prototype.forEach.call(doc.images, function (img) {
      if (img.getAttribute("loading") === "lazy") img.setAttribute("loading", "eager");
      if (!img.complete) img.addEventListener("load", scheduleRemeasure);
    });
    buildContents(doc);
    wireFrame(doc);
    whenFontsReady(doc, function () {
      layoutReader();
      applyOpenParams();
      maybeShowHint();
    });
    try { if (doc.fonts) doc.fonts.addEventListener("loadingdone", scheduleRemeasure); } catch (e) {}
  }
  function whenFontsReady(doc, fn) {
    var done = false;
    function run() { if (!done) { done = true; fn(); } }
    try { if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(run, run); } catch (e) {}
    setTimeout(run, 900);
  }

  /* decide + apply the layout mode for the current frame */
  function layoutReader() {
    var doc = frameDoc();
    if (!doc) return;
    var cols = colsForViewport();
    LAID.w = window.innerWidth; LAID.h = window.innerHeight;
    document.body.classList.toggle("mode-scroll", cols === 0);
    if (cols >= 1) paginate(cols);
    else scrollSetup();
    paintLayoutSeg();
    if (FIND.q) runFind(FIND.q, true);
  }

  function clearPaged(doc) {
    try {
      doc.documentElement.classList.remove("nfe-paged");
      doc.body.classList.remove("nfe-paged");
      var a = doc.querySelector(".nfe-article");
      if (a) { a.classList.remove("nfe-paged-article"); a.style.transition = ""; a.style.removeProperty("--pg-x"); }
    } catch (e) {}
  }
  function pagedArt() { var d = frameDoc(); return d && d.querySelector(".nfe-paged-article"); }

  /* ----- paged (2-up spread or 1-up single page) ----- */
  function paginate(cols) {
    var doc = frameDoc(), art = doc && doc.querySelector(".nfe-article");
    if (!art) return;
    var W = FRAME.clientWidth, H = FRAME.clientHeight;
    if (W < 4 || H < 4) return;
    NCOLS = (cols === 1) ? 1 : 2;
    document.body.classList.toggle("mode-1up", NCOLS === 1);
    document.body.classList.toggle("mode-2up", NCOLS === 2);

    // 2-up: a wide fold splits the two pages. 1-up: the page is the whole
    // measure, capped near 760px so lines stay readable on a wide screen;
    // the gap must be at least the outer margin or a sliver of the next page
    // bleeds into the right margin.
    var gap, ph;
    if (NCOLS === 1) {
      ph = Math.round(Math.min(96, Math.max(34, W * 0.085)));
      ph = Math.max(ph, Math.round((W - 760) / 2));
      gap = ph + 12;
    } else {
      gap = Math.round(Math.min(110, Math.max(58, W * 0.072)));
      ph  = Math.round(Math.min(70,  Math.max(30, W * 0.038)));
    }
    var pv = Math.round(Math.min(80, Math.max(46, H * 0.082)));   // room for the running head + folio

    var de = doc.documentElement;
    de.style.setProperty("--pg-gap", gap + "px");
    de.style.setProperty("--pg-ph", ph + "px");
    de.style.setProperty("--pg-pv", pv + "px");
    de.classList.add("nfe-paged");
    doc.body.classList.add("nfe-paged");
    art.classList.add("nfe-paged-article");

    // A printed book has no folds: open every <details> and keep it open so
    // the whole text paginates linearly.
    var dets = doc.querySelectorAll("details");
    Array.prototype.forEach.call(dets, function (d) { d.open = true; });
    if (dets.length && !FRAME._accWired) {
      doc.addEventListener("toggle", function (e) {
        if (e.target && e.target.tagName === "DETAILS" && !e.target.open) { e.target.open = true; scheduleRemeasure(); }
      }, true);
      FRAME._accWired = true;
    }

    art.style.transition = "none";
    art.style.setProperty("--pg-x", "0px");
    void art.offsetWidth;

    SPREAD_W = W;
    // Columns are sized from the article's REAL content box, so the pitch
    // must come from art.clientWidth (not W):
    //   colWidth     = (clientWidth - 2*ph - (NCOLS-1)*gap) / NCOLS
    //   COL_PITCH    = colWidth + gap
    //   SPREAD_PITCH = NCOLS * COL_PITCH
    // That lands every page on the same margins with zero drift.
    PAD_H = ph; PAD_V = pv;
    var cw0 = art.clientWidth || W;
    var colW = (cw0 - 2 * ph - (NCOLS - 1) * gap) / NCOLS;
    de.style.setProperty("--pg-colw", colW + "px");
    void art.offsetWidth;
    var cw = art.clientWidth || W;
    colW = (cw - 2 * ph - (NCOLS - 1) * gap) / NCOLS;
    de.style.setProperty("--pg-colw", colW + "px");
    COL_W = colW;
    // a table wider than the page would spill onto the facing page: squeeze it
    var tables = art.querySelectorAll("table");
    Array.prototype.forEach.call(tables, function (t) { t.classList.remove("nfe-wide"); });
    Array.prototype.forEach.call(tables, function (t) { if (t.getBoundingClientRect().width > colW + 2) t.classList.add("nfe-wide"); });
    COL_PITCH = colW + gap;
    SPREAD_PITCH = NCOLS * COL_PITCH;
    measureSpreads();
    PAGED = true;

    var want, ka = KEEP_ANCHOR;
    KEEP_ANCHOR = null;
    if (pendingOpenLast) want = NSPREADS - 1;
    else if (ka && ka.el.isConnected && (ka.el.getBoundingClientRect().width || ka.el.getBoundingClientRect().height)) {
      // new text size or orientation: open on the same text, not the same page number
      want = Math.floor(colOfX(ka.el.getBoundingClientRect().left - art.getBoundingClientRect().left) / NCOLS);
    }
    else if (KEEP_FRAC != null) want = Math.floor(KEEP_FRAC * NSPREADS);
    else want = restoredSpread(RSLUG);
    pendingOpenLast = false; KEEP_FRAC = null;
    CUR = Math.min(NSPREADS - 1, Math.max(0, want));

    requestAnimationFrame(function () { try { art.style.transition = ""; } catch (e) {} });
    positionChrome();
    paintTicks();
    applySpread();
    scheduleRemeasure();
  }

  /* (re)compute spread count + each section's spread from current layout */
  function measureSpreads() {
    var art = pagedArt();
    if (!art || !SPREAD_W || !COL_PITCH) return;
    // child rects and the article rect carry the same translateX, so the
    // offset cancels in (child.left - art.left). Columns sit at
    // x = PAD_H + col*COL_PITCH from the article's left edge.
    var base = art.getBoundingClientRect().left, total = SPREAD_W, kids = art.children;
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect();
      var right = (r.left - base) + r.width;
      if (right > total) total = right;
    }
    var ncols = Math.max(1, Math.ceil((total - PAD_H - 1) / COL_PITCH));
    NPAGES = ncols;
    NSPREADS = Math.max(1, Math.ceil(ncols / NCOLS));
    SECS.forEach(function (s) {
      if (s.el) {
        var x = s.el.getBoundingClientRect().left - base;
        var col = Math.max(0, Math.floor((x - PAD_H + 2) / COL_PITCH));
        s.page = Math.min(NPAGES, col + 1);
        s.spread = Math.min(NSPREADS - 1, Math.floor(col / NCOLS));
      } else { s.spread = 0; s.page = 1; }
    });
    paintTocPages();
  }

  function scheduleRemeasure() {
    if (!FRAME) return;
    clearTimeout(FRAME._remTimer);
    FRAME._remTimer = setTimeout(function () {
      if (!PAGED || !FRAME) return;
      var beforeN = NSPREADS, beforeC = CUR, art = pagedArt();
      measureSpreads();
      // stay on the same text: find where the block that opened this spread went
      if (ANCHOR && ANCHOR.el.isConnected && art) {
        var r = ANCHOR.el.getBoundingClientRect();
        if (r.width || r.height) CUR = Math.floor((colOfX(r.left - art.getBoundingClientRect().left) + ANCHOR.dcol) / NCOLS);
      }
      CUR = Math.min(NSPREADS - 1, Math.max(0, CUR));
      paintTicks();
      if (NSPREADS !== beforeN || CUR !== beforeC) {
        if (art) art.style.transition = "none";
        applySpread();
        requestAnimationFrame(function () { if (art) art.style.transition = ""; });
      } else paintChrome(activeSec(CUR));
      if (FIND.q) runFind(FIND.q, true);
    }, 420);
  }

  function applySpread() {
    var art = pagedArt();
    var step = SPREAD_PITCH || SPREAD_W;
    if (art) art.style.setProperty("--pg-x", (CUR * step) + "px");
    captureAnchor();
    var sec = activeSec(CUR);
    paintChrome(sec);
    setProgress((CUR + 1) / NSPREADS);
    spyActiveId(sec ? sec.id : null);
    persistSpread();
    savePlace(sec);
  }

  function colOfX(x) { return Math.max(0, Math.floor((x - PAD_H + 2) / COL_PITCH)); }
  /* Remember which top-level block the open spread starts in (and how many
     columns into it), so a re-measure can put you back on the same text. */
  function captureAnchor() {
    var art = pagedArt();
    if (!art || !COL_PITCH || !art.children.length) { ANCHOR = null; return; }
    var kids = art.children, n = kids.length, base = art.getBoundingClientRect().left, first = CUR * NCOLS;
    function colAt(i) { var r = kids[i].getBoundingClientRect(); return (r.width || r.height) ? colOfX(r.left - base) : -1; }
    var i = Math.min(n - 1, ANCHOR && ANCHOR.i < n ? ANCHOR.i : 0);
    while (i > 0 && colAt(i) > first) i--;
    while (i < n - 1) { var c = colAt(i + 1); if (c <= first) i++; else break; }
    var c0 = colAt(i);
    ANCHOR = { i: i, el: kids[i], dcol: c0 < 0 ? 0 : first - c0 };
  }

  function activeSec(spread) {
    var a = null;
    for (var i = 0; i < SECS.length; i++) { if (SECS[i].spread <= spread) a = SECS[i]; else break; }
    return a || SECS[0] || null;
  }

  /* running heads, folios, the scrubber and the panel's position line */
  function positionChrome() {
    var st = $("stage");
    if (!st) return;
    st.style.setProperty("--pv", PAD_V + "px");
    var L = PAD_H, R = PAD_H + COL_PITCH;
    [["rhL", L], ["foL", L], ["rhR", R], ["foR", R]].forEach(function (p) {
      var el = $(p[0]);
      if (el) { el.style.left = p[1] + "px"; el.style.width = COL_W + "px"; }
    });
  }
  function paintChrome(sec) {
    var label = sec ? sec.label : "";
    var title = coverParts(RBOOK).t;
    var first = CUR * NCOLS + 1, total = NSPREADS * NCOLS;
    var set = function (id, t) { var el = $(id); if (el) el.textContent = t; };
    if (PAGED) {
      if (NCOLS === 2) {
        set("rhL", title); set("rhR", label);
        set("foL", String(first)); set("foR", first + 1 <= NPAGES ? String(first + 1) : "");
        set("scrubPg", "Pages " + first + "–" + (first + 1) + " of " + total);
      } else {
        set("rhL", label || title); set("foL", String(first));
        set("scrubPg", "Page " + first + " of " + total);
      }
      var sc = $("scrub");
      if (sc) {
        sc.max = String(Math.max(0, NSPREADS - 1));
        sc.value = String(CUR);
        sc.style.setProperty("--fill", (NSPREADS > 1 ? 100 * CUR / (NSPREADS - 1) : 100) + "%");
      }
    }
    set("scrubSec", label);
    set("secLab", label || coverParts(RBOOK).by || GROUPS[RBOOK.group].name);
  }
  function paintTicks() {
    var t = $("ticks");
    if (!t) return;
    if (!PAGED || SECS.length > 80 || NSPREADS < 2) { t.innerHTML = ""; return; }
    t.innerHTML = SECS.map(function (s) {
      return '<i style="left:' + (100 * s.spread / (NSPREADS - 1)).toFixed(2) + '%"></i>';
    }).join("");
  }
  function previewScrub(v) {
    if (!PAGED) {
      $("scrubPg").textContent = Math.round(v / 10) + "%";
      return;
    }
    var first = v * NCOLS + 1, sec = activeSec(v);
    $("scrubPg").textContent = (NCOLS === 2 ? "Pages " + first + "–" + (first + 1) : "Page " + first) + " of " + NSPREADS * NCOLS;
    $("scrubSec").textContent = sec ? sec.label : "";
    $("scrub").style.setProperty("--fill", (NSPREADS > 1 ? 100 * v / (NSPREADS - 1) : 100) + "%");
  }
  function commitScrub(v) {
    if (PAGED) { goToSpread(v); return; }
    var win = frameWin(), doc = frameDoc();
    if (!win || !doc) return;
    var sh = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight), ch = win.innerHeight;
    win.scrollTo(0, (v / 1000) * Math.max(0, sh - ch));
  }

  function turnPage(dir) {
    if (!PAGED) return;
    clearSelectionHighlight();
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

  function setProgress(frac) {
    frac = Math.min(1, Math.max(0, frac));
    if (RSLUG) saveProg(RSLUG, frac);
    var b = $("pBar");
    if (b) b.style.width = Math.floor(frac * 100) + "%";
  }
  function savePlace(sec) {
    var m = readMap(PLACE_KEY);
    m[RSLUG] = {
      id: sec ? sec.id : null, s: sec ? sec.label : "",
      p: PAGED ? CUR * NCOLS + 1 : 0, n: PAGED ? NSPREADS * NCOLS : 0, t: Date.now()
    };
    writeMap(PLACE_KEY, m);
  }
  function persistSpread() {
    var sp = readMap(SPREAD_KEY);
    sp[RSLUG] = CUR;
    writeMap(SPREAD_KEY, sp);
  }
  /* Same layout as last time (same page count): the exact spread. Otherwise
     (another font size, the other orientation, or the old app's layout):
     the same fraction of the book. */
  function restoredSpread(slug) {
    var pl = readMap(PLACE_KEY)[slug], sp = readMap(SPREAD_KEY)[slug], f = readMap(PROG_KEY)[slug];
    if (pl && pl.n === NSPREADS * NCOLS && sp != null) return sp;
    if (f != null) return Math.max(0, Math.round(f * NSPREADS) - 1);
    return sp || 0;
  }

  /* ----- scroll (phones, or "Scroll" in Aa) ----- */
  function scrollSetup() {
    var win = frameWin(), doc = frameDoc();
    if (!win || !doc) return;
    clearPaged(doc);
    document.body.classList.remove("mode-1up", "mode-2up");
    PAGED = false;
    var sc = $("scrub");
    if (sc) { sc.max = "1000"; }
    paintTicks();

    var de = doc.documentElement, b = doc.body;
    function frac() {
      var sh = Math.max(de.scrollHeight, b.scrollHeight), ch = win.innerHeight || de.clientHeight;
      var st = win.scrollY || de.scrollTop || 0;
      return sh > ch ? Math.min(1, Math.max(0, st / (sh - ch))) : 1;
    }
    if (KEEP_FRAC != null) {
      var k = KEEP_FRAC; KEEP_FRAC = null;
      var sh0 = Math.max(de.scrollHeight, b.scrollHeight), ch0 = win.innerHeight;
      win.scrollTo(0, k * Math.max(0, sh0 - ch0));
    } else {
      var saved = readMap(SCROLL_KEY)[RSLUG];
      if (saved) win.scrollTo(0, saved);
    }

    var ticking = false, saveT = null;
    function update() {
      ticking = false;
      if (PAGED || !READING) return;
      var f = frac(), st = win.scrollY || de.scrollTop || 0;
      $("scrubPg") && ($("scrubPg").textContent = Math.round(f * 100) + "% read");
      var s2 = $("scrub");
      if (s2) { s2.value = String(Math.round(f * 1000)); s2.style.setProperty("--fill", (f * 100) + "%"); }
      var active = null;
      if (SECS.length) {
        var line = 130;
        for (var i = 0; i < SECS.length; i++) {
          var el = SECS[i].el;
          if (!el) continue;
          if (el.getBoundingClientRect().top <= line) active = SECS[i]; else break;
        }
        active = active || SECS[0];
        spyActiveId(active.id);
      }
      paintChrome(active);
      clearTimeout(saveT);
      saveT = setTimeout(function () {
        if (PAGED || !READING) return;
        setProgress(f);
        var s = readMap(SCROLL_KEY); s[RSLUG] = st; writeMap(SCROLL_KEY, s);
        savePlace(active);
      }, 250);
    }
    if (!FRAME._scrollWired) {
      FRAME._scrollWired = true;
      win.addEventListener("scroll", function () {
        if (!ticking) { ticking = true; (win.requestAnimationFrame || setTimeout)(update); }
      }, { passive: true });
    }
    FRAME._scrollUpdate = update;
    update();
  }

  /* ----- contents (built once per book) ----- */
  function buildContents(doc) {
    SECS = [];
    var list = $("tocList");
    if (!list) return;
    var items = tocItems(doc);
    if (!items.length) { list.innerHTML = '<a style="opacity:.55">This book reads straight through, no sections.</a>'; return; }
    list.innerHTML = items.map(function (it) {
      return '<a data-sec="' + esc(it.id) + '"><span>' + esc(it.label) + '</span><span class="pg"></span></a>';
    }).join("");
    items.forEach(function (it) { SECS.push({ id: it.id, label: it.label, el: doc.getElementById(it.id), spread: 0, page: 1 }); });
    list.addEventListener("click", function (ev) {
      var a = ev.target.closest("a[data-sec]");
      if (!a) return;
      ev.preventDefault();
      jumpTo(a.getAttribute("data-sec"));
      closeOverlays();
    });
  }
  function paintTocPages() {
    var list = $("tocList");
    if (!list) return;
    SECS.forEach(function (s, i) {
      var a = list.children[i], pg = a && a.querySelector(".pg");
      if (pg) pg.textContent = PAGED ? String(s.page) : "";
    });
  }
  function jumpTo(id) {
    var sec = null;
    for (var i = 0; i < SECS.length; i++) if (SECS[i].id === id) { sec = SECS[i]; break; }
    if (PAGED) {
      if (sec) { goToSpread(sec.spread); return; }
      // an anchor that is not a contents entry (a cross-reference): find its page
      var doc = frameDoc(), el = doc && doc.getElementById(id), art = pagedArt();
      if (el && art) {
        goToSpread(Math.floor(colOfX(el.getBoundingClientRect().left - art.getBoundingClientRect().left) / NCOLS));
      }
      return;
    }
    try {
      var win = frameWin(), d2 = frameDoc(), el2 = d2.getElementById(id);
      if (!el2) return;
      win.scrollTo({ top: el2.getBoundingClientRect().top + win.scrollY - 14, behavior: "smooth" });
    } catch (err) {}
  }
  function spyActiveId(activeId) {
    var list = $("tocList");
    if (!list) return;
    var cur = null;
    Array.prototype.forEach.call(list.querySelectorAll("a[data-sec]"), function (a) {
      var on = a.getAttribute("data-sec") === activeId;
      a.classList.toggle("active", on);
      if (on) cur = a;
    });
    if (cur && !document.body.classList.contains("panel-open")) {
      var body = $("pToc");
      if (body) body.scrollTop = Math.max(0, cur.offsetTop - body.clientHeight / 3);
    }
  }

  /* the page opened on a section, a "from the beginning", or a search hit */
  function applyOpenParams() {
    var o = OPEN; OPEN = {};
    if (o.at === "start") {
      if (PAGED) goToSpread(0); else { var w = frameWin(); if (w) w.scrollTo(0, 0); }
    } else if (o.at) jumpTo(o.at);
    if (o.f) {
      var n = runFind(o.f);
      if (!n && /\s/.test(o.f)) {
        var longest = o.f.split(/\s+/).sort(function (a, b) { return b.length - a.length; })[0];
        n = runFind(longest);
      }
      if (n) {
        var k = Math.min(Math.max(0, +o.n || 0), n - 1);
        gotoHit(k);
        $("findInput").value = FIND.q;
        toast("&ldquo;" + esc(FIND.q) + "&rdquo;, match " + (k + 1) + " of " + n + ". Find in book shows the rest.");
      }
    }
    if (o.at || o.f) { try { history.replaceState(null, "", "#/read/" + RSLUG); } catch (e) {} }
  }

  /* ---------- find in this book ---------- */
  function runFind(q, quiet) {
    var list = $("findList"), sum = $("findSum");
    var doc = frameDoc(), art = doc && doc.querySelector(".nfe-article");
    q = (q || "").trim();
    FIND.q = q; FIND.hits = []; FIND.cur = -1;
    if (!quiet) clearSelectionHighlight();
    if (!list || !art) return 0;
    if (q.length < 2) { list.innerHTML = ""; sum.textContent = q.length ? "Type one more letter" : ""; return 0; }
    var needle = q.toLowerCase(), MAX = 400, hits = [];
    var w = doc.createTreeWalker(art, 4 /* NodeFilter.SHOW_TEXT */, null), n;
    while ((n = w.nextNode()) && hits.length < MAX) {
      var p = n.parentNode;
      if (p && (p.nodeName === "SCRIPT" || p.nodeName === "STYLE")) continue;
      var lt = n.nodeValue.toLowerCase(), i = lt.indexOf(needle);
      while (i !== -1 && hits.length < MAX) { hits.push({ node: n, i: i, len: needle.length }); i = lt.indexOf(needle, i + needle.length); }
    }
    var base = PAGED ? art.getBoundingClientRect().left : 0, win = frameWin();
    hits = hits.filter(function (h) {
      var r = doc.createRange();
      r.setStart(h.node, h.i); r.setEnd(h.node, h.i + h.len);
      var rc = r.getClientRects()[0];
      if (!rc || (!rc.width && !rc.height)) return false;          // hidden block
      if (PAGED) {
        var col = colOfX(rc.left - base);
        h.page = col + 1; h.spread = Math.floor(col / NCOLS);
      } else h.y = rc.top + (win.scrollY || 0);
      return true;
    });
    FIND.hits = hits;
    sum.textContent = hits.length ? (hits.length >= MAX ? MAX + "+ matches" : hits.length + (hits.length === 1 ? " match" : " matches")) : "No matches in this book";
    list.innerHTML = hits.slice(0, 250).map(function (h, k) {
      return '<button type="button" class="fh" data-k="' + k + '"><span class="fh-s">' + hitSnippet(doc, art, h) + '</span>' +
        '<span class="fh-p">' + (PAGED ? "p. " + h.page : "") + '</span></button>';
    }).join("");
    return hits.length;
  }
  function hitSnippet(doc, art, h) {
    var blk = h.node.parentNode;
    while (blk && blk !== art && !/^(P|LI|TD|TH|H[1-6]|DD|DT|FIGCAPTION|BLOCKQUOTE|SUMMARY|DIV)$/.test(blk.nodeName)) blk = blk.parentNode;
    if (!blk) blk = art;
    var pre = doc.createRange();
    try { pre.setStart(blk, 0); pre.setEnd(h.node, h.i); } catch (e) { return esc(h.node.nodeValue.slice(0, 120)); }
    var off = pre.toString().length, full = blk.textContent || "";
    var s = Math.max(0, off - 60), e = Math.min(full.length, off + h.len + 90);
    function clean(t) { return esc(t.replace(/\s+/g, " ")); }
    return (s > 0 ? "…" : "") + clean(full.slice(s, off)) + "<mark>" + clean(full.substr(off, h.len)) + "</mark>" +
      clean(full.slice(off + h.len, e)) + (e < full.length ? "…" : "");
  }
  function gotoHit(k) {
    var h = FIND.hits[k], doc = frameDoc(), win = frameWin();
    if (!h || !doc) return;
    FIND.cur = k;
    var r = doc.createRange();
    r.setStart(h.node, h.i); r.setEnd(h.node, h.i + h.len);
    var done = false;
    try {
      if (win.CSS && win.CSS.highlights && win.Highlight) { win.CSS.highlights.set("nfe-find", new win.Highlight(r)); done = true; }
    } catch (e) {}
    if (!done) { try { var s = win.getSelection(); s.removeAllRanges(); s.addRange(r); FIND.sel = true; } catch (e) {} }
    if (PAGED) goToSpread(h.spread);
    else win.scrollTo({ top: Math.max(0, h.y - win.innerHeight * 0.3) });
    Array.prototype.forEach.call(document.querySelectorAll(".fh"), function (b) { b.classList.toggle("on", +b.getAttribute("data-k") === k); });
  }
  function clearSelectionHighlight() {
    var win = frameWin();
    if (FIND.sel && win) { try { win.getSelection().removeAllRanges(); } catch (e) {} FIND.sel = false; }
  }

  /* ---------- clicks inside the page ---------- */
  function wireFrame(doc) {
    doc.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      // the tap already turned the page or toggled the bars
      if (nowMs() - _lastTouchAct < 700) { ev.preventDefault(); ev.stopPropagation(); return; }
      // figures open in the viewer instead of leaving the app
      var fig = t.closest(".bfig");
      if (fig) {
        var img = fig.querySelector("img");
        if (img) {
          ev.preventDefault(); ev.stopPropagation();
          var cap = fig.querySelector("figcaption");
          openFigure(img.currentSrc || img.src, cap ? cap.textContent.replace(/\s+/g, " ").trim() : "");
          return;
        }
      }
      var a = t.closest("a");
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (href.charAt(0) === "#" && href.length > 1) { ev.preventDefault(); jumpTo(href.slice(1)); return; }
      // any other link replaces the whole app, not just the page frame
      if (href && !/^(javascript|mailto|tel):/i.test(href)) { ev.preventDefault(); location.href = a.href; }
    }, true);
    doc.addEventListener("keydown", onKey);
    wireGestures(FRAME);
  }

  /* ---------- gestures ----------
     Swipe across, or tap a page edge, to turn (paged modes only). Tap the
     middle of the page to show or hide the bars. Taps on links, defined
     terms, figures, form controls, a text selection, or anything marked
     data-notap (the viva sheet's drill cards) are left alone. */
  var _lastTouch = 0, _lastTouchAct = 0;
  function nowMs() { return Date.now(); }
  function isInteractive(node) {
    while (node && node.nodeType === 1) {
      var t = node.tagName;
      if (t === "A" || t === "BUTTON" || t === "INPUT" || t === "SELECT" ||
          t === "TEXTAREA" || t === "SUMMARY" || t === "LABEL" || t === "FIGURE") return true;
      if (node.getAttribute && node.getAttribute("role")) return true;
      if (node.hasAttribute && node.hasAttribute("data-notap")) return true;
      if (/^tp-/.test(node.id || "") || /\btp-/.test(typeof node.className === "string" ? node.className : "")) return true;
      node = node.parentNode;
    }
    return false;
  }
  function hasSelection(win) {
    try {
      var s = win && win.getSelection && win.getSelection();
      return !!(s && String(s).length > 0 && !s.isCollapsed && !FIND.sel);
    } catch (e) { return false; }
  }
  function tapAt(f) {
    var EDGE = 0.3;
    if (PAGED && f < EDGE) { turnPage(-1); afterTurn(); }
    else if (PAGED && f > 1 - EDGE) { turnPage(1); afterTurn(); }
    else if (PAGED) setUI(!document.body.classList.contains("ui-on"));
  }
  function afterTurn() { dismissHint(); if (!document.body.classList.contains("panel-open")) setUI(false); }

  function wireGestures(frame) {
    var doc = frameDoc(), win = frameWin();
    if (!doc) return;
    var sx = 0, sy = 0, st = 0, moved = false, tracking = false;
    var SWIPE = 42, TAP_MOVE = 12, TAP_MS = 450;
    function frac(x) { return x / (frame.clientWidth || 1); }
    doc.addEventListener("touchstart", function (ev) {
      if (!ev.touches || ev.touches.length !== 1) { tracking = false; return; }
      var t = ev.touches[0]; sx = t.clientX; sy = t.clientY; st = nowMs();
      moved = false; tracking = true;
    }, { passive: true });
    doc.addEventListener("touchmove", function (ev) {
      if (!tracking || !ev.touches || !ev.touches.length) return;
      var t = ev.touches[0];
      if (Math.abs(t.clientX - sx) > TAP_MOVE || Math.abs(t.clientY - sy) > TAP_MOVE) moved = true;
    }, { passive: true });
    doc.addEventListener("touchend", function (ev) {
      if (!tracking) return;
      tracking = false; _lastTouch = nowMs();
      var t = ev.changedTouches && ev.changedTouches[0];
      if (!t || hasSelection(win)) return;
      var dx = t.clientX - sx, dy = t.clientY - sy, dt = nowMs() - st;
      if (PAGED && Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.3) {
        turnPage(dx < 0 ? 1 : -1); afterTurn(); return;          // swipe left = next
      }
      if (!moved && Math.abs(dx) < TAP_MOVE && Math.abs(dy) < TAP_MOVE && dt < TAP_MS) {
        var f = frac(t.clientX);
        // the outer edge always turns, even over a figure (figures fill the
        // page width, so they would otherwise swallow most edge taps)
        var edge = PAGED && (f < 0.12 || f > 0.88) && t.target.closest && t.target.closest(".bfig");
        if (!edge && isInteractive(t.target)) return;
        _lastTouchAct = nowMs();
        tapAt(f);
      }
    }, { passive: true });
    // mouse: same zones; ignored right after a touch so a tap is not counted twice
    doc.addEventListener("click", function (ev) {
      if (nowMs() - _lastTouch < 700) return;
      if (ev.pointerType === "touch" || ev.defaultPrevented) return;
      if (hasSelection(win) || isInteractive(ev.target)) return;
      tapAt(frac(ev.clientX));
    });
  }

  function setUI(on) { document.body.classList.toggle("ui-on", !!on); }
  function maybeShowHint() {
    try {
      if (!PAGED || localStorage.getItem(HINT_KEY)) return;
      var h = $("turnHint");
      if (!h) return;
      setTimeout(function () { if (PAGED && $("turnHint") === h) h.classList.add("show"); }, 700);
      setTimeout(dismissHint, 6000);
    } catch (e) {}
  }
  function dismissHint() {
    var h = $("turnHint");
    if (h && h.classList.contains("show")) { h.classList.remove("show"); try { localStorage.setItem(HINT_KEY, "1"); } catch (e) {} }
  }

  /* ---------- panels ---------- */
  function openPanel(tab) {
    document.body.classList.remove("aa-open");
    document.body.classList.add("panel-open");
    showTab(tab);
  }
  function showTab(tab) {
    $("tabToc").classList.toggle("on", tab === "toc");
    $("tabFind").classList.toggle("on", tab === "find");
    $("pToc").hidden = tab !== "toc";
    $("pFind").hidden = tab !== "find";
    if (tab === "find") setTimeout(function () { var f = $("findInput"); if (f && !FIND.q) f.focus(); }, 280);
    else {
      var a = $("tocList") && $("tocList").querySelector("a.active"), body = $("pToc");
      if (a && body) body.scrollTop = Math.max(0, a.offsetTop - body.clientHeight / 3);
    }
  }
  function closeOverlays() {
    document.body.classList.remove("panel-open", "aa-open", "nav-open");
    closeFigure();
    var ae = document.activeElement;
    if (ae && ae.tagName === "INPUT" && ae.id === "findInput") ae.blur();
    if (deferRelayout) { deferRelayout = false; maybeRelayout(); }
  }
  function paintLayoutSeg() {
    var seg = $("laySeg"), row = $("layRow");
    if (!seg || !row) return;
    var w = window.innerWidth, wide = w >= 1000 && !window.matchMedia("(orientation: portrait)").matches;
    row.hidden = w < 680;
    var L = localStorage.getItem(LAYOUT_KEY) || "auto";
    var opts = wide ? [["auto", "Two pages"], ["1", "One page"], ["scroll", "Scroll"]]
                    : [["auto", "Pages"], ["scroll", "Scroll"]];
    if (!wide && L === "1") L = "auto";
    seg.innerHTML = opts.map(function (o) {
      return '<button type="button" data-lay="' + o[0] + '"' + (L === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>';
    }).join("");
  }

  /* ---------- figure viewer ---------- */
  function openFigure(src, cap) {
    var lb = $("lightbox");
    if (!lb) return;
    $("lbImg").src = src;
    $("lbCap").textContent = cap;
    $("lbView").classList.remove("zoom");
    lb.classList.add("open");
  }
  function closeFigure() { var lb = $("lightbox"); if (lb) lb.classList.remove("open"); }

  /* ---------- text size, layout, full screen ---------- */
  function applyFontSize(frame) {
    try {
      var doc = frame.contentDocument;
      if (doc && doc.documentElement) doc.documentElement.style.setProperty("--nfe-fs", fontSize() + "px");
    } catch (e) {}
  }
  function bumpFont(dir) {
    var v = Math.max(14, Math.min(26, fontSize() + dir * 2));
    localStorage.setItem(FS_KEY, v);
    $("fsVal").textContent = v;
    applyFontSize(FRAME);
    relayout();
  }
  function currentFrac() {
    if (PAGED) return (CUR + 0.5) / NSPREADS;
    var win = frameWin(), doc = frameDoc();
    if (!win || !doc) return 0;
    var sh = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight), ch = win.innerHeight;
    return sh > ch ? (win.scrollY || 0) / (sh - ch) : 0;
  }
  function relayout() {
    var doc = frameDoc();
    if (!doc) return;
    KEEP_FRAC = currentFrac();
    KEEP_ANCHOR = PAGED ? ANCHOR : null;
    clearPaged(doc);
    layoutReader();
  }
  function maybeRelayout() {
    if (Math.abs(window.innerWidth - LAID.w) > 2 || Math.abs(window.innerHeight - LAID.h) > 2) relayout();
  }
  window.addEventListener("resize", function () {
    if (!READING || !FRAME) return;
    // the on-screen keyboard (typing in Find) shrinks the window: don't
    // re-paginate under it, catch up once the panel closes
    var ae = document.activeElement;
    if (ae && ae.tagName === "INPUT") { deferRelayout = true; return; }
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(maybeRelayout, 180);
  });
  function isFS() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFS() {
    try {
      if (isFS()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      var el = document.documentElement, r = el.requestFullscreen || el.webkitRequestFullscreen;
      if (r) { var p = r.call(el); if (p && p.catch) p.catch(function () {}); }
    } catch (e) {}
  }
  function paintFS() { var b = $("fsBtn"); if (b) b.innerHTML = icon(isFS() ? "shrink" : "expand"); }
  document.addEventListener("fullscreenchange", paintFS);
  document.addEventListener("webkitfullscreenchange", paintFS);

  /* ---------- update ----------
     The shared Update control (force-sync.js) does the real work; the Aa
     panel's "Check for updates" presses it. The fallback below is the old
     app's own hard refresh, for when that script didn't load. */
  function runUpdate() {
    var b = $("met-force-sync-btn");
    if (b) b.click(); else forceSync();
  }
  var _toastTimer = null;
  function toast(msg, ms) {
    var t = $("nfeToast");
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
    _toastTimer = setTimeout(function () { t.classList.remove("show"); }, ms || 3600);
  }
  var _syncing = false;
  function forceSync() {
    if (_syncing) return; _syncing = true;
    toast("Updating to the latest version&hellip;", 8000);
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
        setTimeout(function () { toast("Updated to the latest version"); }, 300);
        if (location.search.indexOf("s=") !== -1) {
          try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
        }
      }
    } catch (e) {}
  }

  /* ---------- keyboard ---------- */
  function onKey(e) {
    var lb = $("lightbox");
    if (lb && lb.classList.contains("open")) { if (e.key === "Escape") closeFigure(); return; }
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") { if (e.key === "Escape") closeOverlays(); return; }
    if (!READING) {
      if (e.key === "/") { e.preventDefault(); location.hash = "#/search"; }
      return;
    }
    var b = document.body.classList;
    if (e.key === "Escape") {
      if (b.contains("panel-open") || b.contains("aa-open")) closeOverlays();
      else location.hash = "#/b/" + RSLUG;
      return;
    }
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
      if (PAGED) { e.preventDefault(); turnPage(1); afterTurn(); }
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      if (PAGED) { e.preventDefault(); turnPage(-1); afterTurn(); }
    } else if (e.key === "Home" && PAGED) { e.preventDefault(); goToSpread(0); }
    else if (e.key === "End" && PAGED) { e.preventDefault(); goToSpread(NSPREADS - 1); }
    else if (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key === "f")) { e.preventDefault(); openPanel("find"); }
  }
  document.addEventListener("keydown", onKey);
})();
