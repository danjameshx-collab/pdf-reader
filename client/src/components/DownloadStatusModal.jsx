import { Check, Download, Loader2 } from "lucide-react";
import BottomSheet from "./BottomSheet.jsx";
import { downloadPct, formatBytes } from "../downloadProgress.js";

// The single place offline-download status and controls live — opened by
// tapping the OfflineButton indicator anywhere it appears (library card or
// reader header), in any state (idle, in progress, or finished).
export default function DownloadStatusModal({ open, onClose, title, numPages, state, onDownload, onCancel }) {
  const { downloading, background, progress, isComplete, cachedCount, notice } = state;
  const pct = downloadPct(progress, background);

  return (
    <BottomSheet open={open} onClose={onClose} title="Offline listening">
      <p className="text-sm text-gray-400 truncate -mt-2">{title}</p>

      {isComplete ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <span className="shrink-0 w-9 h-9 rounded-full bg-emerald-500/15 grid place-items-center text-emerald-400">
            <Check size={18} />
          </span>
          <div>
            <p className="text-sm text-white font-medium">Downloaded</p>
            <p className="text-xs text-gray-400 mt-0.5">All {numPages} pages are available offline.</p>
          </div>
        </div>
      ) : downloading ? (
        <div className="space-y-3">
          {background ? (
            <div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <Loader2 size={20} className="animate-spin text-violet-400 shrink-0" />
                <div>
                  <p className="text-sm text-white">Downloading in the background</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    You can close the app — Chrome will keep going and show its own progress notification too.
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm text-white mb-1.5">
                  <span>{formatBytes(progress.downloadedBytes)} downloaded</span>
                  <span className="text-gray-400">{pct === null ? "…" : `~${pct}%`}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full bg-violet-400 transition-all ${pct === null ? "w-1/3 animate-pulse" : ""}`}
                    style={pct === null ? undefined : { width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Estimated — exact size varies page to page.</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-sm text-white mb-1.5">
                <span>
                  {progress.done} of {progress.total} pages
                </span>
                <span className="text-gray-400">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-violet-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <button
            onClick={onCancel}
            className="w-full text-sm px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
          >
            Cancel download
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            {cachedCount > 0
              ? `${cachedCount} of ${numPages} pages already downloaded — pick up where it left off.`
              : `Not downloaded yet · ${numPages} pages.`}
          </p>
          <button
            onClick={onDownload}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-400/40"
          >
            <Download size={16} />
            {cachedCount > 0 ? "Resume download" : "Download for offline"}
          </button>
        </div>
      )}

      {notice && <p className="text-xs text-amber-300">{notice}</p>}
    </BottomSheet>
  );
}
