// Service worker for Sihan's NIMHANS / MET 2026 prep site.
// Strategy:
//   - Navigations (HTML): network-first, fall back to cache, then to cached index.
//   - Static assets: stale-while-revalidate (instant load, refresh in background).
//   - Every successful same-origin GET is cached so any visited page works offline.
// Bump CACHE_VERSION whenever the precached shell changes to force an update.

const CACHE_VERSION = 'nimhans-2026-v1';
const CACHE = `nimhans-prep-${CACHE_VERSION}`;

// Core shell precached on install (relative to the SW scope).
const PRECACHE = [
  './',
  './index.html',
  './met.html',
  './site.css',
  './notes-style.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './quiz/index.html',
  './notes/index.html',
  './results/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Don't let one missing file abort the whole install.
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // only handle our own site

  // HTML navigations: network-first so content stays fresh when online.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // Everything else (css, js, images, fonts): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fetched;
    })
  );
});
