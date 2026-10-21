/* term-popover.js — tap an underlined term or abbreviation to see its definition.
   Tap anywhere outside the popover to close.

   Definitions come only from the glossary in term-glossary.js, loaded from the
   same folder. A bolded term, or an abbreviation in running text, is underlined
   only when the glossary has it AND one of its senses fits where it appears
   (page path, nearest heading, paragraph). So a tap always shows the real
   definition of that exact term in that sense, and anything else stays plain.
   (Rebuilt 2026-10-21, T088: the old 214-entry neuro dictionary and the fixed
   abbreviation list that gave ERP, OR, AP etc. one meaning everywhere are gone.) */
(function () {
  "use strict";
  if (window.__tpLoaded) return;
  window.__tpLoaded = true;

  var root = document.querySelector("main") ||
             document.querySelector(".wrap") ||
             document.body;
  if (!root) return;

  var G = null;      /* window.TP_GLOSSARY once loaded */
  var reCache = {};

  /* -------------------- 1. LOOKUP -------------------- */

  /* Key rules shared with the glossary build: lowercase, plain hyphens, no
     quotes, no trailing punctuation or leading article; then a trailing
     "(ABBR)" dropped, British -our/-ise folded and a plural trimmed. */
  function norm(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[–—]/g, "-")
      .replace(/["'`‘’“”]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[:.,;!?\- ]+$/, "")
      .replace(/^(the|a|an) /, "");
  }

  function base(s) {
    s = s.replace(/\s*\([^)]*\)$/, "")
         .replace(/behaviour/g, "behavior").replace(/colour/g, "color")
         .replace(/is(e|ed|ing|ation)\b/g, "iz$1");
    if (s.length > 4 && /ies$/.test(s)) return s.slice(0, -3) + "y";
    if (s.length > 4 && /[sxz]es$/.test(s)) return s.slice(0, -2);
    if (s.length > 3 && /s$/.test(s) && !/(ss|is|us)$/.test(s)) return s.slice(0, -1);
    return s;
  }

  function termEntry(txt) {
    var k = base(norm(txt));
    if (G.terms[k]) return { kind: "t", key: k };
    if (G.alias[k] && G.terms[G.alias[k]]) return { kind: "t", key: G.alias[k] };
    return null;
  }

  function abbrEntry(tok) {
    tok = tok.trim().replace(/[:.,;]+$/, "");
    if (G.abbr[tok]) return { kind: "a", key: tok };
    if (/s$/.test(tok) && G.abbr[tok.slice(0, -1)]) return { kind: "a", key: tok.slice(0, -1) };
    return null;
  }

  /* A bolded "Full name (ABBR)" can match on either half */
  function lookupBold(txt) {
    var r = termEntry(txt) || abbrEntry(txt);
    if (r) return r;
    var m = txt.match(/^(.*?)\s*\(([^)]+)\)\s*[:.,;]?$/);
    return m ? (termEntry(m[1]) || abbrEntry(m[2])) : null;
  }

  /* Context a sense is matched against: "page path | nearest heading | paragraph" */
  var PAGE = location.pathname.toLowerCase();
  PAGE = PAGE.split("sihan-met-flashcards/")[1] || PAGE.replace(/^\//, "");
  if (PAGE === "" || /\/$/.test(PAGE)) PAGE += "index.html";
  var heads = null;

  function headingBefore(el) {
    if (!heads) heads = Array.prototype.slice.call(document.querySelectorAll("h1, h2, h3"));
    var lo = 0, hi = heads.length - 1, found = null;
    while (lo <= hi) { /* last heading that comes before el in the document */
      var mid = (lo + hi) >> 1;
      if (heads[mid].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) { found = heads[mid]; lo = mid + 1; }
      else hi = mid - 1;
    }
    return found ? found.textContent : "";
  }

  function contextOf(el, term) {
    var blk = el.closest("p, li, td, th, dd, dt, blockquote, figcaption, div");
    var text = (blk ? blk.textContent : el.textContent).replace(/\s+/g, " ");
    if (text.length > 700) { /* long blocks: only the stretch around the term */
      var at = Math.max(0, text.indexOf(term));
      text = text.slice(Math.max(0, at - 350), at + 350);
    }
    return (PAGE + " | " + headingBefore(el).replace(/\s+/g, " ").trim() + " | " + text).toLowerCase();
  }

  /* Index of the first sense that fits here, or -1 (leave the word plain) */
  function pickSense(r, el, term) {
    var senses = (r.kind === "a" ? G.abbr : G.terms)[r.key].s;
    var ctx = null;
    for (var i = 0; i < senses.length; i++) {
      var c = senses[i].c;
      if (!c) return i;
      if (ctx === null) ctx = contextOf(el, term);
      var re = reCache[c] || (reCache[c] = new RegExp(c, "i"));
      if (re.test(ctx)) return i;
    }
    return -1;
  }

  function makeTerm(r, sense, cls) {
    var span = document.createElement("span");
    span.className = "tp-term " + cls;
    span.setAttribute("data-tp-kind", r.kind);
    span.setAttribute("data-tp-key", r.key);
    span.setAttribute("data-tp-sense", sense);
    span.setAttribute("role", "button");
    span.setAttribute("tabindex", "0");
    return span;
  }

  /* -------------------- 2. WRAP CONTENT -------------------- */

  var SKIP_TAGS = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEXTAREA:1, INPUT:1, CODE:1, PRE:1, A:1, BUTTON:1, MARK:1, NAV:1, H1:1, H2:1, H3:1, H4:1, H5:1, H6:1 };

  function isSkippable(node) {
    var p = node.parentNode;
    while (p && p !== root) {
      if (SKIP_TAGS[p.tagName] || p instanceof SVGElement) return true; /* spans can't live in SVG text */
      if (p.classList && (p.classList.contains("tp-term") || p.classList.contains("jump") || p.classList.contains("tp-skip"))) return true;
      p = p.parentNode;
    }
    return false;
  }

  /* (a) Bolded terms the glossary defines, in a sense that fits here */
  function wrapBoldTerms() {
    root.querySelectorAll("b, strong").forEach(function (b) {
      if (b.querySelector(".tp-term")) return;
      if (b.closest("a, h1, h2, h3, h4, h5, h6, nav, button, .tp-skip")) return;
      var txt = (b.textContent || "").replace(/\s+/g, " ").trim();
      if (!txt || txt.length > 80 || !/[a-zA-Z]/.test(txt)) return;
      var r = lookupBold(txt);
      if (!r) return;
      var sense = pickSense(r, b, txt);
      if (sense < 0) return;
      var span = makeTerm(r, sense, "tp-bold");
      while (b.firstChild) span.appendChild(b.firstChild);
      b.appendChild(span);
    });
  }

  /* (b) Glossary abbreviations in running text (case-sensitive, plural "s" ok;
     not when glued to a hyphen, so "non-REM" is not read as REM) */
  function wrapAbbreviations() {
    var keys = Object.keys(G.abbr).sort(function (a, b) { return b.length - a.length; })
      .map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    if (!keys.length) return;
    var re = new RegExp("(^|[^A-Za-z0-9-])(" + keys.join("|") + ")(s?)(?=$|[^A-Za-z0-9-])", "g");

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (isSkippable(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    var cur;
    while ((cur = walker.nextNode())) nodes.push(cur);

    nodes.forEach(function (node) {
      var text = node.nodeValue, m, hits = [];
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        var r = { kind: "a", key: m[2] };
        var sense = pickSense(r, node.parentNode, m[2]);
        if (sense >= 0) hits.push([m.index + m[1].length, m[2].length + m[3].length, r, sense]);
      }
      if (!hits.length) return;
      var frag = document.createDocumentFragment(), pos = 0;
      hits.forEach(function (h) {
        if (h[0] > pos) frag.appendChild(document.createTextNode(text.slice(pos, h[0])));
        var span = makeTerm(h[2], h[3], "tp-abbr");
        span.textContent = text.substr(h[0], h[1]);
        frag.appendChild(span);
        pos = h[0] + h[1];
      });
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  /* -------------------- 3. POPOVER UI -------------------- */

  var backdrop = document.createElement("div");
  backdrop.id = "tp-popover-backdrop";
  document.body.appendChild(backdrop);

  var pop = document.createElement("div");
  pop.id = "tp-popover";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-modal", "false");
  pop.innerHTML =
    '<div class="tp-pop-head">' +
      '<div class="tp-pop-term"></div>' +
      '<button class="tp-pop-close" aria-label="Close">&times;</button>' +
    '</div>' +
    '<div class="tp-pop-body"></div>';
  document.body.appendChild(pop);

  var hint = document.createElement("div");
  hint.id = "tp-hint";
  hint.textContent = "tip: tap any underlined term for its definition";
  document.body.appendChild(hint);
  /* Hide hint after first interaction */
  function hideHint() { hint.classList.add("tp-hide"); try { sessionStorage.setItem("tp-hint-seen", "1"); } catch(e) {} }
  hint.addEventListener("click", hideHint);
  try { if (sessionStorage.getItem("tp-hint-seen")) hint.classList.add("tp-hide"); } catch(e) {}

  var activeTerm = null;
  function closePopover() {
    pop.classList.remove("tp-show");
    backdrop.classList.remove("tp-show");
    if (activeTerm) activeTerm.classList.remove("tp-active");
    activeTerm = null;
  }

  function positionPopover(targetRect) {
    var W = window.innerWidth, H = window.innerHeight;
    var popW = pop.offsetWidth || 360;
    var popH = pop.offsetHeight || 160;
    /* Default: under the target, left-aligned */
    var top = targetRect.bottom + 8;
    var left = targetRect.left;
    if (left + popW > W - 12) left = W - popW - 12;
    if (left < 12) left = 12;
    /* If not enough room below, go above */
    if (top + popH > H - 12 && targetRect.top > popH + 16) {
      top = targetRect.top - popH - 8;
    }
    if (top < 12) top = 12;
    pop.style.top = top + "px";
    pop.style.left = left + "px";
  }

  function openPopover(termEl) {
    var kind = termEl.getAttribute("data-tp-kind");
    var key = termEl.getAttribute("data-tp-key");
    var entry = kind === "a" ? G.abbr[key] : G.terms[key];
    var sense = entry && entry.s[+termEl.getAttribute("data-tp-sense")];
    if (!sense) return;

    pop.querySelector(".tp-pop-term").textContent = kind === "a" ? key : entry.t;
    var body = pop.querySelector(".tp-pop-body");
    body.textContent = "";
    if (sense.x) {
      var exp = document.createElement("span");
      exp.className = "tp-pop-exp";
      exp.textContent = sense.x;
      body.appendChild(exp);
    }
    body.appendChild(document.createTextNode(sense.d));

    if (activeTerm) activeTerm.classList.remove("tp-active");
    termEl.classList.add("tp-active");
    activeTerm = termEl;

    pop.classList.add("tp-show");
    backdrop.classList.add("tp-show");
    /* needs to be visible to measure */
    pop.style.top = "-9999px";
    pop.style.left = "-9999px";
    requestAnimationFrame(function () {
      positionPopover(termEl.getBoundingClientRect());
    });
    hideHint();
  }

  /* Event delegation: tap a tp-term to open */
  root.addEventListener("click", function (e) {
    var t = e.target.closest(".tp-term");
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    /* re-tap on same active term closes */
    if (t === activeTerm) {
      closePopover();
      return;
    }
    openPopover(t);
  });

  /* Keyboard: enter/space activates */
  root.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var t = e.target.closest(".tp-term");
    if (!t) return;
    e.preventDefault();
    openPopover(t);
  });

  /* Tap outside closes */
  document.addEventListener("click", function (e) {
    if (!pop.classList.contains("tp-show")) return;
    if (pop.contains(e.target)) return;
    if (e.target.closest(".tp-term")) return; /* root handler runs */
    closePopover();
  });
  backdrop.addEventListener("click", closePopover);
  pop.querySelector(".tp-pop-close").addEventListener("click", function (e) {
    e.stopPropagation();
    closePopover();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closePopover();
  });
  /* Reposition on resize/scroll while open */
  function reposition() {
    if (!pop.classList.contains("tp-show") || !activeTerm) return;
    positionPopover(activeTerm.getBoundingClientRect());
  }
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, { passive: true });

  /* -------------------- 4. INIT -------------------- */

  function run() {
    G = window.TP_GLOSSARY;
    if (!G) return; /* glossary failed to load: underline nothing rather than guess */
    wrapBoldTerms();
    wrapAbbreviations();
  }

  function init() {
    /* Resolve sibling files relative to this script's path */
    var here = null;
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (src.indexOf("term-popover.js") !== -1) { here = src.replace(/term-popover\.js.*$/, ""); break; }
    }
    if (!here) here = "/sihan-met-flashcards/notes/";
    /* Inject CSS if it isn't on the page yet (defensive — pages should
       already include term-popover.css, but this keeps it working if a
       page forgot it). */
    if (!document.querySelector('link[href*="term-popover.css"]') &&
        !document.getElementById("tp-inline-style")) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.id = "tp-popover-link";
      link.href = here + "term-popover.css";
      document.head.appendChild(link);
    }
    if (window.TP_GLOSSARY) return run();
    var g = document.createElement("script");
    g.src = here + "term-glossary.js";
    g.onload = run;
    document.head.appendChild(g);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
