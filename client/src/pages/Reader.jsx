import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Loader2, SlidersHorizontal } from "lucide-react";
import { api } from "../api.js";
import { getPlayableAudioUrl, cacheAudio } from "../offlineCache.js";
import { useOfflineDownload } from "../useOfflineDownload.js";
import BottomSheet from "../components/BottomSheet.jsx";
import OfflineButton from "../components/OfflineButton.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];

function formatTime(s) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef(null);

  const [book, setBook] = useState(null);
  const [voices, setVoices] = useState([]);
  const [page, setPage] = useState(0);
  const [pageText, setPageText] = useState("");
  const [voice, setVoice] = useState(null);
  const [rate, setRate] = useState(1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [jumpValue, setJumpValue] = useState("");
  const [showSheet, setShowSheet] = useState(false);
  const [error, setError] = useState("");

  const shouldAutoplayRef = useRef(false);
  const objectUrlRef = useRef(null);
  const loadTokenRef = useRef(0);

  const offline = useOfflineDownload({ id, numPages: book?.numPages, voice, rate, title: book?.title });

  // Load book + voices once.
  useEffect(() => {
    Promise.all([api.getBook(id), api.getVoices()])
      .then(([b, v]) => {
        setBook(b);
        setVoices(v);
        setVoice(b.voice || v[0]?.id);
        setRate(b.rate || 1);
        setPage(b.lastPage || 0);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // Load page text whenever the page changes.
  useEffect(() => {
    if (!book) return;
    api
      .getPage(id, page)
      .then((p) => setPageText(p.text))
      .catch((e) => setError(e.message));
  }, [id, page, book]);

  // Persist progress (debounced-ish: fires on page/voice/rate change).
  useEffect(() => {
    if (!book || voice === null) return;
    const t = setTimeout(() => {
      api.updateProgress(id, { page, voice, rate }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [id, book, page, voice, rate]);

  // (Re)load audio source when page/voice/rate changes. Goes through the
  // offline cache: served instantly from Cache Storage if already
  // downloaded, otherwise fetched and cached for next time.
  useEffect(() => {
    if (!book || voice === null) return;
    const audio = audioRef.current;
    if (!audio) return;
    const token = ++loadTokenRef.current;
    setAudioLoading(true);
    setProgress({ current: 0, duration: 0 });
    const url = api.ttsUrl(id, page, voice, rate);
    getPlayableAudioUrl(url)
      .then((objectUrl) => {
        if (token !== loadTokenRef.current) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = objectUrl;
        audio.src = objectUrl;
        audio.load();
        if (shouldAutoplayRef.current) {
          audio.play().catch(() => {});
        }
      })
      .catch((e) => {
        if (token === loadTokenRef.current) {
          setAudioLoading(false);
          setError(e.message);
        }
      });
  }, [id, page, voice, rate, book]);

  // Revoke the last object URL on unmount.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // Prefetch the next page's audio in the background so page turns feel
  // instant, and so it's already cached for offline use.
  useEffect(() => {
    if (!book || voice === null) return;
    if (page + 1 >= book.numPages) return;
    const url = api.ttsUrl(id, page + 1, voice, rate);
    cacheAudio(url)
      .then(offline.refresh)
      .catch(() => {});
  }, [id, page, voice, rate, book, offline.refresh]);

  const goToPage = useCallback(
    (n, autoplay = isPlaying) => {
      if (!book) return;
      const clamped = Math.min(Math.max(n, 0), book.numPages - 1);
      shouldAutoplayRef.current = autoplay;
      setPage(clamped);
    },
    [book, isPlaying]
  );

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      shouldAutoplayRef.current = true;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  function handleEnded() {
    if (book && page + 1 < book.numPages) {
      goToPage(page + 1, true);
    } else {
      setIsPlaying(false);
    }
  }

  function handleJumpSubmit(e) {
    e.preventDefault();
    const n = parseInt(jumpValue, 10);
    if (Number.isFinite(n) && n >= 1) goToPage(n - 1);
    setJumpValue("");
    setShowSheet(false);
  }

  function handleSeek(e) {
    const audio = audioRef.current;
    if (!audio || !progress.duration) return;
    audio.currentTime = Number(e.target.value);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowRight") {
        goToPage(page + 1);
      } else if (e.code === "ArrowLeft") {
        goToPage(page - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pageProgressPct = useMemo(() => {
    if (!book?.numPages) return 0;
    return Math.round(((page + 1) / book.numPages) * 100);
  }, [page, book]);

  if (error) {
    return (
      <div className="min-h-full flex items-center justify-center text-center px-6">
        <div>
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => navigate("/")} className="text-violet-300 hover:underline">
            Back to library
          </button>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-violet-400" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur sticky top-0 z-10">
        <OfflineBanner />
        <div
          className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-white transition-colors p-2 -ml-2 rounded-lg hover:bg-white/5 shrink-0"
            aria-label="Back to library"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-white font-medium truncate text-sm sm:text-base">{book.title}</h1>
            <p className="text-xs text-gray-500">
              Page {page + 1} of {book.numPages} · {pageProgressPct}%
            </p>
          </div>
          {offline.supported && (
            <div className="hidden sm:block">
              <OfflineButton state={offline} onDownload={offline.download} onCancel={offline.cancel} label />
            </div>
          )}
          <button
            onClick={() => setShowSheet(true)}
            className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/10 border border-white/10 shrink-0"
            aria-label="Reading settings"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
        <div className="h-0.5 bg-white/5">
          <div className="h-full bg-violet-500 transition-all" style={{ width: `${pageProgressPct}%` }} />
        </div>
        {offline.notice && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-1.5 text-xs text-amber-300">{offline.notice}</div>
        )}
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-5 sm:px-6 py-8 sm:py-10 pb-40">
        {pageText ? (
          <p className="text-lg leading-relaxed text-gray-200 whitespace-pre-wrap">{pageText}</p>
        ) : (
          <p className="text-gray-600 italic">This page has no extractable text.</p>
        )}
      </main>

      <audio
        ref={audioRef}
        onCanPlay={() => setAudioLoading(false)}
        onWaiting={() => setAudioLoading(true)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onTimeUpdate={(e) =>
          setProgress({ current: e.currentTarget.currentTime, duration: e.currentTarget.duration || 0 })
        }
        onLoadedMetadata={(e) => {
          const duration = e.currentTarget.duration || 0;
          setProgress((p) => ({ ...p, duration }));
        }}
        onError={() => {
          setAudioLoading(false);
          setError("Couldn't generate audio for this page. Try again.");
        }}
      />

      <div className="fixed bottom-0 inset-x-0 border-t border-white/10 bg-[#0b0d12]/95 backdrop-blur">
        <div
          className="max-w-3xl mx-auto px-5 sm:px-6 pt-3"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 tabular-nums w-10 text-right">
              {formatTime(progress.current)}
            </span>
            <input
              type="range"
              min={0}
              max={progress.duration || 0}
              step={0.1}
              value={progress.current}
              onChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 tabular-nums w-10">{formatTime(progress.duration)}</span>
          </div>

          <div className="mt-3 flex items-center justify-center gap-6">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 0}
              className="p-3 rounded-full text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous page"
            >
              <SkipBack size={20} />
            </button>
            <button
              onClick={togglePlay}
              className="p-4 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-900/40 hover:brightness-110 transition"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {audioLoading ? (
                <Loader2 size={22} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={22} />
              ) : (
                <Play size={22} />
              )}
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page + 1 >= book.numPages}
              className="p-3 rounded-full text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Next page"
            >
              <SkipForward size={20} />
            </button>
          </div>
        </div>
      </div>

      <BottomSheet open={showSheet} onClose={() => setShowSheet(false)} title="Reading settings">
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={book.numPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            placeholder={`Jump to page (1–${book.numPages})`}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-400"
          />
          <button
            type="submit"
            className="text-sm px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
          >
            Go
          </button>
        </form>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">Voice</p>
          <select
            value={voice || ""}
            onChange={(e) => setVoice(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-400"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">Speed</p>
          <div className="flex flex-wrap gap-1.5">
            {RATES.map((r) => (
              <button
                key={r}
                onClick={() => setRate(r)}
                className={`text-xs px-3 py-1.5 rounded-md border ${
                  rate === r
                    ? "bg-violet-500/20 border-violet-400 text-violet-200"
                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>

        {offline.supported && (
          <div className="pt-1 border-t border-white/10">
            <div className="flex items-center justify-between pt-4">
              <div>
                <p className="text-sm text-white">Offline listening</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {offline.background
                    ? "Downloading in the background — you can close the app and it'll keep going."
                    : offline.isComplete
                    ? "Whole book downloaded for this voice & speed."
                    : `${offline.cachedCount} of ${book.numPages} pages downloaded for this voice & speed.`}
                </p>
              </div>
              <OfflineButton state={offline} onDownload={offline.download} onCancel={offline.cancel} size={38} />
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
