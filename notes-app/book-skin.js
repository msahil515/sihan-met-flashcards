/* book-skin.js — turns the warm book skin on for the Library.

   Sihan's call was "warm as the default, old look kept as an option", so:
   the skin is ON unless he has explicitly switched it off, and the switch
   in the app bar puts the old Reading Desk palette straight back.

   Loaded in <head> BEFORE app.css so html[data-book] is set on the very
   first paint — no flash of the old palette on open.

   It also mirrors the device light/dark setting into html[data-mode], which
   is what drives the warm-leather dark mode in book-skin.css and reader.css,
   and copies both attributes onto the reader iframe so the chapter page and
   its frame never disagree. */
(function () {
  "use strict";

  var KEY = "tlib:book";                 // "on" | "off"; absent = on (default)
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function pref() {
    var v;
    try { v = localStorage.getItem(KEY); } catch (e) { v = null; }
    return v === "off" ? "off" : "on";
  }

  function paintRoot() {
    root.setAttribute("data-book", pref());
    root.setAttribute("data-mode", mq && mq.matches ? "dark" : "light");
  }

  /* Copy the skin onto a reader iframe's document (same origin). Safe to call
     with a not-yet-loaded frame — it just no-ops. */
  function applyTo(frame) {
    var doc;
    try { doc = frame && frame.contentDocument; } catch (e) { return; }
    if (!doc || !doc.documentElement) return;
    doc.documentElement.setAttribute("data-book", root.getAttribute("data-book"));
    doc.documentElement.setAttribute("data-mode", root.getAttribute("data-mode"));
  }

  function label() { return pref() === "on" ? "Classic" : "Book"; }

  /* Refresh every switch app.js has rendered (it re-renders the bar on route). */
  function paintButtons() {
    var on = pref() === "on";
    Array.prototype.forEach.call(document.querySelectorAll(".bkbtn"), function (b) {
      var t = b.querySelector(".bklabel");
      if (t) t.textContent = label();
      b.setAttribute("title", on ? "Switch to the classic look" : "Switch to the warm book look");
      b.setAttribute("aria-label", b.getAttribute("title"));
    });
  }

  function set(v) {
    try { localStorage.setItem(KEY, v === "off" ? "off" : "on"); } catch (e) {}
    paintRoot();
    paintButtons();
    if (window.NFE && window.NFE.frame) applyTo(window.NFE.frame());
  }

  function toggle() { set(pref() === "on" ? "off" : "on"); }

  paintRoot();
  if (mq) {
    var onMode = function () {
      paintRoot();
      if (window.NFE && window.NFE.frame) applyTo(window.NFE.frame());
    };
    if (mq.addEventListener) mq.addEventListener("change", onMode);
    else if (mq.addListener) mq.addListener(onMode);
  }

  window.BookSkin = { pref: pref, set: set, toggle: toggle, applyTo: applyTo,
                      label: label, paintButtons: paintButtons };
})();
