const CACHE_NAME = "kandys-v2";

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
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const isFreshAsset =
    request.mode === "navigate" ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.url.includes(".html");

  if (isFreshAsset) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(res => res || fetch(request))
  );
});

