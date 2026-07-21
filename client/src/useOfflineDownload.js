import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { cacheAudio, countCached, offlineSupported } from "./offlineCache.js";
import {
  isBackgroundFetchSupported,
  getActiveBackgroundFetch,
  startBackgroundDownload,
  backgroundFetchId,
} from "./backgroundDownload.js";

const emptyProgress = { done: 0, total: 0, failed: 0, downloadedBytes: 0, totalBytes: 0 };

// Shared "download this book for offline listening" logic — used by both
// the library card (download without opening the book) and the reader's
// offline sheet. Prefers the Background Fetch API (survives closing the
// tab/app — Chrome/Edge only) and falls back to an in-page fetch loop
// (only runs while this tab stays open) everywhere else.
export function useOfflineDownload({ id, numPages, voice, rate, title }) {
  const [cachedCount, setCachedCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [background, setBackground] = useState(false);
  const [progress, setProgress] = useState(emptyProgress);
  const [notice, setNotice] = useState("");
  const cancelRef = useRef(false);
  const bgRegRef = useRef(null);
  const bgSupportedRef = useRef(false);
  const bgProgressCleanupRef = useRef(null);

  const refresh = useCallback(() => {
    if (!id || !numPages || !voice || !offlineSupported) return;
    const urls = Array.from({ length: numPages }, (_, p) => api.ttsUrl(id, p, voice, rate));
    countCached(urls).then(setCachedCount);
  }, [id, numPages, voice, rate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Background Fetch reports progress in bytes downloaded via its own
  // `downloaded`/`downloadTotal` counters and a `progress` event — there's
  // no per-page count exposed, so this is the only progress signal we get
  // for background downloads.
  const trackBackgroundProgress = useCallback((bgReg) => {
    bgProgressCleanupRef.current?.();
    bgRegRef.current = bgReg;
    const update = () => {
      setProgress((p) => ({ ...p, downloadedBytes: bgReg.downloaded, totalBytes: bgReg.downloadTotal }));
    };
    update();
    bgReg.addEventListener("progress", update);
    bgProgressCleanupRef.current = () => bgReg.removeEventListener("progress", update);
  }, []);

  // Detect an already-running background download — e.g. the app was
  // closed and reopened while Chrome kept downloading in the background.
  useEffect(() => {
    if (!id || !numPages || !voice) return;
    let cancelled = false;
    isBackgroundFetchSupported().then((supported) => {
      bgSupportedRef.current = supported;
      if (!supported || cancelled) return;
      getActiveBackgroundFetch(id, voice, rate).then((bgReg) => {
        if (cancelled || !bgReg) return;
        trackBackgroundProgress(bgReg);
        setDownloading(true);
        setBackground(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id, numPages, voice, rate, trackBackgroundProgress]);

  // Pick up completion messages from the service worker — fires even if
  // this component wasn't mounted when the download actually finished.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !id || !voice) return;
    const expectedId = backgroundFetchId(id, voice, rate);
    function onMessage(event) {
      if (event.data?.type !== "background-download-done" || event.data.id !== expectedId) return;
      bgProgressCleanupRef.current?.();
      bgProgressCleanupRef.current = null;
      bgRegRef.current = null;
      setDownloading(false);
      setBackground(false);
      setProgress(emptyProgress);
      setNotice(
        event.data.failed > 0
          ? `${event.data.failed} page${event.data.failed === 1 ? "" : "s"} failed — tap Download to retry them.`
          : ""
      );
      refresh();
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [id, voice, rate, refresh]);

  useEffect(() => () => bgProgressCleanupRef.current?.(), []);

  const downloadForeground = useCallback(async () => {
    cancelRef.current = false;
    let done = 0;
    let failed = 0;
    setProgress({ ...emptyProgress, total: numPages });
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
        setProgress((prev) => ({ ...prev, done, failed }));
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setDownloading(false);
    setNotice(
      failed > 0 ? `${failed} page${failed === 1 ? "" : "s"} failed — tap Download to retry them.` : ""
    );
    refresh();
  }, [id, numPages, voice, rate, refresh]);

  const download = useCallback(async () => {
    if (!id || !numPages || !voice || downloading) return;
    setDownloading(true);
    setNotice("");

    if (bgSupportedRef.current) {
      setBackground(true);
      try {
        const requests = [];
        for (let p = 0; p < numPages; p++) {
          requests.push(api.ttsUrl(id, p, voice, rate));
          requests.push(api.pageUrl(id, p));
        }
        const bgReg = await startBackgroundDownload({
          bookId: id,
          title: title || "book",
          voice,
          rate,
          requests,
          numPages,
        });
        trackBackgroundProgress(bgReg);
        return; // completion arrives via the SW message listener above
      } catch (e) {
        // Quota errors, a stuck duplicate registration, etc. — fall back to
        // the in-page loop so the click still does something.
        console.warn("Background download failed to start, falling back:", e.message);
        setBackground(false);
      }
    }

    await downloadForeground();
  }, [id, numPages, voice, rate, title, downloading, downloadForeground, trackBackgroundProgress]);

  const cancel = useCallback(() => {
    if (background && bgRegRef.current) {
      bgRegRef.current.abort().catch(() => {});
      bgProgressCleanupRef.current?.();
      bgProgressCleanupRef.current = null;
      bgRegRef.current = null;
      setBackground(false);
    } else {
      cancelRef.current = true;
    }
    setProgress(emptyProgress);
    setDownloading(false);
  }, [background]);

  return {
    supported: offlineSupported,
    cachedCount,
    isComplete: numPages > 0 && cachedCount >= numPages,
    downloading,
    background,
    progress,
    notice,
    download,
    cancel,
    refresh,
  };
}
