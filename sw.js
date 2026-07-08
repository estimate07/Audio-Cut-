/* QuietCut Service Worker - true offline support (F1)
   Strategy: network-first for the page itself (fixes reach users
   immediately when online), cache-first for static assets. */
const CACHE = 'quietcut-v3';
const ASSETS = [
  './',
  './index.html',
  './lame.min.js',
  './manifest.webmanifest',
  './icon.svg'
];
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await Promise.allSettled(CDN_ASSETS.map((url) =>
      cache.add(new Request(url, { mode: 'no-cors' }))
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isPageRequest(req) {
  if (req.mode === 'navigate') return true;
  const url = new URL(req.url);
  return url.origin === location.origin && /(\/|index\.html)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (isPageRequest(req)) {
    // Network-first: always serve the latest app when online
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        const cached = await caches.match(req, { ignoreSearch: true }) ||
                       await caches.match('./index.html');
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  // Static assets: cache-first with background refresh on miss
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
