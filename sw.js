// Service Worker de Orbit - Estrategia Network-First para HTML y Cache con invalidación de versión
const CACHE_VERSION = 'orbit-v1.2.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './css/orbit.css?v=1.2.0',
  './js/storage.js?v=1.2.0',
  './js/supabase.js?v=1.2.0',
  './js/stars.js?v=1.2.0',
  './js/streak.js?v=1.2.0',
  './js/journal.js?v=1.2.0',
  './js/archive.js?v=1.2.0',
  './data/constellations.js?v=1.2.0',
  './js/app.js?v=1.2.0'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-cache warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo procesar peticiones GET de mismo origen
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Navegación / Documento HTML: Network-First con fallback a cache
  if (req.mode === 'navigate' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html') || caches.match('./')))
    );
    return;
  }

  // Assets versionados (CSS, JS, imágenes): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(() => cachedRes);

      return cachedRes || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
