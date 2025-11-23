const CACHE_NAME = 'stream-control-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/music.js',
  '/js/scoreboard.js',
  '/js/settings.js',
  '/js/overlays.js',
  '/js/stats.js',
  '/js/ui.js',
  '/js/app.js'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Activate new service worker immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control immediately
});

self.addEventListener('fetch', event => {
  // Network-first strategy for API calls and index.html
  if (event.request.url.includes('/api/') || event.request.url.includes('index.html') || event.request.url.endsWith('/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets (CSS, JS, manifest, icons)
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
