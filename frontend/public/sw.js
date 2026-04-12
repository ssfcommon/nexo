const CACHE_NAME = 'nexo-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install — cache shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first for API/Supabase, cache-first for static assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET and cross-origin API calls (Supabase)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // For navigation requests — network first, fallback to cache (SPA)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets — cache first
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      }))
    );
    return;
  }
});
