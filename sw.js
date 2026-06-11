/* MET 2026 prep - offline service worker
   Precaches the whole site so it works with no signal after one install.
   Bump CACHE on each deploy to refresh. */
const CACHE = "met-prep-20260611-archive-nimhans-manipal";
const BASE = "/sihan-met-flashcards/";
const PRECACHE = [
  "/sihan-met-flashcards/",
  "/sihan-met-flashcards/checklist/",
  "/sihan-met-flashcards/downloads/",
  "/sihan-met-flashcards/icons/apple-touch-icon.png",
  "/sihan-met-flashcards/icons/favicon-16.png",
  "/sihan-met-flashcards/icons/favicon-32.png",
  "/sihan-met-flashcards/icons/icon-192-maskable.png",
  "/sihan-met-flashcards/icons/icon-192.png",
  "/sihan-met-flashcards/icons/icon-512-maskable.png",
  "/sihan-met-flashcards/icons/icon-512.png",
  "/sihan-met-flashcards/manifest.webmanifest",
  "/sihan-met-flashcards/met.html",
  "/sihan-met-flashcards/nav-toggle.js",
  "/sihan-met-flashcards/gate.js",
  "/sihan-met-flashcards/force-sync.js",
  "/sihan-met-flashcards/notes-style.css",
  "/sihan-met-flashcards/notes/",
  "/sihan-met-flashcards/amity-syllabus/",
  "/sihan-met-flashcards/dissertation/",
  "/sihan-met-flashcards/rml/",
  "/sihan-met-flashcards/last-minute-revision/",
  "/sihan-met-flashcards/news/",
  "/sihan-met-flashcards/news/news.json",
  "/sihan-met-flashcards/admissions/",
  "/sihan-met-flashcards/archive/",
  "/sihan-met-flashcards/notes/search.html",
  "/sihan-met-flashcards/notes/search-index.json",
  "/sihan-met-flashcards/notes/note-highlight.js",
  "/sihan-met-flashcards/notes/section-collapse.js",
  "/sihan-met-flashcards/notes/term-popover.js",
  "/sihan-met-flashcards/notes/term-popover.css",
  "/sihan-met-flashcards/notes/abnormal-psych-cheatsheet/",
  "/sihan-met-flashcards/notes/abnormal-ahuja/",
  "/sihan-met-flashcards/notes/abnormal-barlow-durand/",
  "/sihan-met-flashcards/notes/blatt-spitz-depression/",
  "/sihan-met-flashcards/notes/abnormal-today-sprint/",
  "/sihan-met-flashcards/notes/action-potential/",
  "/sihan-met-flashcards/notes/assessment/",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/",
  "/sihan-met-flashcards/notes/biopsych-carlson/",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_11_4.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_11_5.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_3_16.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_3_19.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_3_2.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_3_25.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_3_27.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_3_28.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_3_5.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_3_6.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_3_8.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_3_9.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_4_16.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_4_5.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_4_7.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_6_13.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_6_5.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_7_10.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_7_11.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_7_4.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_8_1.jpg",
  "/sihan-met-flashcards/notes/biopsych-cheatsheet/figs/f_8_6.jpg",
  "/sihan-met-flashcards/notes/biostats-cheatsheet/",
  "/sihan-met-flashcards/notes/bronfenbrenner/",
  "/sihan-met-flashcards/notes/cognitive/",
  "/sihan-met-flashcards/notes/degrees-of-freedom/",
  "/sihan-met-flashcards/notes/concept-pack/",
  "/sihan-met-flashcards/notes/cranial-nerves/",
  "/sihan-met-flashcards/notes/dev-psych-cheatsheet/",
  "/sihan-met-flashcards/notes/differentiators/",
  "/sihan-met-flashcards/notes/disorders-genetic/",
  "/sihan-met-flashcards/notes/effects/",
  "/sihan-met-flashcards/notes/ethics-terms/",
  "/sihan-met-flashcards/notes/general-psych/",
  "/sihan-met-flashcards/notes/high-yield-abnormal-dev/",
  "/sihan-met-flashcards/notes/hpa-axis/",
  "/sihan-met-flashcards/notes/icd/",
  "/sihan-met-flashcards/notes/intelligence-tests-deep/",
  "/sihan-met-flashcards/notes/mphil-mock-review/",
  "/sihan-met-flashcards/notes/learning-conditioning/",
  "/sihan-met-flashcards/notes/master/",
  "/sihan-met-flashcards/notes/met-mock-1-debrief/",
  "/sihan-met-flashcards/notes/mock-1-debrief/",
  "/sihan-met-flashcards/notes/nimhans-mock-1-debrief/",
  "/sihan-met-flashcards/notes/pep-lite-notes/",
  "/sihan-met-flashcards/notes/nimhans-pyq-breakdown/",
  "/sihan-met-flashcards/notes/originators/",
  "/sihan-met-flashcards/notes/personality/",
  "/sihan-met-flashcards/notes/phenomena/",
  "/sihan-met-flashcards/notes/psych-tests-deep/",
  "/sihan-met-flashcards/notes/psychotherapy-cheatsheet/",
  "/sihan-met-flashcards/notes/research-methodology/",
  "/sihan-met-flashcards/notes/revision-pack/",
  "/sihan-met-flashcards/notes/sleep/",
  "/sihan-met-flashcards/notes/social-psych/",
  "/sihan-met-flashcards/notes/targeted-remediation-2026-04-22.html",
  "/sihan-met-flashcards/notes/textbook/",
  "/sihan-met-flashcards/notes/theories/",
  "/sihan-met-flashcards/notes/theorists/",
  "/sihan-met-flashcards/notes/therapy-components/",
  "/sihan-met-flashcards/plan/",
  "/sihan-met-flashcards/quiz/",
  "/sihan-met-flashcards/quiz/bio-testing-paper/",
  "/sihan-met-flashcards/quiz/met-mock-1/",
  "/sihan-met-flashcards/quiz/met-mock-2/",
  "/sihan-met-flashcards/quiz/met-mock-3/",
  "/sihan-met-flashcards/quiz/met-mock-4/",
  "/sihan-met-flashcards/quiz/met-mock-5/",
  "/sihan-met-flashcards/quiz/practice/",
  "/sihan-met-flashcards/quiz/diagnostic-1/",
  "/sihan-met-flashcards/quiz/pep-mock-1/",
  "/sihan-met-flashcards/quiz/pep-mock-1-solo/",
  "/sihan-met-flashcards/quiz/pep-mock-2/",
  "/sihan-met-flashcards/quiz/nimhans-mock-1/",
  "/sihan-met-flashcards/quiz/pyq-mock-2/",
  "/sihan-met-flashcards/quiz/pyq-real-2024/",
  "/sihan-met-flashcards/quiz/ihbas-2024/",
  "/sihan-met-flashcards/quiz/pyq-real-2025/",
  "/sihan-met-flashcards/quiz/wrong-remix/",
  "/sihan-met-flashcards/results/",
  "/sihan-met-flashcards/results/analysis/",
  "/sihan-met-flashcards/results/analysis/data.js",
  "/sihan-met-flashcards/site.css",
  "/sihan-met-flashcards/tests/"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, {cache: "reload"}))))
      .catch(() => {/* tolerate a few misses, runtime cache fills the rest */})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: serve cache first (offline-friendly), refresh in background.
  if (req.mode === "navigate") {
    // NETWORK-FIRST: a live page must always beat a stale cache, and we never
    // cache a non-200. The old cache-first handler stored whatever came back —
    // including 404s — so a page opened during a transient 404 (e.g. the notes/
    // nav gap earlier) kept serving that dead 404 even after it went live. That
    // was the "HPA Axis page 404s though it exists" bug. Offline: cache, then BASE.
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((cached) => cached || caches.match(BASE)))
    );
    return;
  }

  // Assets (css/js/png/etc): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
