/* Notes for Exam — service worker. Own cache, scoped to /notes-app/.
   Precaches the shell + every chapter page so the whole library works offline.
   CACHE name is stamped by build_notes_app.py on each build so updates self-apply. */
var CACHE = "notes-for-exam-bccc311e93";
var BASE = "/sihan-met-flashcards/notes-app/";
var SHELL = [
  BASE,
  BASE + "index.html",
  BASE + "app.css",
  BASE + "app.js",
  BASE + "reader.css",
  BASE + "book.css",
  BASE + "manifest.json",
  BASE + "manifest.webmanifest",
  BASE + "search-index.json",
  "/sihan-met-flashcards/notes-style.css",
  "/sihan-met-flashcards/notes/term-popover.css",
  "/sihan-met-flashcards/notes/term-popover.js",
  "/sihan-met-flashcards/force-sync.js"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () {}).then(function () {
        // pull the chapter list and cache every reader page
        return fetch(BASE + "manifest.json", { cache: "no-cache" })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var urls = [];
            (d.shelves || []).forEach(function (sh) {
              (sh.chapters || []).forEach(function (c) {
                urls.push(BASE + "content/" + c.slug + ".html");
              });
            });
            return cache.addAll(urls).catch(function () {});
          })
          .catch(function () {});
      });
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && k.indexOf("notes-for-exam-") === 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  // cache-first, fall back to network and warm the cache
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
