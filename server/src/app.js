import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { handleUpload } from "@vercel/blob/client";
import { del } from "@vercel/blob";

import { extractPages } from "./pdfText.js";
import { synthesizePage, VOICES } from "./tts.js";
import { listBooks, getBook, putBook, updateBook, deleteBook, readPages, writePages } from "./store.js";

const app = express();
app.use(cors());
app.use(express.json());

// Explicit token on every Blob call, so a missing/rejected token fails fast
// instead of falling through to Vercel's OIDC path.
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

// Express 4 doesn't catch rejections thrown inside async handlers — without
// this, a bug in a route just hangs the request until the platform's own
// timeout kicks in, instead of failing fast with a real error.
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

app.get("/api/voices", (req, res) => {
  res.json(VOICES);
});

app.get(
  "/api/books",
  ah(async (req, res) => {
    res.json(await listBooks());
  })
);

app.get(
  "/api/books/:id",
  ah(async (req, res) => {
    const book = await getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "not found" });
    res.json(book);
  })
);

// Step 1: the browser asks us for a signed token, then uploads the PDF
// straight to Blob storage (bypassing the ~4.5MB serverless body limit).
app.post(
  "/api/blob-upload",
  ah(async (req, res) => {
    const jsonResponse = await handleUpload({
      token: blobToken,
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf"],
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({}),
      }),
      onUploadCompleted: async () => {},
    });
    res.json(jsonResponse);
  })
);

// Step 2: once the browser has uploaded the PDF to Blob, it calls this with
// the resulting blob URL so we can extract text and register the book.
app.post(
  "/api/books",
  ah(async (req, res) => {
    const { blobUrl, title: rawTitle } = req.body;
    if (!blobUrl) return res.status(400).json({ error: "blobUrl is required" });

    const pdfRes = await fetch(blobUrl);
    if (!pdfRes.ok) throw new Error("could not fetch uploaded PDF");
    const buffer = Buffer.from(await pdfRes.arrayBuffer());
    const pages = await extractPages(buffer);

    const id = nanoid(12);
    await writePages(id, pages);

    const fallbackTitle = decodeURIComponent(blobUrl.split("/").pop() || "Untitled").replace(/\.pdf$/i, "");
    const title = (rawTitle || fallbackTitle).trim();
    const book = await putBook({
      id,
      title,
      numPages: pages.length,
      createdAt: Date.now(),
      lastPage: 0,
      lastPosition: 0,
      voice: VOICES[0].id,
      rate: 1,
    });

    del(blobUrl, { token: blobToken }).catch(() => {}); // the source PDF isn't needed once we have its text

    res.status(201).json(book);
  })
);

app.delete(
  "/api/books/:id",
  ah(async (req, res) => {
    const book = await getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "not found" });
    await deleteBook(book.id);
    res.status(204).end();
  })
);

app.get(
  "/api/books/:id/pages/:page",
  ah(async (req, res) => {
    const book = await getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "not found" });
    const pages = await readPages(book.id);
    const pageIndex = Number(req.params.page);
    if (!pages || pageIndex < 0 || pageIndex >= pages.length) {
      return res.status(404).json({ error: "page out of range" });
    }
    res.json({ page: pageIndex, numPages: pages.length, text: pages[pageIndex] });
  })
);

app.patch(
  "/api/books/:id/progress",
  ah(async (req, res) => {
    const { page, position, voice, rate } = req.body;
    const patch = {};
    if (page !== undefined) patch.lastPage = page;
    if (position !== undefined) patch.lastPosition = position;
    if (voice !== undefined) patch.voice = voice;
    if (rate !== undefined) patch.rate = rate;
    const book = await updateBook(req.params.id, patch);
    if (!book) return res.status(404).json({ error: "not found" });
    res.json(book);
  })
);

app.get(
  "/api/books/:id/tts/:page",
  ah(async (req, res) => {
    const book = await getBook(req.params.id);
    if (!book) return res.status(404).json({ error: "not found" });
    const pages = await readPages(book.id);
    const pageIndex = Number(req.params.page);
    if (!pages || pageIndex < 0 || pageIndex >= pages.length) {
      return res.status(404).json({ error: "page out of range" });
    }
    const voice = req.query.voice || book.voice || VOICES[0].id;
    const rate = req.query.rate || book.rate || 1;
    const url = await synthesizePage(book.id, pageIndex, pages[pageIndex], voice, rate);
    res.redirect(302, url);
  })
);

// Final error handler — anything an `ah()`-wrapped route throws lands here
// instead of hanging the request.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "internal error" });
});

export default app;
