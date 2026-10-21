/* Name Lock web app (iPhone/iPad "Add to Home Screen") - offline service worker.
   Network-first so a deploy shows up on next open; the cache is the offline fallback.
   Never caches a non-200. Not registered inside the Android APK (window.NLNative). */
const CACHE = "namelock-app-20261021-giveaways";
const FILES = ["worlds.html", "worlds.css", "worlds.js", "index.html", "app.css", "app.js", "viva.js", "pwa.js",
  "icon.svg", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "../data.js", "../../sync.js", "../../syncqr.js", "../../qrlib.js", "../../study.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("namelock-app-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, {ignoreSearch: true}).then(hit => hit || (req.mode === "navigate" ? caches.match("worlds.html") : Response.error()))));
});
