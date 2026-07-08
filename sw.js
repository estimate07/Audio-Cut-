/* QuietCut Service Worker - true offline support (F1) */
const CACHE = 'quietcut-v2';
const ASSETS = [
  './',
  './index.html',
  './lame.min.js',
  './manifest.webmanifest',
  './icon.svg'
];
/* Third-party runtime (Tailwind browser build) - cached best-effort so the app
   styles keep working with zero network after the first visit. */
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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const fallback = await caches.match('./index.html');
      if (fallback && req.mode === 'navigate') return fallback;
      throw err;
    }
  })());
});
