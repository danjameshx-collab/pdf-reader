import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// A mobile-style sheet that slides up from the bottom on small screens and
// behaves like a centered modal on larger ones. Closes on backdrop click or
// Escape. Rendered via a portal into document.body — several callers (e.g.
// library cards) render this inside their own onClick-handling container,
// and without a portal, clicks inside the sheet would bubble up through
// that ancestor's DOM tree and trigger its handler too.
export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.code === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:w-[26rem] sm:rounded-2xl rounded-t-2xl border border-white/10 bg-[#14161d] shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-1 sm:pt-4">
          <h2 className="text-white font-medium">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 -mr-1.5 rounded-lg hover:bg-white/10"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-4 pt-2 space-y-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
