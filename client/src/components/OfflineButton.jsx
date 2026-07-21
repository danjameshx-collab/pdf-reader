import { Download, Check, Loader2 } from "lucide-react";
import { downloadPct } from "../downloadProgress.js";

// Status indicator — idle / in-progress (ring) / complete (check) — used on
// library cards and in the reader header. Purely informational at a glance;
// tapping it (any state) opens DownloadStatusModal, which holds the actual
// start/cancel controls.
export default function OfflineButton({ state, onOpen, size = 34, label = false, className = "" }) {
  const { downloading, background, progress, isComplete, cachedCount } = state;
  const pct = downloadPct(progress, background);
  const indeterminate = pct === null;

  const handleClick = (e) => {
    e.stopPropagation();
    onOpen();
  };

  if (downloading) {
    const ring = (
      <span
        className={`relative shrink-0 rounded-full grid place-items-center ${indeterminate ? "animate-spin" : ""}`}
        style={
          indeterminate
            ? { width: size, height: size, background: "conic-gradient(#a78bfa, rgba(255,255,255,0.1))" }
            : {
                width: size,
                height: size,
                background: `conic-gradient(#a78bfa ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
              }
        }
      >
        <span
          className={`absolute inset-[3px] rounded-full bg-[#14161d] grid place-items-center ${
            indeterminate ? "animate-[spin_1s_linear_infinite_reverse]" : ""
          }`}
        >
          <Loader2 size={size * 0.4} className={indeterminate ? "" : "animate-spin"} />
        </span>
      </span>
    );
    return (
      <button
        onClick={handleClick}
        title={
          background
            ? indeterminate
              ? "Downloading in the background"
              : `Downloading in the background… ${pct}%`
            : `Downloading… ${progress.done}/${progress.total}`
        }
        className={
          label
            ? `flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 ${className}`
            : `hover:opacity-80 ${className}`
        }
      >
        {ring}
        {label && <span>{indeterminate ? "Downloading…" : `${pct}%`}</span>}
      </button>
    );
  }

  if (isComplete) {
    const badge = (
      <span
        className="shrink-0 rounded-full grid place-items-center bg-emerald-500/15 text-emerald-400"
        style={{ width: size, height: size }}
      >
        <Check size={size * 0.5} />
      </span>
    );
    return (
      <button
        onClick={handleClick}
        title="Downloaded for offline listening"
        className={
          label
            ? `flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-xs text-emerald-400 ${className}`
            : `hover:opacity-80 ${className}`
        }
      >
        {badge}
        {label && <span>Offline</span>}
      </button>
    );
  }

  const icon = (
    <span
      className="shrink-0 rounded-full grid place-items-center bg-white/5 text-gray-300"
      style={{ width: size, height: size }}
    >
      <Download size={size * 0.45} />
    </span>
  );

  return (
    <button
      onClick={handleClick}
      title={cachedCount > 0 ? `Resume download (${cachedCount} pages cached)` : "Download for offline listening"}
      className={
        label
          ? `flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white ${className}`
          : `hover:opacity-80 ${className}`
      }
    >
      {icon}
      {label && <span>{cachedCount > 0 ? `${cachedCount} cached` : "Download"}</span>}
    </button>
  );
}
