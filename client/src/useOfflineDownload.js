import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { cacheAudio, countCached, offlineSupported } from "./offlineCache.js";

// Shared "download this book for offline listening" logic — used by both
// the library card (download without opening the book) and the reader's
// offline sheet (download while reading).
export function useOfflineDownload({ id, numPages, voice, rate }) {
  const [cachedCount, setCachedCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [notice, setNotice] = useState("");
  const cancelRef = useRef(false);

  const refresh = useCallback(() => {
    if (!id || !numPages || !voice || !offlineSupported) return;
    const urls = Array.from({ length: numPages }, (_, p) => api.ttsUrl(id, p, voice, rate));
    countCached(urls).then(setCachedCount);
  }, [id, numPages, voice, rate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const download = useCallback(async () => {
    if (!id || !numPages || !voice || downloading) return;
    setDownloading(true);
    setNotice("");
    cancelRef.current = false;
    let done = 0;
    let failed = 0;
    setProgress({ done, total: numPages, failed });
    const CONCURRENCY = 3;
    const pages = Array.from({ length: numPages }, (_, p) => p);
    let next = 0;
    async function worker() {
      while (next < pages.length) {
        if (cancelRef.current) return;
        const p = pages[next++];
        try {
          // Page text goes through the service worker's own cache (it's a
          // plain JSON GET), so this also makes the page readable offline,
          // not just its audio.
          await Promise.all([api.getPage(id, p), cacheAudio(api.ttsUrl(id, p, voice, rate))]);
        } catch (e) {
          failed += 1;
          console.warn(`Failed to cache page ${p + 1}:`, e.message);
        }
        done += 1;
        setProgress({ done, total: numPages, failed });
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setDownloading(false);
    setNotice(
      failed > 0 ? `${failed} page${failed === 1 ? "" : "s"} failed — tap Download to retry them.` : ""
    );
    refresh();
  }, [id, numPages, voice, rate, downloading, refresh]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setDownloading(false);
  }, []);

  return {
    supported: offlineSupported,
    cachedCount,
    isComplete: numPages > 0 && cachedCount >= numPages,
    downloading,
    progress,
    notice,
    download,
    cancel,
    refresh,
  };
}
