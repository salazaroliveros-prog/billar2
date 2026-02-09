const CACHE_NAME = 'ms-control-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/src/main.js',
  '/style.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // navigation requests -> try network then fallback to cache/offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(res => {
        // update cache in background
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return res;
      }).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // other requests: cache-first then network
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
      // optionally cache resources
      try { if (event.request.method === 'GET' && res && res.status === 200) { const resClone = res.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, resClone)); } } catch(e){}
      return res;
    }).catch(() => undefined))
  );
});
