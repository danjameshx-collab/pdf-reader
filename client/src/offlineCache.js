// Client-side audio caching for offline listening, built on the Cache Storage
// API. Safe to cache indefinitely: the backend serves each page/voice/rate
// combination as immutable audio (synthesized once, never changes).
const CACHE_NAME = "pdf-listener-audio-v1";

function supported() {
  return typeof caches !== "undefined";
}

async function openCache() {
  return supported() ? caches.open(CACHE_NAME) : null;
}

export async function isAudioCached(url) {
  const cache = await openCache();
  if (!cache) return false;
  return Boolean(await cache.match(url));
}

// The server times out slow TTS synthesis at 45s and returns an error; this
// covers the case where the response never comes back at all (a hung
// connection would otherwise wait forever and stall a download slot).
const FETCH_TIMEOUT_MS = 55_000;

function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Returns a playable blob: URL for `url`, fetching from the network and
// populating the cache only if it isn't already stored.
export async function getPlayableAudioUrl(url) {
  const cache = await openCache();
  const cached = cache ? await cache.match(url) : null;
  if (cached) return URL.createObjectURL(await cached.blob());

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Couldn't load audio (${res.status})`);
  if (cache) await cache.put(url, res.clone());
  return URL.createObjectURL(await res.blob());
}

// Fetches and caches a page's audio without loading it into memory as an
// object URL — used for background prefetch/download.
export async function cacheAudio(url) {
  const cache = await openCache();
  if (cache && (await cache.match(url))) return;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Couldn't load audio (${res.status})`);
  if (cache) await cache.put(url, res);
}

export async function countCached(urls) {
  const cache = await openCache();
  if (!cache) return 0;
  let n = 0;
  for (const url of urls) {
    if (await cache.match(url)) n++;
  }
  return n;
}

export async function clearCached(urls) {
  const cache = await openCache();
  if (!cache) return;
  for (const url of urls) await cache.delete(url);
}

export const offlineSupported = supported();
