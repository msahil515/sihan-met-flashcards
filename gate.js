/* Lightweight passphrase gate for the whole site.
   Self-contained: injects its own overlay + styles, works on every page.

   IMPORTANT, no false sense of security: this is a *casual* lock only. The
   site is a public, static GitHub Pages build, so the page content is shipped
   inside every file. This stops someone clicking around or typing a URL; it
   does NOT stop someone who opens dev-tools / view-source and digs. For real
   protection the repo itself would have to be private. (Told Sihan this.)

   Unlock persists in localStorage so you only type it once per device. */
(function () {
  "use strict";

  // sha-256 hex of the passphrase. Change the passphrase by replacing this
  // hash: python3 -c "import hashlib;print(hashlib.sha256(b'NEWPASS').hexdigest())"
  var HASH = "38f0dbceac526551ec5ae49819440cfea5b350f60f1c363719b9a3107b0cb2f9";
  var KEY = "met-gate-v1";
  var root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember() {
    try { localStorage.setItem(KEY, HASH); } catch (e) {}
  }
  function reveal() {
    root.classList.remove("gate-locked");
    var ov = document.getElementById("met-gate-overlay");
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function sha256(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      var bytes = new Uint8Array(buf), out = "";
      for (var i = 0; i < bytes.length; i++) {
        out += bytes[i].toString(16).padStart(2, "0");
      }
      return out;
    });
  }

  // Already unlocked on this device: show immediately, no flash.
  if (stored() === HASH) { reveal(); return; }

  function buildPrompt() {
    if (document.getElementById("met-gate-overlay")) return;

    var style = document.createElement("style");
    style.textContent = ""
      + "#met-gate-overlay{position:fixed;inset:0;z-index:2147483647;"
      + "display:flex;align-items:center;justify-content:center;padding:24px;"
      + "background:#0d1117;color:#e6edf3;"
      + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}"
      + "#met-gate-overlay .gate-card{width:100%;max-width:340px;text-align:center;}"
      + "#met-gate-overlay .gate-mark{font-size:13px;letter-spacing:2px;font-weight:700;"
      + "color:#58a6ff;margin-bottom:10px;}"
      + "#met-gate-overlay h1{font-size:18px;font-weight:600;margin:0 0 4px;}"
      + "#met-gate-overlay p{font-size:13px;color:#8b949e;margin:0 0 18px;}"
      + "#met-gate-overlay input{width:100%;box-sizing:border-box;padding:12px 14px;"
      + "font-size:16px;border-radius:8px;border:1px solid #30363d;background:#161b22;"
      + "color:#e6edf3;outline:none;}"
      + "#met-gate-overlay input:focus{border-color:#1f6feb;}"
      + "#met-gate-overlay button{width:100%;margin-top:10px;padding:12px 14px;"
      + "font-size:15px;font-weight:600;border:none;border-radius:8px;cursor:pointer;"
      + "background:#1f6feb;color:#fff;}"
      + "#met-gate-overlay button:active{background:#1158c7;}"
      + "#met-gate-overlay .gate-err{min-height:16px;font-size:12px;color:#f85149;"
      + "margin-top:10px;}";

    var ov = document.createElement("div");
    ov.id = "met-gate-overlay";
    ov.innerHTML = ""
      + "<div class='gate-card'>"
      + "<div class='gate-mark'>MET PREP</div>"
      + "<h1>Locked</h1>"
      + "<p>Enter the passphrase to open.</p>"
      + "<input type='password' id='met-gate-input' autocomplete='current-password' "
      + "inputmode='text' autocapitalize='off' spellcheck='false' placeholder='Passphrase'>"
      + "<button id='met-gate-go' type='button'>Unlock</button>"
      + "<div class='gate-err' id='met-gate-err'></div>"
      + "</div>";

    root.appendChild(style);
    root.appendChild(ov); // on <html>, so it shows even while <body> is hidden

    var input = ov.querySelector("#met-gate-input");
    var err = ov.querySelector("#met-gate-err");
    var btn = ov.querySelector("#met-gate-go");

    function attempt() {
      var val = input.value || "";
      sha256(val).then(function (h) {
        if (h === HASH) { remember(); reveal(); }
        else {
          err.textContent = "Nope, try again.";
          input.value = "";
          input.focus();
        }
      });
    }
    btn.addEventListener("click", attempt);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); attempt(); }
    });
    setTimeout(function () { input.focus(); }, 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildPrompt);
  } else {
    buildPrompt();
  }
})();
