/* study.js: the shared "To study" list behind the "Study this" buttons in the
   Tests app and Name Lock. One localStorage key, study-topics-v1, which sync.js
   carries between devices and between the two apps (same sync code), merging
   per topic by last edit, so a topic marked anywhere shows up everywhere.
   Shape: {it: {<id>: {t, a, f, q, r, n, at, u, d, x}}}
     t topic, a area key, f where it came from, q the question/definition,
     r ref ("m:<mock>:<idx>" or "c:<cardId>"), n notes search words,
     at added ms, u last edit ms, d done ms (0 = still to study), x removed. */
(function () {
  "use strict";
  var KEY = "study-topics-v1";
  var AREAS = [["general", "General Psychology"], ["assessment", "Assessment"], ["social", "Social"], ["personality", "Personality"],
    ["physio", "Biological / Physiological"], ["dev", "Developmental"], ["clinical", "Clinical / Therapy"], ["disorders", "Disorders / Psychopathology"],
    ["research", "Research + Stats"], ["other", "Other"]];
  var AREA_NAME = {}; AREAS.forEach(function (a) { AREA_NAME[a[0]] = a[1]; });
  /* any section key/label (every mock names them differently) or Name Lock area -> one of the AREAS */
  var RULES = [[/abnormal|psychopath|disorder|psychiatr/, "disorders"], [/research|stat|method/, "research"],
    [/personal|psychodyn|defen|humanist/, "personality"], [/assess|psychometr|testing/, "assessment"], [/bio|physio|neuro/, "physio"],
    [/develop|\bdev\b/, "dev"], [/social/, "social"], [/clinical|therap|counsel/, "clinical"],
    [/general|cognit|learning|memory|perception|history|systems|behavio|indian|positive|conscious|gestalt/, "general"]];
  function areaOf(s) {
    s = String(s || "").toLowerCase();
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(s)) return RULES[i][1];
    return "other";
  }

  function read() {
    var o; try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!o || typeof o !== "object") o = {};
    if (!o.it || typeof o.it !== "object") o.it = {};
    return o;
  }
  function write(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("study-change")); } catch (e) {}
  }
  function edit(id, fn) {
    var o = read(), it = o.it[id];
    if (!it) return null;
    fn(it); it.u = Date.now(); write(o); return it;
  }

  function has(id) { var it = read().it[id]; return !!(it && !it.x); }
  function get(id) { var it = read().it[id]; return it && !it.x ? it : null; }
  function add(x) {
    var o = read(), now = Date.now(), old = o.it[x.id];
    o.it[x.id] = { t: String(x.t || "Untitled topic").slice(0, 120), a: x.a || "other", f: x.f || "", q: String(x.q || "").slice(0, 400),
      r: x.r || "", n: x.n || "", at: old && !old.x ? old.at : now, u: now, d: 0, x: 0 };
    write(o); return o.it[x.id];
  }
  function remove(id) { return edit(id, function (it) { it.x = 1; }); }
  function toggle(x) { if (has(x.id)) { remove(x.id); return false; } add(x); return true; }
  function setDone(id, on) { return edit(id, function (it) { it.d = on ? Date.now() : 0; }); }
  function rename(id, t) { return edit(id, function (it) { it.t = String(t).slice(0, 120); }); }
  function all() {
    var o = read(), out = [];
    for (var id in o.it) { var it = o.it[id]; if (it && !it.x) out.push(Object.assign({ id: id }, it)); }
    return out;
  }
  function counts() { var a = all(), d = a.filter(function (x) { return x.d; }).length; return { open: a.length - d, done: d, all: a.length }; }

  /* ---------- notes link: the Library app's search, on the live site inside the APKs ---------- */
  var SITE = "https://msahil515.github.io/sihan-met-flashcards/";
  var STUDY_SCRIPT_URL = document.currentScript && document.currentScript.src || "";
  var ROOT = (function () {
    var s = STUDY_SCRIPT_URL;
    if (!s || /androidplatform\.net/.test(s)) return SITE;
    return s.replace(/study\.js(\?.*)?$/, "");
  })();
  var STOP = { the: 1, of: 1, and: 1, vs: 1, in: 1, a: 1, an: 1, to: 1, for: 1, how: 1, its: 1, it: 1, what: 1, is: 1, on: 1, by: 1, with: 1, from: 1, theory: 1 };
  function notesQuery(s) {
    var w = String(s || "").toLowerCase().replace(/[’']s\b/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ")
      .filter(function (x) { return x.length > 1 && !STOP[x]; });
    return w.slice(0, 4).join(" ");
  }
  function notesUrl(it) { return ROOT + "notes-app/#/search/" + encodeURIComponent(it.n || notesQuery(it.t)); }

  /* ---------- edition-bound reviewed teaching-page references ---------- */
  var PAGE_URL = "";
  try { if (STUDY_SCRIPT_URL) PAGE_URL = new URL("study-pages.json", STUDY_SCRIPT_URL).href; } catch (e) {}
  var PAGE_STATE = "idle", PAGE_MAP = null, PAGE_PROMISE = null, PAGE_SECTIONS = {};
  var PAGE_PDF = "https://msahil515.github.io/sihan-met-flashcards/downloads/final-textbook/Final-Exam-Textbook-BW.pdf";
  function plainText(value) {
    var node = document.createElement("div"); node.innerHTML = String(value == null ? "" : value);
    return String(node.textContent || "").trim();
  }
  function validPageMap(data) {
    if (!data || data.schemaVersion !== 2 || !data.edition || data.edition.sha256 !== "fa29764869e9551e9f6049bcd6b1badf6df59ab6c6bab34594e2e5b0980516e8" ||
        data.edition.pageCount !== 975 || !Array.isArray(data.sections) || !data.refs || typeof data.refs !== "object" || Array.isArray(data.refs)) return false;
    var sections = {};
    for (var i = 0; i < data.sections.length; i++) {
      var section = data.sections[i];
      if (!section || typeof section.id !== "string" || !section.id || typeof section.title !== "string" || !section.title || sections[section.id]) return false;
      sections[section.id] = section.title;
    }
    var keys = Object.keys(data.refs);
    for (var j = 0; j < keys.length; j++) {
      var ref = data.refs[keys[j]], source = ref && ref.source, options = source && source.options;
      if (!source || typeof source.stem !== "string" || !source.stem.trim() || !options || typeof options !== "object" ||
          Object.keys(options).sort().join("") !== "abcd" || ["a", "b", "c", "d"].some(function (k) { return typeof options[k] !== "string"; }) ||
          !/^[abcd]$/.test(source.correct) || !Array.isArray(ref.locations) || !ref.locations.length) return false;
      for (var k = 0; k < ref.locations.length; k++) {
        var loc = ref.locations[k], pages = loc && loc.pages;
        if (!loc || !sections[loc.sectionId] || !Array.isArray(pages) || !pages.length) return false;
        for (var p = 0; p < pages.length; p++) if (!Number.isInteger(pages[p]) || pages[p] < 1 || pages[p] > data.edition.pageCount || (p && pages[p] <= pages[p - 1])) return false;
      }
    }
    PAGE_SECTIONS = sections;
    return true;
  }
  function loadPageMap() {
    if (PAGE_PROMISE) return PAGE_PROMISE;
    PAGE_STATE = "loading";
    if (!PAGE_URL || !window.fetch) {
      PAGE_STATE = "unavailable"; PAGE_PROMISE = Promise.resolve(PAGE_STATE); return PAGE_PROMISE;
    }
    PAGE_PROMISE = Promise.resolve().then(function () { return window.fetch(PAGE_URL); }).then(function (response) {
      if (!response || !response.ok) throw new Error("page map unavailable");
      return response.json();
    }).then(function (data) {
      if (!validPageMap(data)) throw new Error("page map validation failed");
      PAGE_MAP = data; PAGE_STATE = "ready"; return PAGE_STATE;
    }).catch(function () { PAGE_MAP = null; PAGE_STATE = "unavailable"; return PAGE_STATE; });
    return PAGE_PROMISE;
  }
  function resolvePage(it) {
    if (PAGE_STATE === "idle" || PAGE_STATE === "loading") return { state: "loading", locations: [] };
    if (PAGE_STATE !== "ready" || !PAGE_MAP) return { state: "unavailable", locations: [] };
    var mapping = it && PAGE_MAP.refs[it.r];
    if (!mapping) return { state: "none", locations: [] };
    var stored = String(it.q || ""), expected = mapping.source.stem.slice(0, 400);
    if (!stored || stored !== expected) return { state: "saved-mismatch", locations: [] };
    if (window.PREVIEW_MOCKS) {
      var match = /^m:([^:]+):(\d+)$/.exec(it.r), questions = match && window.PREVIEW_MOCKS[match[1]] && window.PREVIEW_MOCKS[match[1]].questions;
      var q = questions && questions[+match[2]];
      if (!q || plainText(q.q) !== mapping.source.stem || ["a", "b", "c", "d"].some(function (key) {
        return plainText(q.options && q.options[key]) !== mapping.source.options[key];
      }) || q.correct !== mapping.source.correct) return { state: "source-mismatch", locations: [] };
    }
    return { state: "matched", locations: mapping.locations };
  }
  function pageLabel(pages) {
    if (pages.length > 1 && pages.every(function (page, index) { return !index || page === pages[index - 1] + 1; })) return pages[0] + "-" + pages[pages.length - 1];
    return pages.join(", ");
  }
  function pageLine(it) {
    var result = resolvePage(it);
    if (result.state === "matched") return result.locations.map(function (loc) {
      var pages = pageLabel(loc.pages), label = "Original textbook p" + (loc.pages.length > 1 ? "p. " : ". ") + pages;
      return '<div><a href="' + PAGE_PDF + "#page=" + loc.pages[0] + '" target="_blank" rel="noopener">' + esc(label) + "</a> · " + esc(PAGE_SECTIONS[loc.sectionId]) + "</div>";
    }).join("");
    var messages = { loading: "Page references loading…", unavailable: "Page references unavailable. Notes remain available.",
      none: "No verified page match yet.", "saved-mismatch": "Saved question does not match the reviewed source. Notes remain available.",
      "source-mismatch": "Current question source changed. Notes remain available." };
    return esc(messages[result.state] || messages.none);
  }
  function exportPageText(it) {
    var result = resolvePage(it);
    if (result.state === "matched") return result.locations.map(function (loc) {
      return "Original textbook p" + (loc.pages.length > 1 ? "p. " : ". ") + pageLabel(loc.pages) + " · " + (PAGE_SECTIONS[loc.sectionId] || loc.sectionId);
    }).join("\n");
    return ({ loading: "Page references loading…", unavailable: "Page references unavailable; Notes remain available.",
      none: "No verified page match yet.", "saved-mismatch": "Saved question does not match reviewed source; Notes remain available.",
      "source-mismatch": "Current question source changed; Notes remain available." })[result.state] || "No verified page match yet.";
  }
  var pageRenderSequence = 0;
  function refreshPageReferences(el, token) {
    if (el._studyPageRenderSequence !== token || el.isConnected === false ||
        (typeof document.contains === "function" && !document.contains(el))) return;
    var items = all();
    el.querySelectorAll(".stl-page[data-id]").forEach(function (node) {
      var it = items.find(function (item) { return item.id === node.getAttribute("data-id"); });
      if (it) node.innerHTML = pageLine(it);
    });
    el.querySelectorAll(".stl-map-status").forEach(function (node) {
      node.textContent = PAGE_STATE === "ready" ? "Original textbook · reviewed page references" :
        PAGE_STATE === "loading" ? "Page references loading…" : "Original textbook · page references unavailable";
    });
    var textarea = el.querySelector(".stl-export textarea");
    if (textarea && (document.activeElement !== textarea || textarea.selectionStart === textarea.selectionEnd)) {
      textarea.value = exportText(ordered(items, FILTER), FILTER);
    }
  }

  /* ---------- the "To study" screen (same markup in both apps, themed by their CSS vars) ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var CSS = ".stl{padding-bottom:24px}.stl-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:4px 2px 10px}.stl-h h1{margin:0;font-size:26px;font-weight:900}" +
    ".stl-h span{color:var(--mu);font-weight:800;font-size:13px}.stl-seg{display:flex;gap:6px;margin:0 0 12px}.stl-seg button{flex:1;padding:10px 6px;border-radius:12px;border:1.5px solid var(--line);background:var(--s1);color:var(--mu);font:800 14px var(--sans,inherit)}" +
    ".stl-seg button.on{color:var(--tx);border-color:var(--brand);background:var(--s2)}.stl-add{display:flex;gap:8px;margin:0 0 14px}.stl-add input{flex:1;min-width:0;padding:12px;border-radius:12px;border:1.5px solid var(--line);background:var(--s1);color:var(--tx);font:700 15px var(--sans,inherit)}" +
    ".stl-add button{padding:0 16px;border-radius:12px;border:0;background:var(--brand);color:#fff;font:900 15px var(--sans,inherit)}.stl-area{margin:16px 2px 8px;font-size:13px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--mu);display:flex;justify-content:space-between}" +
    ".stl-it{display:flex;gap:12px;align-items:flex-start;padding:12px;margin:0 0 8px;border-radius:14px;background:var(--s1);border:1.5px solid var(--line)}.stl-it.done{opacity:.55}.stl-it.done .stl-t{text-decoration:line-through}" +
    ".stl-ck{flex:none;width:28px;height:28px;border-radius:9px;border:2px solid var(--mu);background:none;color:#fff;font:900 16px/24px var(--sans,inherit);padding:0;margin-top:1px}.stl-it.done .stl-ck{background:var(--ok);border-color:var(--ok)}" +
    ".stl-b{flex:1;min-width:0}.stl-t{font-weight:900;font-size:16px;line-height:1.3;color:var(--tx)}.stl-f{color:var(--mu);font-size:12.5px;font-weight:700;margin-top:3px}.stl-q{color:var(--mu);font-size:13.5px;margin-top:6px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
    ".stl-ac{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.stl-ac a,.stl-ac button{padding:7px 11px;border-radius:10px;border:1.5px solid var(--line);background:var(--s2);color:var(--tx);font:800 13px var(--sans,inherit);text-decoration:none}" +
    ".stl-ac a{border-color:var(--brand)}.stl-ac .stl-x{color:var(--bad);background:none}.stl-empty{text-align:center;color:var(--mu);font-weight:700;padding:28px 12px;line-height:1.5}" +
    ".stl-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:999px;border:1.5px solid var(--gold);background:none;color:var(--gold);font:900 13px var(--sans,inherit);cursor:pointer}" +
    ".stl-page{margin-top:7px;color:var(--mu);font-size:13px;font-weight:700;line-height:1.45}.stl-page a{color:var(--brand)}.stl-map-status{display:block;margin:-5px 0 10px;color:var(--mu);font-size:12px;font-weight:700}.stl-btn.on{background:var(--gold);color:#1a1300}.stl-export-toggle{padding:9px 12px;margin:0 0 12px;border:1.5px solid var(--brand);border-radius:10px;background:var(--s1);color:var(--tx);font:800 14px var(--sans,inherit)}" +
    ".stl-export{margin:12px 0;padding:12px;border:1.5px solid var(--line);border-radius:14px;background:var(--s1)}" +
    ".stl-export h2{margin:0 0 6px;font-size:17px}.stl-export p{margin:0 0 10px;color:var(--mu);font-size:13px;line-height:1.4}.stl-export textarea{display:block;width:100%;box-sizing:border-box;min-height:220px;padding:10px;border:1.5px solid var(--line);border-radius:10px;background:var(--s2);color:var(--tx);font:13px/1.45 var(--sans,monospace);white-space:pre;overflow:auto;user-select:text}" +
    ".stl-export-ac{display:flex;gap:8px;margin-top:8px}.stl-export-ac button{padding:8px 12px;border:1.5px solid var(--line);border-radius:10px;background:var(--s2);color:var(--tx);font:800 13px var(--sans,inherit)}.stl-export-status{min-height:1.3em;margin-top:8px;color:var(--mu);font-size:13px}";
  function injectCSS() {
    if (document.getElementById("stl-css")) return;
    var st = document.createElement("style"); st.id = "stl-css"; st.textContent = CSS; document.head.appendChild(st);
  }
  /* the "Study this" toggle: markup + a delegated click handler that flips it in place */
  function buttonHTML(id) {
    injectCSS();
    var on = has(id);
    return '<button class="stl-btn' + (on ? " on" : "") + '" data-study="' + esc(id) + '">' + (on ? "★ In To study" : "☆ Study this") + "</button>";
  }
  function paintButtons(root) {
    (root || document).querySelectorAll("[data-study]").forEach(function (b) {
      var on = has(b.getAttribute("data-study"));
      b.classList.toggle("on", on); b.textContent = on ? "★ In To study" : "☆ Study this";
    });
  }
  /* opts: {filter: "open"|"done"|"all", open(it) -> bool (the app can open the source), onChange()} */
  var FILTER = "open";
  function ordered(items, filter) {
    var shown = items.filter(function (x) { return filter === "all" ? true : filter === "done" ? !!x.d : !x.d; });
    return AREAS.reduce(function (out, a) {
      return out.concat(shown.filter(function (x) { return x.a === a[0]; }).sort(function (p, q) {
        return (!!p.d - !!q.d) || q.at - p.at;
      }));
    }, []);
  }
  function exportText(items, filter) {
    var names = { open: "To study", done: "Done", all: "All" };
    var rows = ordered(items, filter), date = new Date(), day = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    var out = ["To study list", "Exported: " + day, "Filter: " + names[filter], "Entries: " + rows.length,
      "Edition: Original textbook. Page numbers are reviewed teaching-page references.", PAGE_STATE === "loading" || PAGE_STATE === "idle" ? "Page references loading…" :
        PAGE_STATE === "unavailable" ? "Page references unavailable; the list remains usable." : "", ""];
    rows.forEach(function (x, i) {
      out.push((i + 1) + ". " + x.t, "Area: " + (AREA_NAME[x.a] || AREA_NAME.other), "Source: " + (x.f || "Not recorded"),
        "Original question/definition: " + (x.q || "Not recorded"), "Reference ID: " + (x.r || "Not recorded"), "Pages: " + exportPageText(x),
        "Status: " + (x.d ? "Done" : "To study"), "");
    });
    return out.join("\n").replace(/\n+$/, "");
  }
  function render(el, opts) {
    injectCSS(); opts = opts || {};
    var renderToken = ++pageRenderSequence;
    el._studyPageRenderSequence = renderToken;
    var items = all(), c = counts(), f = FILTER, shown = ordered(items, f), exportOpen = !!el._studyExportOpen;
    var groups = {}; shown.forEach(function (x) { (groups[x.a] = groups[x.a] || []).push(x); });
    var h = '<div class="stl"><div class="stl-h"><h1>To study</h1><span>' + c.open + " to go · " + c.done + " done</span></div>" +
      '<span class="stl-map-status">' + (PAGE_STATE === "unavailable" ? "Original textbook · page references unavailable" :
        PAGE_STATE === "ready" ? "Original textbook · reviewed page references" : "Page references loading…") + "</span>" +
      '<div class="stl-seg"><button data-f="open" class="' + (f === "open" ? "on" : "") + '">To study ' + c.open + '</button><button data-f="done" class="' + (f === "done" ? "on" : "") +
      '">Done ' + c.done + '</button><button data-f="all" class="' + (f === "all" ? "on" : "") + '">All ' + c.all + "</button></div>" +
      '<button class="stl-export-toggle" type="button">' + (exportOpen ? "Close export" : "Export list") + "</button>" +
      '<div class="stl-add"><input id="stl-new" maxlength="120" placeholder="Add a topic yourself"><button id="stl-addb">Add</button></div>';
    if (!shown.length) h += '<div class="stl-empty">' + (c.all ? (f === "done" ? "Nothing ticked off yet." : "All done. Nothing left to study.") :
      "Nothing here yet. Tap <b>☆ Study this</b> on any question in the Tests app or any card in Name Lock and the topic lands here, grouped by area, with a link to its notes.") + "</div>";
    AREAS.forEach(function (a) {
      var g = groups[a[0]]; if (!g) return;
      h += '<div class="stl-area"><span>' + esc(a[1]) + "</span><span>" + g.length + "</span></div>" + g.map(function (x) {
        return '<div class="stl-it' + (x.d ? " done" : "") + '" data-id="' + esc(x.id) + '"><button class="stl-ck" data-a="done" aria-label="Done">' + (x.d ? "✓" : "") + "</button>" +
          '<div class="stl-b"><div class="stl-t">' + esc(x.t) + '</div><div class="stl-f">' + esc(x.f) + "</div>" + (x.q ? '<div class="stl-q">' + esc(x.q) + "</div>" : "") +
          '<div class="stl-page" data-page-ref data-id="' + esc(x.id) + '">' + pageLine(x) + "</div>" +
          '<div class="stl-ac"><a href="' + esc(notesUrl(x)) + '" target="_blank" rel="noopener">📖 Notes</a>' +
          (opts.canOpen && opts.canOpen(x) ? '<button data-a="open">' + (x.r.charAt(0) === "c" ? "Card" : "Question") + "</button>" : "") +
          '<button data-a="ren">Rename</button><button class="stl-x" data-a="rm">Remove</button></div></div></div>';
      }).join("");
    });
    if (exportOpen) h += '<section class="stl-export" aria-label="Export list"><h2>Copyable list, ' + esc({ open: "To study", done: "Done", all: "All" }[f]) + "</h2>" +
      '<p>Use Copy or select the text below.</p><textarea readonly aria-label="Selectable exported study list" spellcheck="false"></textarea>' +
      '<div class="stl-export-ac"><button type="button" data-export-copy>Copy</button></div><div class="stl-export-status" role="status" aria-live="polite"></div></section>';
    el.innerHTML = h + "</div>";
    function redraw() { render(el, opts); if (opts.onChange) opts.onChange(); }
    el.querySelectorAll(".stl-seg button").forEach(function (b) { b.onclick = function () { FILTER = b.getAttribute("data-f"); render(el, opts); }; });
    el.querySelector(".stl-export-toggle").onclick = function () { el._studyExportOpen = !exportOpen; render(el, opts); };
    if (exportOpen) {
      var textarea = el.querySelector(".stl-export textarea"), status = el.querySelector(".stl-export-status");
      textarea.value = exportText(items, f);
      el.querySelector("[data-export-copy]").onclick = function () {
        function fallback() {
          textarea.focus(); textarea.select();
          var copied = false;
          try { copied = !!document.execCommand("copy"); } catch (e) {}
          status.textContent = copied ? "Copied." : "Copy unavailable. Select and copy the text above.";
        }
        var clipboard = window.navigator && window.navigator.clipboard;
        if (!clipboard || !clipboard.writeText) { fallback(); return; }
        Promise.resolve().then(function () { return clipboard.writeText(textarea.value); }).then(function () {
          status.textContent = "Copied.";
        }).catch(fallback);
      };
    }
    var inp = el.querySelector("#stl-new");
    el.querySelector("#stl-addb").onclick = function () {
      var t = inp.value.trim(); if (!t) return;
      add({ id: "u:" + Date.now().toString(36), t: t, a: areaOf(t), f: "Added by you" }); FILTER = "open"; redraw();
    };
    inp.onkeydown = function (e) { if (e.key === "Enter") el.querySelector("#stl-addb").onclick(); };
    el.querySelectorAll(".stl-it [data-a]").forEach(function (b) {
      b.onclick = function () {
        var id = b.closest(".stl-it").getAttribute("data-id"), it = get(id), a = b.getAttribute("data-a");
        if (!it) return;
        if (a === "done") setDone(id, !it.d);
        else if (a === "rm") remove(id);
        else if (a === "ren") { var t = prompt("Rename this topic", it.t); if (!t || !t.trim()) return; rename(id, t.trim()); }
        else if (a === "open") { opts.open(Object.assign({ id: id }, it)); return; }
        redraw();
      };
    });
    loadPageMap().then(function () { refreshPageReferences(el, renderToken); });
  }

  window.StudyList = { KEY: KEY, AREAS: AREAS, areaName: function (k) { return AREA_NAME[k] || AREA_NAME.other; }, areaOf: areaOf,
    has: has, get: get, add: add, remove: remove, toggle: toggle, setDone: setDone, rename: rename, all: all, counts: counts,
    notesUrl: notesUrl, notesQuery: notesQuery, buttonHTML: buttonHTML, paintButtons: paintButtons, render: render,
    loadPageMap: loadPageMap, resolvePage: resolvePage, exportText: exportText,
    pageState: function () { return PAGE_STATE; }, pageAssetURL: PAGE_URL };
})();
