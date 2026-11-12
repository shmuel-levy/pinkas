// פנקס service worker: the whole app works offline.
// Bump VERSION whenever any app file changes so phones pick up the update.
const VERSION = 'pinkas-1.2.0';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/logic.js',
  './js/store.js',
  './manifest.webmanifest',
  './img/guilloche.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const FONT_CACHE = 'pinkas-fonts';
const GEN_CACHE = 'pinkas-gen'; // files the page generates (calendar reminder)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![VERSION, FONT_CACHE, GEN_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: serve from cache, refresh in the background
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Generated calendar file
  if (url.pathname.endsWith('.ics')) {
    event.respondWith(
      caches.open(GEN_CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req))
    );
    return;
  }

  // App pages: network first (so updates arrive), fall back to cache offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static files: cache first
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }))
  );
});
