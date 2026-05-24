/* Minimizable top nav.
   Self-contained: injects its own styles + a toggle button, so it works on
   every page regardless of whether the page links site.css or has inline CSS.
   State persists in localStorage so the nav stays the way you left it as you
   move between pages and after a reload. */
(function () {
  "use strict";

  var KEY = "met-nav-collapsed";
  var root = document.documentElement;

  // Apply the saved state to <html> as early as possible to limit flashing.
  function isCollapsed() {
    try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }
  function save(collapsed) {
    try { localStorage.setItem(KEY, collapsed ? "1" : "0"); } catch (e) {}
  }
  if (isCollapsed()) root.classList.add("nav-min");

  // Inject styles once.
  var css = ""
    + ".nav-toggle-btn{display:inline-flex;align-items:center;gap:6px;"
    + "cursor:pointer;border:1px solid var(--border,#30363d);"
    + "background:var(--panel,#161b22);color:var(--text,#e6edf3);"
    + "border-radius:6px;padding:6px 11px;font-size:13px;font-weight:600;"
    + "line-height:1;font-family:inherit;-webkit-appearance:none;appearance:none;}"
    + ".nav-toggle-btn:hover{border-color:var(--accent-dim,#1f6feb);"
    + "color:var(--accent,#58a6ff);}"
    + ".nav-toggle-btn .nav-toggle-ico{font-size:14px;line-height:1;}"
    + ".nav-toggle-label{white-space:nowrap;}"
    /* Collapsed: hide the link list, keep the brand + toggle on the bar. */
    + "html.nav-min .topbar .nav{display:none!important;}"
    + "html.nav-min .topbar nav.nav{display:none!important;}"
    /* Order the button to sit just before the countdown chip / right edge. */
    + ".nav-toggle-btn{order:5;}";
  var style = document.createElement("style");
  style.setAttribute("data-nav-toggle", "");
  style.textContent = css;
  document.head.appendChild(style);

  function build() {
    var bar = document.querySelector(".topbar .topbar-inner") ||
              document.querySelector(".topbar");
    if (!bar) return;
    var navEl = bar.querySelector(".nav") || bar.querySelector("nav");
    if (!navEl) return;
    if (bar.querySelector(".nav-toggle-btn")) return; // already built

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-toggle-btn";
    btn.setAttribute("aria-controls", "");
    btn.innerHTML = '<span class="nav-toggle-ico" aria-hidden="true">☰</span>'
                  + '<span class="nav-toggle-label"></span>';
    var label = btn.querySelector(".nav-toggle-label");
    var ico = btn.querySelector(".nav-toggle-ico");

    function render() {
      var collapsed = root.classList.contains("nav-min");
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.title = collapsed ? "Show menu" : "Hide menu";
      label.textContent = collapsed ? "Menu" : "Hide";
      ico.textContent = collapsed ? "☰" : "✕"; // hamburger / x
    }

    btn.addEventListener("click", function () {
      var collapsed = root.classList.toggle("nav-min");
      save(collapsed);
      render();
    });

    // Place the button right before the countdown chip if present, else at end.
    var chip = bar.querySelector(".countdown-chip");
    if (chip) bar.insertBefore(btn, chip);
    else bar.appendChild(btn);

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
