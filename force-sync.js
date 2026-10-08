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
   stale build. It's the same ↻ control he asked for and got on the
   psych-notes app, shown as a labelled "Update" pill so he can find it.

   Also (2026-10-08, "the APK sits on an old copy"):
     - Inside the installed APK (bundled copy at appassets.local) we probe the
       live site on open and, if it answers, hop straight to the live page. No
       signal: stay on the bundled copy.
     - On the live site we ask the service worker to check for a new version
       whenever the app comes back to the foreground, and reload once when a
       new worker takes over. */
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

  // APK: open the live site instead of the bundled snapshot when online. Runs
  // at script load (in <head>) so the hop happens before the old copy renders
  // much. A failed probe marks this session offline so we don't stall every
  // page; the Update pill still crosses to live by hand.
  var HOP_SKIP = "metStayBundled";
  function hopToLive() {
    try { if (sessionStorage.getItem(HOP_SKIP)) return; } catch (e) {}
    if (navigator.onLine === false || !window.fetch) return;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
    fetch(LIVE_ORIGIN + "/sihan-met-flashcards/manifest.webmanifest?cb=" + Date.now(),
          { cache: "no-store", mode: "cors", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("live " + r.status);
        location.replace(LIVE_ORIGIN + location.pathname + location.search + location.hash);
      })
      .catch(function () {
        clearTimeout(timer);
        try { sessionStorage.setItem(HOP_SKIP, "1"); } catch (e) {}
      });
  }
  if (inApkShell()) hopToLive();

  // Live site: pick up a new deploy promptly. Check for a new SW on every
  // return to the foreground (throttled), and reload once when a NEW worker
  // takes over a page that already had one (first install doesn't reload).
  var reloading = false;
  if (!inApkShell() && "serviceWorker" in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadController) { hadController = true; return; }
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    var lastCheck = 0;
    var checkForUpdate = function () {
      if (Date.now() - lastCheck < 60000) return;
      lastCheck = Date.now();
      navigator.serviceWorker.getRegistration()
        .then(function (reg) { if (reg) return reg.update(); })
        .catch(function () {});
    };
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") checkForUpdate();
    });
    window.addEventListener("focus", checkForUpdate);
  }

  function injectStyles() {
    if (document.getElementById("met-force-sync-style")) return;
    var css =
      "#" + BTN_ID + "{position:fixed;left:16px;bottom:16px;z-index:2147483646;" +
        "height:40px;padding:0 14px 0 11px;gap:7px;border-radius:999px;border:1px solid var(--border,#30363d);" +
        "background:var(--panel,#161b22);color:var(--text,#e6edf3);" +
        "font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
        "display:inline-flex;align-items:center;justify-content:center;cursor:pointer;" +
        "box-shadow:0 6px 18px rgba(0,0,0,0.35);transition:color .15s,border-color .15s,transform .15s;" +
        "-webkit-tap-highlight-color:transparent;}" +
      "#" + BTN_ID + ":hover{color:var(--accent,#58a6ff);border-color:var(--accent-dim,#1f6feb);" +
        "transform:translateY(-1px);}" +
      "#" + BTN_ID + ":active{transform:translateY(0);}" +
      "#" + BTN_ID + " svg{width:18px;height:18px;display:block;}" +
      "#" + BTN_ID + ".spin svg{animation:metForceSyncSpin .7s linear infinite;}" +
      "@keyframes metForceSyncSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}" +
      "#" + TOAST_ID + "{position:fixed;left:50%;bottom:74px;transform:translate(-50%,8px);" +
        "z-index:2147483647;background:var(--panel,#161b22);color:var(--text,#e6edf3);" +
        "border:1px solid var(--border,#30363d);border-radius:10px;padding:10px 14px;" +
        "font:500 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
        "box-shadow:0 10px 28px rgba(0,0,0,0.45);opacity:0;pointer-events:none;" +
        "transition:opacity .2s,transform .2s;max-width:min(86vw,360px);text-align:center;}" +
      "#" + TOAST_ID + ".show{opacity:1;transform:translate(-50%,0);}" +
      "@media (max-width:600px){#" + BTN_ID + "{left:12px;bottom:12px;height:38px;}" +
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
    b.setAttribute("aria-label", "Update to the latest version");
    b.title = "Update to the latest version";
    b.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>' +
      '<span>Update</span>';
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
    reloading = true;   // our own reload below; ignore controllerchange
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
          toast("You're offline, showing the copy saved on your tablet", 4200);
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
      // Overwrite this page's scripts/styles in the HTTP cache too: the APK's
      // WebView trusts that cache without revalidating, so clearing the SW
      // caches alone could still reload old JS/CSS.
      var urls = [location.href];
      var els = document.querySelectorAll("script[src],link[rel=stylesheet][href]");
      for (var i = 0; i < els.length; i++) urls.push(els[i].src || els[i].href);
      var refetch = urls.filter(function (u) {
        return u.indexOf(location.origin + "/") === 0;
      }).map(function (u) {
        return fetch(u, { cache: "reload", credentials: "same-origin" }).catch(function () {});
      });
      Promise.all(refetch).then(function () {
        // Re-register the (fresh) service worker so offline keeps working.
        if ("serviceWorker" in navigator) {
          return navigator.serviceWorker.register("/sihan-met-flashcards/sw.js").catch(function () {});
        }
      }).then(function () {
        try { sessionStorage.setItem(FLAG, "1"); } catch (e) {}
        var url = location.pathname + "?s=" + Date.now() + location.hash;
        location.replace(url);
      });
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
