/* book-skin.js: Day / Night / Auto for the Library.

   Loaded in <head> BEFORE app.css so html[data-mode] is right on the very
   first paint (no flash). "Auto" follows the device setting.

   The reader is an iframe, so both attributes are also copied onto the
   chapter page: data-book="on" switches on the warm book palette in
   reader.css, data-mode picks its day or night side. */
(function () {
  "use strict";

  var KEY = "lib:theme";                 // "auto" | "day" | "night"; absent = auto
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function pref() {
    var v;
    try { v = localStorage.getItem(KEY); } catch (e) { v = null; }
    return v === "day" || v === "night" ? v : "auto";
  }
  function mode() {
    var p = pref();
    if (p === "auto") return mq && mq.matches ? "dark" : "light";
    return p === "night" ? "dark" : "light";
  }

  function paintRoot() {
    root.setAttribute("data-book", "on");
    root.setAttribute("data-mode", mode());
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", mode() === "dark" ? "#0B120F" : "#1F3A32");
  }

  /* Copy the look onto a reader iframe's document (same origin). Safe to
     call with a frame that has not loaded yet: it just does nothing. */
  function applyTo(frame) {
    var doc;
    try { doc = frame && frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.documentElement) return;
    doc.documentElement.setAttribute("data-book", "on");
    doc.documentElement.setAttribute("data-mode", root.getAttribute("data-mode"));
  }

  function refresh() {
    paintRoot();
    if (window.NFE && window.NFE.frame) applyTo(window.NFE.frame());
    try { window.dispatchEvent(new Event("libtheme")); } catch (e) {}
  }

  function set(v) {
    try { localStorage.setItem(KEY, v === "day" || v === "night" ? v : "auto"); } catch (e) {}
    refresh();
  }

  paintRoot();
  if (mq) {
    var onDevice = function () { if (pref() === "auto") refresh(); };
    if (mq.addEventListener) mq.addEventListener("change", onDevice);
    else if (mq.addListener) mq.addListener(onDevice);
  }

  window.BookSkin = { pref: pref, mode: mode, set: set, applyTo: applyTo };
})();
