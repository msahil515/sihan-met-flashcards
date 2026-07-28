/* ============================================================
   book-theme.js — turns the warm book skin on (and off).

   Warm is the DEFAULT for the whole notes library: this runs in
   <head>, so html[data-book="on"] is set before first paint and
   there's no white flash. The old dashboard look is one tap away
   via the "Book / Classic" control, which mounts into the page's
   nav bar (falling back to a bottom-left pill on pages without
   one — take/theme.js already owns bottom-right).

   Choice is remembered in localStorage across every notes page.
   ============================================================ */
(function () {
  "use strict";

  var KEY = "notes-book-theme";      /* "on" (default) | "off" */
  var root = document.documentElement;

  function read() {
    try { return localStorage.getItem(KEY) === "off" ? "off" : "on"; }
    catch (e) { return "on"; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
  function apply(v) { root.setAttribute("data-book", v); }

  /* before paint */
  apply(read());

  function label(btn) {
    var on = root.getAttribute("data-book") === "on";
    btn.textContent = on ? "📖 Book" : "▢ Classic";
    btn.title = on
      ? "Warm book colours are on — tap for the classic look"
      : "Classic look — tap for warm book colours";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function mount() {
    if (document.querySelector(".bk-toggle")) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bk-toggle";
    btn.setAttribute("aria-label", "Toggle warm book colours");
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var next = root.getAttribute("data-book") === "on" ? "off" : "on";
      apply(next);
      write(next);
      label(btn);
    });

    /* the dashboard-style pages carry .topbar .nav; the chapter pages
       open with a plain <nav> inside .wrap. Either is a good home. */
    var host = document.querySelector(".topbar-inner .nav") ||
               document.querySelector(".wrap > nav") ||
               document.querySelector("nav");
    if (host) {
      host.appendChild(btn);
    } else {
      btn.classList.add("bk-float");
      document.body.appendChild(btn);
    }
    label(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
