// Service Worker de Orbit - Estrategia Network-First para HTML y Cache con invalidación de versión
const CACHE_VERSION = 'orbit-v1.3.29';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './css/orbit.css?v=1.3.29',
  './js/vendor/three.min.js?v=1.3.29',
  './js/vendor/GLTFLoader.js?v=1.3.29',
  './js/scene-3d-core.js?v=1.3.29',
  './js/observatory-3d.js?v=1.3.29',
  './assets/models/observatory.glb?v=1.3.29',
  './js/constellation-utils.js?v=1.3.29',
  './data/templates.js?v=1.3.29',
  './data/constellations.js?v=1.3.29',
  './js/storage.js?v=1.3.29',
  './js/supabase.js?v=1.3.29',
  './js/stars.js?v=1.3.29',
  './js/streak.js?v=1.3.29',
  './js/journal.js?v=1.3.29',
  './js/archive.js?v=1.3.29',
  './js/app.js?v=1.3.29'
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

  // HTML, JS y CSS: Network-First con fallback a cache (garantiza código fresco en Safari y PWA)
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'));
  const isCodeAsset = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');

  if (isHtml || isCodeAsset) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => caches.match(req).then((cached) => {
          if (cached) return cached;
          if (isHtml) return caches.match('./index.html') || caches.match('./');
          return null;
        }))
    );
    return;
  }

  // Imágenes y otros assets estáticos: Cache-First con fallback a red
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) return cachedRes;
      return fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
