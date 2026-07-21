// Shared progress math for OfflineButton and DownloadStatusModal. Returns
// null when there's nothing to compute a percentage from yet (indeterminate).
export function downloadPct(progress, background) {
  if (background) {
    if (!progress.totalBytes) return null;
    // The byte total is only an estimate (see backgroundDownload.js), so it
    // can run a little ahead of reality — cap at 99% and let the "finished"
    // message (not this estimate) be what flips the UI to complete.
    return Math.min(99, Math.round((progress.downloadedBytes / progress.totalBytes) * 100));
  }
  if (!progress.total) return null;
  return Math.round((progress.done / progress.total) * 100);
}

export function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1_000_000;
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}
