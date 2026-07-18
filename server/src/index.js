import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

import { extractPages } from "./pdfText.js";
import { synthesizePage, VOICES } from "./tts.js";
import {
  UPLOADS_DIR,
  listBooks,
  getBook,
  putBook,
  updateBook,
  deleteBook,
  readPages,
  writePages,
  pagesFile,
} from "./store.js";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf"));
  },
});

app.get("/api/voices", (req, res) => {
  res.json(VOICES);
});

app.get("/api/books", (req, res) => {
  res.json(listBooks());
});

app.get("/api/books/:id", (req, res) => {
  const book = getBook(req.params.id);
  if (!book) return res.status(404).json({ error: "not found" });
  res.json(book);
});

app.post("/api/books", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no PDF uploaded" });
  try {
    const buffer = fs.readFileSync(req.file.path);
    const pages = await extractPages(buffer);
    const id = nanoid(12);
    const storedFile = `${id}.pdf`;
    fs.renameSync(req.file.path, path.join(UPLOADS_DIR, storedFile));
    writePages(id, pages);

    const title = (req.body.title || req.file.originalname.replace(/\.pdf$/i, "")).trim();
    const book = putBook({
      id,
      title,
      storedFile,
      numPages: pages.length,
      createdAt: Date.now(),
      lastPage: 0,
      lastPosition: 0,
      voice: VOICES[0].id,
      rate: 1,
    });
    res.status(201).json(book);
  } catch (err) {
    fs.rm(req.file.path, { force: true }, () => {});
    console.error(err);
    res.status(500).json({ error: "failed to process PDF: " + err.message });
  }
});

app.delete("/api/books/:id", (req, res) => {
  const book = getBook(req.params.id);
  if (!book) return res.status(404).json({ error: "not found" });
  fs.rm(path.join(UPLOADS_DIR, book.storedFile), { force: true }, () => {});
  fs.rm(pagesFile(book.id), { force: true }, () => {});
  deleteBook(book.id);
  res.status(204).end();
});

app.get("/api/books/:id/pages/:page", (req, res) => {
  const book = getBook(req.params.id);
  if (!book) return res.status(404).json({ error: "not found" });
  const pages = readPages(book.id);
  const pageIndex = Number(req.params.page);
  if (!pages || pageIndex < 0 || pageIndex >= pages.length) {
    return res.status(404).json({ error: "page out of range" });
  }
  res.json({ page: pageIndex, numPages: pages.length, text: pages[pageIndex] });
});

app.patch("/api/books/:id/progress", (req, res) => {
  const { page, position, voice, rate } = req.body;
  const patch = {};
  if (page !== undefined) patch.lastPage = page;
  if (position !== undefined) patch.lastPosition = position;
  if (voice !== undefined) patch.voice = voice;
  if (rate !== undefined) patch.rate = rate;
  const book = updateBook(req.params.id, patch);
  if (!book) return res.status(404).json({ error: "not found" });
  res.json(book);
});

app.get("/api/books/:id/tts/:page", async (req, res) => {
  const book = getBook(req.params.id);
  if (!book) return res.status(404).json({ error: "not found" });
  const pages = readPages(book.id);
  const pageIndex = Number(req.params.page);
  if (!pages || pageIndex < 0 || pageIndex >= pages.length) {
    return res.status(404).json({ error: "page out of range" });
  }
  const voice = req.query.voice || book.voice || VOICES[0].id;
  const rate = req.query.rate || book.rate || 1;
  try {
    const file = await synthesizePage(book.id, pageIndex, pages[pageIndex], voice, rate);
    res.sendFile(file, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "TTS failed: " + err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`pdf-listener server on http://localhost:${PORT}`));
