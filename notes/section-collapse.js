/* Collapsible section index for the long reading pages (textbook, master,
   lookalikes). The "Jump to" list at the top of these pages is handy on a
   laptop where there's width to spare, but on a phone it sits across the top
   eating the screen, and the textbook's copy was position:sticky so it
   overlaid the text when opened. This gives the list a real collapse on phones:
   it folds flat out of the way by default so the reading column gets the full
   width, and a "Jump to sections" button opens it inline (pushing the page
   down, never overlapping) and auto-closes once you pick a section. On
   laptop/tablet (>=1081px) the list always shows inline, exactly as before.
   Self-contained: injects its own CSS. State persists per page in localStorage. */
(function () {
  "use strict";

  var WIDE = 1081; // matches the textbook's existing desktop breakpoint
  function isPhone() {
    return window.matchMedia("(max-width:" + (WIDE - 1) + "px)").matches;
  }

  // The jump list is one of these, whichever the page uses.
  var list = document.querySelector("details.toc, div.toc, div.jump");
  if (!list) return;

  var KEY = "sec-collapse:" + location.pathname;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  // Inject styles once. The button only appears on phones; on wide screens the
  // list is forced visible and the button hidden, so nothing changes there.
  var css = ""
    + ".secx-btn{display:none;align-items:center;gap:8px;cursor:pointer;"
    + "border:1px solid var(--border,#30363d);background:var(--panel,#161b22);"
    + "color:var(--accent,#58a6ff);border-radius:999px;padding:9px 16px;"
    + "font-size:13px;font-weight:600;line-height:1;font-family:inherit;"
    + "margin:16px 0 8px;-webkit-appearance:none;appearance:none;}"
    + ".secx-btn:hover{border-color:var(--accent,#58a6ff);}"
    + ".secx-btn .secx-ico{font-size:11px;line-height:1;transition:transform .15s ease;}"
    + ".secx-btn[aria-expanded='true'] .secx-ico{transform:rotate(90deg);}"
    + "@media(max-width:" + (WIDE - 1) + "px){"
    +   ".secx-btn{display:inline-flex;}"
    +   "details.toc{position:static!important;}" /* kill the sticky overlay */
    +   ".secx-collapsed{display:none!important;}"
    + "}";
  var style = document.createElement("style");
  style.setAttribute("data-section-collapse", "");
  style.textContent = css;
  document.head.appendChild(style);

  // The textbook list is a native <details> that already collapses. Just stop
  // it overlaying (CSS above) and snap it shut after a jump on phones.
  if (list.tagName.toLowerCase() === "details") {
    list.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a[href^='#']") : null;
      if (a && isPhone()) list.removeAttribute("open");
    });
    return;
  }

  // Plain <div> lists (master, lookalikes): build the collapse around them.
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "secx-btn";
  btn.innerHTML = '<span class="secx-ico" aria-hidden="true">▸</span>'
                + '<span class="secx-label">Jump to sections</span>';
  list.parentNode.insertBefore(btn, list);

  function setOpen(open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) list.classList.remove("secx-collapsed");
    else list.classList.add("secx-collapsed");
    save(open ? "1" : "0");
  }

  // Collapsed by default on phones (so the reading area is full width); the
  // saved state lets it stay open if the reader pinned it open. On wide screens
  // the CSS forces the list visible regardless, so this is phone-only in effect.
  setOpen(saved() === "1");

  btn.addEventListener("click", function () {
    setOpen(btn.getAttribute("aria-expanded") !== "true");
  });

  // Pick a section -> fold the list away again so the text gets the screen.
  list.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[href^='#']") : null;
    if (a && isPhone()) setOpen(false);
  });
})();
