/* Web-app shell for iPhone/iPad: offline service worker + a one-time "Add to Home Screen" hint
   in iOS Safari. Both are skipped inside the Android APK (window.NLNative). */
(function(){
  if (window.NLNative) return;
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function(){});
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  if (!ios || standalone) return;
  try { if (localStorage.getItem("namelock-ios-hint")) return; } catch(e){ return; }
  var css = document.createElement("style");
  css.textContent = "#nl-ios{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9999;max-width:460px;margin:0 auto;" +
    "background:#1c1f2e;color:#fff;border:2px solid #5B4BDB;border-radius:18px;padding:14px 44px 14px 16px;font:600 15px/1.4 -apple-system,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5)}" +
    "#nl-ios b{color:#FFC93C}#nl-ios button{position:absolute;top:8px;right:8px;width:32px;height:32px;border:0;border-radius:50%;background:#2c3044;color:#fff;font-size:16px}";
  var el = document.createElement("div"); el.id = "nl-ios";
  el.innerHTML = '<button aria-label="Close">✕</button>Play it like an app: tap <b>Share</b> <svg width="16" height="19" viewBox="0 0 16 19" style="vertical-align:-3px" fill="none" stroke="#FFC93C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V1M4.5 4.5L8 1l3.5 3.5M5 7.5H2.5v10h11v-10H11"/></svg> then <b>Add to Home Screen</b>. Full screen, own icon, works offline.';
  el.querySelector("button").onclick = function(){ try { localStorage.setItem("namelock-ios-hint", "1"); } catch(e){} el.remove(); };
  document.head.appendChild(css);
  (document.readyState === "loading") ? document.addEventListener("DOMContentLoaded", function(){ document.body.appendChild(el); }) : document.body.appendChild(el);
})();
