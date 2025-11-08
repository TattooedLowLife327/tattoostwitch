const CACHE_NAME = 'tattoos-twitch-v4';

self.addEventListener('install', event => {
  self.skipWaiting();
  // Don't cache anything on install
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete ALL caches
          console.log('[SW] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('[SW] All caches cleared');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // Network-only strategy - never cache, always fetch fresh
  event.respondWith(
    fetch(event.request, {
      cache: 'no-store'
    }).catch(() => {
      // If offline and it's an HTML page, show a simple offline message
      if (event.request.headers.get('accept').includes('text/html')) {
        return new Response('<h1>Offline</h1><p>Please check your connection.</p>', {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    })
  );
});
