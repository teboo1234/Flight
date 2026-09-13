// CheckDeck Briefing service worker.
//
// Strategy: network-first, cache as fallback — same approach as the
// Flight app. Every request tries the network first (so an upload
// always wins once you're online), and falls back to the cache when
// there's no connection.
//
// Filename and cache name are both deliberately unique — this sits in
// the SAME folder as the Flight app's files, so anything named the
// same (index.html, manifest.json, sw.js, icon-*.png) would silently
// overwrite the other app's copy the moment both get uploaded together.
const CACHE_NAME = 'checkdeck-briefing-cache-v1';
const APP_SHELL = [
  './brief.html',
  './briefing-manifest.json',
  './briefing-icon-192.png',
  './briefing-icon-512.png'
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
  var url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(function(networkResponse){
      var copy = networkResponse.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
      return networkResponse;
    }).catch(function(){
      return caches.match(event.request).then(function(cached){
        return cached || caches.match('./brief.html');
      });
    })
  );
});
