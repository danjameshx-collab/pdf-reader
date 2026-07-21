import { Download, Check, X } from "lucide-react";

// Circular icon button used on library cards; also the basis for the
// labelled pill variant used in the reader header. Shows idle / in-progress
// (as a ring) / complete states at a glance — tooltips alone aren't
// discoverable on touch, so callers needing clarity on mobile should use
// `label`.
export default function OfflineButton({ state, onDownload, onCancel, size = 34, label = false, className = "" }) {
  const { downloading, progress, isComplete, cachedCount } = state;
  const pct = downloading && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  if (downloading) {
    const ring = (
      <span
        className="relative shrink-0 rounded-full grid place-items-center"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(#a78bfa ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
        }}
      >
        <span className="absolute inset-[3px] rounded-full bg-[#14161d] grid place-items-center">
          <X size={size * 0.4} />
        </span>
      </span>
    );
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        title={`Downloading… ${progress.done}/${progress.total} (tap to cancel)`}
        className={
          label
            ? `flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 ${className}`
            : `text-gray-300 hover:text-white ${className}`
        }
      >
        {ring}
        {label && <span>{pct}%</span>}
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
    if (!label) return <div title="Downloaded for offline listening" className={className}>{badge}</div>;
    return (
      <div
        title="Downloaded for offline listening"
        className={`flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 ${className}`}
      >
        {badge}
        <span>Offline</span>
      </div>
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
      onClick={(e) => {
        e.stopPropagation();
        onDownload();
      }}
      title={cachedCount > 0 ? `Resume download (${cachedCount} pages cached)` : "Download for offline listening"}
      className={
        label
          ? `flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 hover:text-white ${className}`
          : `hover:bg-white/10 border border-white/10 rounded-full text-gray-300 hover:text-white ${className}`
      }
    >
      {icon}
      {label && <span>{cachedCount > 0 ? `${cachedCount} cached` : "Download"}</span>}
    </button>
  );
}
