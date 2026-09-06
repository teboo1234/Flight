// CheckDeck service worker.
//
// Strategy: network-first, cache as fallback. Every request tries the
// network first — so whenever there's a connection, you always get
// whatever's actually live on GitHub (today's upload, not a stale copy).
// The response is also saved to the cache as it comes back, so the very
// last version that loaded successfully is what's available the next
// time there's no connection at all.
//
// Bump CACHE_NAME whenever you want to force old cached files to be
// cleared out (e.g. if you rename files or want a clean slate) — it
// doesn't need to change on every normal update, since network-first
// already keeps the cache fresh on its own whenever you're online.
const CACHE_NAME = 'checkdeck-cache-v1';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return Promise.all(
        APP_SHELL.map(function(url){
          return cache.add(url).catch(function(){ /* ignore individual failures */ });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  if(event.request.method !== 'GET') return;
  // Only handle same-origin requests (the app shell). Cross-origin
  // requests (Google Fonts) are left to the browser's own handling —
  // if they fail offline, the page's CSS already falls back to a
  // system font, which is a fine trade-off for keeping this simple.
  var url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(function(networkResponse){
      var copy = networkResponse.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
      return networkResponse;
    }).catch(function(){
      return caches.match(event.request).then(function(cached){
        return cached || caches.match('./index.html');
      });
    })
  );
});
