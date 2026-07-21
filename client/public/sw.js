// Lets the app (shell + book metadata/page text) work fully offline once
// it's been opened online at least once. Audio is handled separately by
// offlineCache.js (it needs blob: URLs, not Response objects), so this
// worker explicitly stays out of the tts route's way.
const CACHE_VERSION = "v1";
const RUNTIME_CACHE = `pdf-listener-runtime-${CACHE_VERSION}`;
// Must match offlineCache.js's CACHE_NAME — this worker can't import that
// module (it's a classic, non-module script), so the string is duplicated
// deliberately. Keep the two in sync if either changes.
const AUDIO_CACHE = "pdf-listener-audio-v1";

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

// A Background Fetch (started from useOfflineDownload.js via
// backgroundDownload.js) downloads pages itself, independent of any open
// tab. Once it's done, move the results into the same caches the app
// normally reads from, then tell any open page so its UI can update.
async function storeBackgroundFetchResults(registration) {
  const records = await registration.matchAll();
  const audioCache = await caches.open(AUDIO_CACHE);
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  let failed = 0;
  for (const record of records) {
    const response = await record.responseReady.catch(() => null);
    if (!response || !response.ok) {
      failed += 1;
      continue;
    }
    const url = new URL(record.request.url);
    const cache = url.pathname.includes("/tts/") ? audioCache : runtimeCache;
    await cache.put(record.request, response);
  }
  return failed;
}

async function handleBackgroundFetchDone(registration, minFailed = 0) {
  const failed = Math.max(await storeBackgroundFetchResults(registration), minFailed);
  const clientsList = await self.clients.matchAll();
  for (const client of clientsList) {
    client.postMessage({ type: "background-download-done", id: registration.id, failed });
  }
}

self.addEventListener("backgroundfetchsuccess", (event) => {
  event.waitUntil(handleBackgroundFetchDone(event.registration));
});

self.addEventListener("backgroundfetchfail", (event) => {
  event.waitUntil(handleBackgroundFetchDone(event.registration, 1));
});

self.addEventListener("backgroundfetchclick", (event) => {
  event.waitUntil(self.clients.openWindow("/"));
});
