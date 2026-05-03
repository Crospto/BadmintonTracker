self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("badmintion-cache").then((cache) => {
      return cache.addAll([
        "/BadmintonTracker/",
        "/BadmintonTracker/index.html",
        "/BadmintonTracker/style.css",
        "/BadmintonTracker/script.js"
      ]);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
