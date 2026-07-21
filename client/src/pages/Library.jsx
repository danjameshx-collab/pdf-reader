import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, BookOpen, Trash2, Headphones, Loader2 } from "lucide-react";
import { api } from "../api.js";
import { useOfflineDownload } from "../useOfflineDownload.js";
import OfflineButton from "../components/OfflineButton.jsx";
import OfflineBanner from "../components/OfflineBanner.jsx";

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function BookCard({ book, onOpen, onDelete }) {
  const offline = useOfflineDownload({
    id: book.id,
    numPages: book.numPages,
    voice: book.voice,
    rate: book.rate,
    title: book.title,
  });
  const pct = book.numPages ? Math.round(((book.lastPage + 1) / book.numPages) * 100) : 0;

  return (
    <div
      onClick={onOpen}
      className="group relative rounded-xl border border-white/10 bg-white/[0.03] active:bg-white/[0.06] sm:hover:bg-white/[0.06] sm:hover:border-white/20 transition-colors p-4 sm:p-5 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
          <BookOpen size={18} className="text-violet-300" />
        </div>
        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {offline.supported && (
            <OfflineButton state={offline} onDownload={offline.download} onCancel={offline.cancel} size={30} />
          )}
          <button
            onClick={onDelete}
            className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-white/5"
            title="Delete"
            aria-label="Delete book"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <h3 className="mt-4 text-white font-medium leading-snug line-clamp-2">{book.title}</h3>
      <p className="mt-1 text-xs text-gray-500">
        {book.numPages} pages · added {formatDate(book.createdAt)}
      </p>
      <div className="mt-4">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-violet-400" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {book.lastPage > 0 ? `Page ${book.lastPage + 1} of ${book.numPages} · ${pct}%` : "Not started"}
        </p>
      </div>
    </div>
  );
}

export default function Library() {
  const [books, setBooks] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(null); // { name, progress } | null
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const refresh = () => api.listBooks().then(setBooks).catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
  }, []);

  async function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setError("");
    setUploading({ name: file.name, progress: 0 });
    try {
      const book = await api.uploadBook(file, undefined, (p) =>
        setUploading((u) => (u ? { ...u, progress: p } : u))
      );
      setUploading(null);
      await refresh();
      navigate(`/book/${book.id}`);
    } catch (e) {
      setUploading(null);
      setError(e.message);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm("Delete this book and its cached audio?")) return;
    await api.deleteBook(id);
    refresh();
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur sticky top-0 z-10">
        <OfflineBanner />
        <div
          className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-900/40 shrink-0">
            <Headphones size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight">PDF Listener</h1>
            <p className="text-xs text-gray-400">Your library, read aloud</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-colors ${
            dragOver ? "border-violet-400 bg-violet-500/10" : "border-white/15 active:border-white/25 sm:hover:border-white/25 bg-white/[0.02]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-violet-400" size={28} />
              <p className="text-sm text-gray-300">
                Uploading &amp; extracting text from <span className="text-white">{uploading.name}</span>
              </p>
              <div className="w-64 max-w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-violet-400 transition-all"
                  style={{ width: `${Math.round(uploading.progress * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <Upload size={22} className="text-violet-300" />
              </div>
              <p className="text-white font-medium">
                <span className="sm:hidden">Tap to upload a PDF</span>
                <span className="hidden sm:inline">Drop a PDF here, or click to upload</span>
              </p>
              <p className="text-sm text-gray-500">We'll extract the text and get it ready to read aloud</p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="mt-8 sm:mt-10">
          {books === null ? (
            <p className="text-gray-500 text-sm">Loading library…</p>
          ) : books.length === 0 ? (
            <p className="text-gray-500 text-sm">No books yet — upload your first PDF above.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {books.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  onOpen={() => navigate(`/book/${b.id}`)}
                  onDelete={(e) => handleDelete(b.id, e)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
