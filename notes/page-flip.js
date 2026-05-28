/* page-flip.js — book-style page turn for the long notes pages.
   Opt-in via the floating "📖 Book mode" toggle in the corner. When enabled,
   the page is split into one "page" per top-level <h2>, and you flip through
   them with arrow keys / prev-next buttons / tap-on-the-edge / swipe.

   The flip is a real 3D fold using CSS rotateY on a clone of the current
   page, hinged at the spine (left edge), so the page peels off toward the
   camera and reveals the next page underneath. Going back reverses it.

   Self-contained: injects its own CSS link if missing, persists mode +
   current page per-URL in localStorage, and only activates on pages with
   at least 3 <h2> sections so the cheatsheet "one screen of bullets" pages
   keep working as before. Built 2026-05-28. */
(function () {
  "use strict";
  if (window.__bfLoaded) return;
  window.__bfLoaded = true;

  /* -------------------- 1. FIND THE READING ROOT + SECTIONS -------------------- */

  function pickRoot() {
    return document.querySelector("main") ||
           document.querySelector(".wrap") ||
           document.querySelector("article") ||
           document.body;
  }

  /* A "page" = one <h2> + every sibling up to the next <h2>.
     We only consider <h2>s that live directly under the reading root (or one
     level deep), so headings inside <details>/tables don't fragment the page. */
  function findPages(root) {
    var headings = Array.prototype.slice.call(root.children).filter(function (el) {
      return el.tagName === "H2";
    });
    if (headings.length < 3) return [];

    var pages = [];
    headings.forEach(function (h, idx) {
      var nodes = [h];
      var sib = h.nextElementSibling;
      while (sib && sib.tagName !== "H2") {
        nodes.push(sib);
        sib = sib.nextElementSibling;
      }
      pages.push({
        idx: idx,
        title: (h.textContent || "").trim().replace(/\s+/g, " "),
        id: h.id || null,
        nodes: nodes
      });
    });
    return pages;
  }

  var root = pickRoot();
  if (!root) return;
  var pages = findPages(root);
  if (!pages.length) return; /* short page — nothing to paginate */

  /* -------------------- 2. STATE -------------------- */

  var KEY_MODE = "bf-mode:" + location.pathname;
  var KEY_IDX  = "bf-idx:"  + location.pathname;
  function ls(get, key, val) {
    try {
      if (get) return localStorage.getItem(key);
      else { localStorage.setItem(key, val); return null; }
    } catch (e) { return null; }
  }

  var state = {
    on: ls(true, KEY_MODE) === "1",
    idx: Math.max(0, Math.min(pages.length - 1, parseInt(ls(true, KEY_IDX) || "0", 10) || 0)),
    flipping: false
  };

  /* -------------------- 3. STAGE / NAV DOM -------------------- */

  /* The stage replaces the section nodes during book mode and is removed when
     exiting. We also remember the original parent + nextSibling so we can
     restore the section nodes exactly where they were. */
  var stage = null;
  var stagePlaceholder = null;
  var nav = null;
  var toc = null;
  var edgeL = null, edgeR = null;
  var hiddenChrome = []; /* pre/post-section chrome (H1, intro, jump list, footer) hidden in book mode */
  var allSectionNodes = pages.reduce(function (acc, p) { return acc.concat(p.nodes); }, []);
  var origPosition = (function () {
    var first = allSectionNodes[0];
    return { parent: first.parentNode, before: first };
  })();
  /* The page's own <h1> title, shown as a slim header inside the reader so you
     always know which note you're in once the original header is hidden. */
  var bookTitle = (function () {
    var h1 = (root.querySelector && root.querySelector("h1")) ||
             document.querySelector("h1");
    return h1 ? (h1.textContent || "").trim().replace(/\s+/g, " ") : "";
  })();

  function buildStage() {
    stage = document.createElement("div");
    stage.className = "bf-stage";

    /* Slim book header: title of the note + a contents button on the right.
       Replaces the long pre-section header we hide below. */
    if (bookTitle) {
      var head = document.createElement("div");
      head.className = "bf-booktitle";
      head.innerHTML = '<span class="bf-booktitle-text"></span>';
      head.querySelector(".bf-booktitle-text").textContent = bookTitle;
      stage.appendChild(head);
    }

    var pageEl = document.createElement("div");
    pageEl.className = "bf-page bf-current";
    stage.appendChild(pageEl);

    var prog = document.createElement("div");
    prog.className = "bf-progress";
    pages.forEach(function (_, i) {
      var d = document.createElement("span");
      d.className = "bf-dot";
      d.title = "Page " + (i + 1) + ": " + pages[i].title;
      d.addEventListener("click", function () { jumpTo(i); });
      prog.appendChild(d);
    });
    stage.appendChild(prog);

    /* Insert at the position of the first section. We also hide all the
       original section nodes by tagging them; we don't detach them so anchor
       links (#id) still resolve to nodes if the SPA-ish nav refers to them. */
    origPosition.parent.insertBefore(stage, origPosition.before);
    allSectionNodes.forEach(function (n) {
      if (n.classList) n.classList.add("bf-hidden-section");
    });

    /* Hide the rest of the reading-root chrome that isn't part of a page —
       the H1, intro paragraphs, the hero/"high-yield" banner, the long
       "Jump to" list, any footer. Without this the book gets shoved hundreds
       of pixels down the screen under a wall of nav links (the old breakage).
       We keep the site <nav> bar so you can still leave the page. */
    hiddenChrome = [];
    var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, LINK: 1, TEMPLATE: 1, NAV: 1 };
    Array.prototype.slice.call(origPosition.parent.children).forEach(function (el) {
      if (el === stage) return;
      if (SKIP_TAGS[el.tagName]) return;
      if (el.id === "bf-toggle") return; /* our own injected UI (matters if root === body) */
      if (el.classList && el.classList.contains("bf-hidden-section")) return; /* already hidden */
      el.classList.add("bf-chrome-hidden");
      hiddenChrome.push(el);
    });

    /* Nav bar */
    nav = document.createElement("div");
    nav.className = "bf-nav";
    nav.innerHTML =
      '<button class="bf-toc" aria-label="Contents" title="Contents" type="button">&#9776;</button>' +
      '<button class="bf-prev" aria-label="Previous page" type="button">&#9664;</button>' +
      '<span class="bf-meta"><b class="bf-meta-num"></b> <span class="bf-meta-sep">·</span> <span class="bf-meta-title"></span></span>' +
      '<button class="bf-next" aria-label="Next page" type="button">&#9654;</button>' +
      '<button class="bf-exit" type="button">Exit</button>';
    document.body.appendChild(nav);

    nav.querySelector(".bf-toc").addEventListener("click", function () { toggleToc(); });
    nav.querySelector(".bf-prev").addEventListener("click", function () { flip(-1); });
    nav.querySelector(".bf-next").addEventListener("click", function () { flip(1); });
    nav.querySelector(".bf-exit").addEventListener("click", function () { setMode(false); });

    buildToc();

    /* Edge hot-zones (desktop/tablet only — phones get swipe) */
    edgeL = document.createElement("div");
    edgeL.className = "bf-edge bf-left";
    edgeL.innerHTML = "&#9664;";
    edgeL.title = "Previous page";
    edgeL.addEventListener("click", function () { flip(-1); });
    document.body.appendChild(edgeL);

    edgeR = document.createElement("div");
    edgeR.className = "bf-edge bf-right";
    edgeR.innerHTML = "&#9654;";
    edgeR.title = "Next page";
    edgeR.addEventListener("click", function () { flip(1); });
    document.body.appendChild(edgeR);
  }

  function teardownStage() {
    if (!stage) return;
    allSectionNodes.forEach(function (n) {
      if (n.classList) n.classList.remove("bf-hidden-section");
    });
    hiddenChrome.forEach(function (el) {
      if (el.classList) el.classList.remove("bf-chrome-hidden");
    });
    hiddenChrome = [];
    stage.remove(); stage = null;
    if (nav)   { nav.remove();   nav = null; }
    if (toc)   { toc.remove();   toc = null; }
    if (edgeL) { edgeL.remove(); edgeL = null; }
    if (edgeR) { edgeR.remove(); edgeR = null; }
  }

  /* -------------------- 3b. CONTENTS OVERLAY -------------------- */

  /* A tap-to-jump table of contents, since the long in-page "Jump to" list is
     hidden in book mode. Lists every page by title; the current page is marked. */
  function buildToc() {
    toc = document.createElement("div");
    toc.className = "bf-toc-overlay";
    var panel = document.createElement("div");
    panel.className = "bf-toc-panel";

    var h = document.createElement("div");
    h.className = "bf-toc-head";
    h.innerHTML = '<span>Contents</span><button class="bf-toc-close" type="button" aria-label="Close">&#10005;</button>';
    panel.appendChild(h);

    var list = document.createElement("ol");
    list.className = "bf-toc-list";
    pages.forEach(function (p, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bf-toc-item";
      b.textContent = p.title;
      b.addEventListener("click", function () {
        closeToc();
        jumpTo(i);
      });
      li.appendChild(b);
      list.appendChild(li);
    });
    panel.appendChild(list);
    toc.appendChild(panel);

    /* tap outside the panel (on the dim backdrop) closes */
    toc.addEventListener("click", function (e) { if (e.target === toc) closeToc(); });
    h.querySelector(".bf-toc-close").addEventListener("click", closeToc);
    document.body.appendChild(toc);
  }

  function openToc() {
    if (!toc) return;
    /* mark the active item + scroll it into view */
    var items = toc.querySelectorAll(".bf-toc-item");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("bf-toc-cur", i === state.idx);
    }
    document.body.classList.add("bf-toc-open");
    var cur = toc.querySelector(".bf-toc-cur");
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "center" });
  }
  function closeToc() { document.body.classList.remove("bf-toc-open"); }
  function toggleToc() {
    if (document.body.classList.contains("bf-toc-open")) closeToc();
    else openToc();
  }

  /* -------------------- 4. RENDER + FLIP -------------------- */

  function buildPageContent(idx) {
    var frag = document.createDocumentFragment();
    pages[idx].nodes.forEach(function (n) {
      /* Clone so we can keep the original DOM intact and toggle without losing it.
         The originals are tagged bf-hidden-section (display:none in book mode);
         the clone inherits that class, so strip our own bookkeeping classes off
         the clone and its descendants or the page renders blank. */
      var c = n.cloneNode(true);
      if (c.classList) c.classList.remove("bf-hidden-section", "bf-chrome-hidden");
      if (c.querySelectorAll) {
        var inner = c.querySelectorAll(".bf-hidden-section, .bf-chrome-hidden");
        for (var i = 0; i < inner.length; i++) {
          inner[i].classList.remove("bf-hidden-section", "bf-chrome-hidden");
        }
      }
      frag.appendChild(c);
    });
    return frag;
  }

  function mountPage(idx) {
    var holder = stage.querySelector(".bf-page.bf-current");
    while (holder.firstChild) holder.removeChild(holder.firstChild);
    holder.appendChild(buildPageContent(idx));
    /* Make sure the cloned cheatsheet bolded terms re-bind to the popover.
       The popover script uses event delegation off the main reading root and
       its data attributes (.tp-term) survived the clone, so taps already work
       without re-running term-popover. */
    holder.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "auto" });
    updateNav();
  }

  function updateNav() {
    if (!nav) return;
    var num = (state.idx + 1) + " / " + pages.length;
    nav.querySelector(".bf-meta-num").textContent = num;
    nav.querySelector(".bf-meta-title").textContent = pages[state.idx].title;
    nav.querySelector(".bf-prev").disabled = state.idx <= 0;
    nav.querySelector(".bf-next").disabled = state.idx >= pages.length - 1;
    if (edgeL) edgeL.classList.toggle("bf-dis", state.idx <= 0);
    if (edgeR) edgeR.classList.toggle("bf-dis", state.idx >= pages.length - 1);
    var dots = stage.querySelectorAll(".bf-progress .bf-dot");
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle("bf-d-on", i === state.idx);
    }
  }

  function flip(dir) {
    if (state.flipping || !stage) return;
    var target = state.idx + dir;
    if (target < 0 || target >= pages.length) return;
    state.flipping = true;

    var cur = stage.querySelector(".bf-page.bf-current");
    var curRect = cur.getBoundingClientRect();

    /* Build the flipper as a clone of either the current page (for "next")
       or the target page (for "prev"). The flipper is absolute-positioned to
       exactly overlay the current page. */
    var flipper = document.createElement("div");
    flipper.className = "bf-flipper";
    flipper.style.height = curRect.height + "px";
    flipper.style.width  = curRect.width + "px";
    /* The flipper sits at top:0 left:0 inside the stage; that lines up with
       the .bf-current page since the stage has position:relative. */

    if (dir > 0) {
      /* "Next": flipper shows current content, animates 0 -> -180 (peels left) */
      flipper.appendChild(buildPageContent(state.idx));
      stage.appendChild(flipper);
      /* mount the target underneath BEFORE animation so it's revealed */
      state.idx = target;
      ls(false, KEY_IDX, String(state.idx));
      mountPage(state.idx);
      /* trigger animation */
      requestAnimationFrame(function () {
        flipper.classList.add("bf-anim-next");
      });
    } else {
      /* "Prev": flipper shows target content, starts at -180, animates to 0
         so the prev page swings IN from the spine */
      flipper.classList.add("bf-prev-start");
      flipper.appendChild(buildPageContent(target));
      stage.appendChild(flipper);
      /* mount the target underneath as the "settled" state */
      state.idx = target;
      ls(false, KEY_IDX, String(state.idx));
      mountPage(state.idx);
      requestAnimationFrame(function () {
        flipper.classList.remove("bf-prev-start");
        flipper.classList.add("bf-anim-prev");
      });
    }

    var done = false;
    function settle() {
      if (done) return;
      done = true;
      if (flipper.parentNode) flipper.parentNode.removeChild(flipper);
      state.flipping = false;
    }
    flipper.addEventListener("transitionend", settle, { once: true });
    /* Fallback in case transitionend doesn't fire (e.g. reduced motion) */
    setTimeout(settle, 1100);
  }

  function jumpTo(targetIdx) {
    if (state.flipping || !stage) return;
    if (targetIdx < 0 || targetIdx >= pages.length || targetIdx === state.idx) return;
    /* For multi-page jumps we don't fan out animations — just one flip in
       the right direction. */
    var dir = targetIdx > state.idx ? 1 : -1;
    /* Set the "from" page to target -dir of destination so the single flip lands on target */
    state.idx = targetIdx - dir;
    mountPage(state.idx);
    flip(dir);
  }

  /* -------------------- 5. MODE TOGGLE -------------------- */

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.id = "bf-toggle";
  toggle.innerHTML = '<span aria-hidden="true">&#128214;</span><span>Book mode</span>';
  toggle.title = "Toggle book-style page turn (arrow keys, edges, swipe)";
  document.body.appendChild(toggle);

  function setMode(on) {
    state.on = !!on;
    ls(false, KEY_MODE, on ? "1" : "0");
    document.body.classList.toggle("bf-mode", on);
    toggle.classList.toggle("bf-on", on);
    toggle.querySelector("span:last-child").textContent = on ? "Scroll mode" : "Book mode";
    if (on) {
      buildStage();
      mountPage(state.idx);
    } else {
      teardownStage();
    }
  }
  toggle.addEventListener("click", function () { setMode(!state.on); });

  /* -------------------- 6. INPUT: keys + swipe + anchor links -------------------- */

  document.addEventListener("keydown", function (e) {
    if (!state.on) return;
    /* don't hijack typing in inputs */
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    var tocOpen = document.body.classList.contains("bf-toc-open");
    if (e.key === "Escape") { if (tocOpen) closeToc(); else setMode(false); return; }
    if (tocOpen) return; /* let the contents list scroll normally while open */
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); flip(1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); flip(-1); }
    else if (e.key === "Home") { e.preventDefault(); jumpTo(0); }
    else if (e.key === "End")  { e.preventDefault(); jumpTo(pages.length - 1); }
  });

  /* Touch swipe (left = next, right = prev) — phones only */
  var touch = null;
  document.addEventListener("touchstart", function (e) {
    if (!state.on || state.flipping) return;
    if (e.touches.length !== 1) return;
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (!touch || !state.on) return;
    var ch = e.changedTouches[0];
    var dx = ch.clientX - touch.x;
    var dy = ch.clientY - touch.y;
    var dt = Date.now() - touch.t;
    touch = null;
    /* Has to be mostly horizontal + a reasonable distance + a reasonable speed */
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || dt > 700) return;
    if (dx < 0) flip(1); else flip(-1);
  }, { passive: true });

  /* Intercept anchor clicks (the "Jump to ..." list) and flip to that page */
  document.addEventListener("click", function (e) {
    if (!state.on) return;
    var a = e.target.closest && e.target.closest("a[href^='#']");
    if (!a) return;
    var hash = (a.getAttribute("href") || "").slice(1);
    if (!hash) return;
    var idx = -1;
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].id === hash) { idx = i; break; }
    }
    if (idx === -1) return; /* let the browser handle non-page anchors */
    e.preventDefault();
    jumpTo(idx);
  });

  /* -------------------- 7. INJECT CSS + INIT -------------------- */

  if (!document.querySelector('link[href*="page-flip.css"]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    var scripts = document.getElementsByTagName("script");
    var here = null;
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (src.indexOf("page-flip.js") !== -1) { here = src; break; }
    }
    link.href = here ? here.replace(/page-flip\.js.*$/, "page-flip.css")
                     : "/sihan-met-flashcards/notes/page-flip.css";
    document.head.appendChild(link);
  }

  /* Honour saved mode */
  if (state.on) setMode(true);
})();
