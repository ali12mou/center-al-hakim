// Service worker de l’espace élève. Les données (API) ne sont jamais mises en
// cache : elles sont personnelles. Sans réseau, une page avec le logo
// explique qu’il faut se reconnecter à Internet.
const CACHE = "alhakim-student-v1";
const OFFLINE = "/student-offline.html";
const ASSETS = [OFFLINE, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
