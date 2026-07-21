// Background Fetch API (Chrome/Edge on Android + desktop only) hands a
// download off to the browser itself, which keeps it running — with its own
// progress notification — even if this tab is closed or the phone is
// locked. Unsupported browsers (Firefox, Safari/iOS) fall back to the
// manual in-page download loop in useOfflineDownload.js, which only runs
// while the tab is open.
export async function isBackgroundFetchSupported() {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return "backgroundFetch" in reg;
  } catch {
    return false;
  }
}

export function backgroundFetchId(bookId, voice, rate) {
  return `book-${bookId}-${voice}-${rate}`;
}

// Returns the still-running registration for this book/voice/rate, if any —
// used to resume showing "downloading" state after reopening the app.
export async function getActiveBackgroundFetch(bookId, voice, rate) {
  const reg = await navigator.serviceWorker.ready;
  const bgReg = await reg.backgroundFetch.get(backgroundFetchId(bookId, voice, rate));
  return bgReg && !bgReg.result ? bgReg : null; // `result` is set once it's finished
}

// There's no way to know real audio sizes upfront (they vary a lot with how
// much text is on a page), so this is a rough per-page estimate used only
// to give the browser — and our own progress bar — *some* denominator to
// show a percentage against, rather than a totally indeterminate spinner.
const ESTIMATED_BYTES_PER_PAGE = 150_000;

export async function startBackgroundDownload({ bookId, title, voice, rate, requests, numPages }) {
  const reg = await navigator.serviceWorker.ready;
  return reg.backgroundFetch.fetch(backgroundFetchId(bookId, voice, rate), requests, {
    title: `Downloading "${title}"`,
    downloadTotal: numPages * ESTIMATED_BYTES_PER_PAGE,
  });
}
