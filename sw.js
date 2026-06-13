const CACHE_NAME = "kandys-v1";

const ASSETS = [
  "/",
  "/index.html",
  "/menu.html",
  "/cart.html",
  "/track.html",
  "/pay.html",
  "/app.js",
  "/style.css",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});

