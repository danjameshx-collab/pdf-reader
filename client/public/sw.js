// Lets the app (shell + book metadata/page text) work fully offline once
// it's been opened online at least once. Audio is handled separately by
// offlineCache.js (it needs blob: URLs, not Response objects), so this
// worker explicitly stays out of the tts route's way.
const CACHE_VERSION = "v1";
const RUNTIME_CACHE = `pdf-listener-runtime-${CACHE_VERSION}`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("pdf-listener-runtime-") && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, updateKey) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(updateKey || request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(updateKey || request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // uploads/progress writes always need the network

  const url = new URL(req.url);

  // App-shell navigation: SPA routes like /book/xyz only exist client-side,
  // so on a cold offline load fall back to the cached shell and let the
  // client-side router take it from there.
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, "/index.html"));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.includes("/tts/") || url.pathname === "/api/blob-upload") return;
    event.respondWith(networkFirst(req));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
  }
});
