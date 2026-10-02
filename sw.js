// Keeps a copy of the app in the browser so the web version still opens with no signal.
// It always tries the network first, so an update shows up as soon as there is a connection again;
// the saved copy is only used when the network fails.

const CACHE = 'canada-map-v1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'data.js', 'rivers.js', 'map.js',
  'vendor/d3.min.js', 'vendor/inter-latin-wght-normal.woff2', 'vendor/inter-latin-wght-italic.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      e.waitUntil(caches.open(CACHE).then(cache => cache.put(e.request, copy)));
    }
    return response;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
