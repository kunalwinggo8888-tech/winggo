/**
 * WINGGO Service Worker — App Shell Cache
 * Caches the app shell for near-instant subsequent loads and basic offline support.
 */
const CACHE_NAME = "winggo-v1";

const SHELL_URLS = [
  "./",
  "./manifest.json",
  "./icon.svg",
  "./favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only handle GET requests on same origin
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  // Never intercept Firebase, analytics, or font requests
  if (
    request.url.includes("firestore.googleapis.com") ||
    request.url.includes("firebase") ||
    request.url.includes("fonts.googleapis.com") ||
    request.url.includes("fonts.gstatic.com")
  ) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful same-origin GET responses for JS/CSS/images
        if (
          response.ok &&
          (request.url.includes("/assets/") || SHELL_URLS.some((u) => request.url.endsWith(u)))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached ?? new Response("Offline", { status: 503 }));
    })
  );
});
