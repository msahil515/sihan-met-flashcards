/* Force-sync button for the MET prep app.
   Self-contained: injects its own styles, button, and toast, so it works on
   every page that loads this script (gate.js sister pattern).

   What it does on tap:
     1. Unregister every service worker registration.
     2. Delete every cache the browser holds for this origin.
     3. Reload the current URL with a ?s=<ts> cache-buster so the document
        itself can't come from the HTTP cache.
     4. After the reload, surface a "Synced to latest" toast.

   This is the manual escape hatch when Sihan's installed PWA gets stuck on a
   stale build. The SW already swaps cache versions on each deploy, so this
   should be rarely needed, but it's the same ↻ control he asked for and got
   on the psych-notes app. */
(function () {
  "use strict";

  if (window.__metForceSyncMounted) return;
  window.__metForceSyncMounted = true;

  var BTN_ID = "met-force-sync-btn";
  var TOAST_ID = "met-force-sync-toast";
  var FLAG = "metJustSynced";

  // The live site this app mirrors. When the button is tapped INSIDE the
  // installed APK (served from the offline WebView asset host below), a plain
  // reload would just re-show the bundled build. So in that case we cross over
  // to the live site to actually pull the newest content. On the live site
  // itself the button keeps doing a normal same-origin cache-bust reload.
  var LIVE_ORIGIN = "https://msahil515.github.io";
  var APK_HOST = "appassets.local";   // WebViewAssetLoader virtual host
  function inApkShell() {
    return location.hostname === APK_HOST;
  }

  function injectStyles() {
    if (document.getElementById("met-force-sync-style")) return;
    var css =
      "#" + BTN_ID + "{position:fixed;right:16px;bottom:16px;z-index:2147483646;" +
        "width:44px;height:44px;border-radius:50%;border:1px solid var(--border,#30363d);" +
        "background:var(--panel,#161b22);color:var(--muted,#8b949e);" +
        "display:inline-flex;align-items:center;justify-content:center;cursor:pointer;" +
        "box-shadow:0 6px 18px rgba(0,0,0,0.35);transition:color .15s,border-color .15s,transform .15s;" +
        "-webkit-tap-highlight-color:transparent;}" +
      "#" + BTN_ID + ":hover{color:var(--accent,#58a6ff);border-color:var(--accent-dim,#1f6feb);" +
        "transform:translateY(-1px);}" +
      "#" + BTN_ID + ":active{transform:translateY(0);}" +
      "#" + BTN_ID + " svg{width:20px;height:20px;display:block;}" +
      "#" + BTN_ID + ".spin svg{animation:metForceSyncSpin .7s linear infinite;}" +
      "@keyframes metForceSyncSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}" +
      "#" + TOAST_ID + "{position:fixed;left:50%;bottom:74px;transform:translate(-50%,8px);" +
        "z-index:2147483647;background:var(--panel,#161b22);color:var(--text,#e6edf3);" +
        "border:1px solid var(--border,#30363d);border-radius:10px;padding:10px 14px;" +
        "font:500 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
        "box-shadow:0 10px 28px rgba(0,0,0,0.45);opacity:0;pointer-events:none;" +
        "transition:opacity .2s,transform .2s;max-width:min(86vw,360px);text-align:center;}" +
      "#" + TOAST_ID + ".show{opacity:1;transform:translate(-50%,0);}" +
      "@media (max-width:600px){#" + BTN_ID + "{right:12px;bottom:12px;width:40px;height:40px;}" +
        "#" + TOAST_ID + "{bottom:64px;font-size:12.5px;}}";
    var s = document.createElement("style");
    s.id = "met-force-sync-style";
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;
    var b = document.createElement("button");
    b.id = BTN_ID;
    b.type = "button";
    b.setAttribute("aria-label", "Force sync to latest");
    b.title = "Force sync to latest";
    b.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
    b.addEventListener("click", forceSync);
    document.body.appendChild(b);
  }

  function injectToast() {
    if (document.getElementById(TOAST_ID)) return;
    var t = document.createElement("div");
    t.id = TOAST_ID;
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }

  var toastTimer = null;
  function toast(msg, ms) {
    injectToast();
    var t = document.getElementById(TOAST_ID);
    if (!t) return;
    t.innerHTML = msg;
    t.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, ms || 3200);
  }

  var syncing = false;
  function forceSync() {
    if (syncing) return;
    syncing = true;
    var btn = document.getElementById(BTN_ID);
    if (btn) btn.classList.add("spin");
    toast("Syncing to latest&hellip;", 8000);

    var swDone = Promise.resolve();
    if ("serviceWorker" in navigator) {
      swDone = navigator.serviceWorker.getRegistrations()
        .then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        })
        .catch(function () {});
    }

    var cacheDone = Promise.resolve();
    if (window.caches && caches.keys) {
      cacheDone = caches.keys()
        .then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        })
        .catch(function () {});
    }

    Promise.all([swDone, cacheDone]).then(function () {
      // Inside the installed APK: pull the live site instead of reloading the
      // bundled offline copy. That's the whole point of the button here.
      if (inApkShell()) {
        if (navigator.onLine === false) {
          if (btn) btn.classList.remove("spin");
          syncing = false;
          toast("You're offline &mdash; showing the copy saved on your tablet", 4200);
          return;
        }
        // Cross to the live origin, same path, cache-busted. met_synced=1 makes
        // the live page show the confirmation toast (sessionStorage doesn't
        // survive the origin change).
        var live = LIVE_ORIGIN + location.pathname +
          "?s=" + Date.now() + "&met_synced=1" + location.hash;
        location.replace(live);
        return;
      }
      try { sessionStorage.setItem(FLAG, "1"); } catch (e) {}
      var url = location.pathname + "?s=" + Date.now() + location.hash;
      location.replace(url);
    });
  }

  function postSyncToast() {
    try {
      var fromFlag = false;
      try { fromFlag = !!sessionStorage.getItem(FLAG); } catch (e) {}
      var fromParam = location.search.indexOf("met_synced=1") !== -1;
      if (fromFlag || fromParam) {
        try { sessionStorage.removeItem(FLAG); } catch (e) {}
        setTimeout(function () { toast("Synced to the latest version"); }, 280);
        if (location.search.indexOf("s=") !== -1 || fromParam) {
          try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
        }
      }
    } catch (e) {}
  }

  function mount() {
    if (!document.body) {
      setTimeout(mount, 30);
      return;
    }
    injectStyles();
    injectButton();
    injectToast();
    postSyncToast();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
