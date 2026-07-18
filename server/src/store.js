import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "..", "data");
export const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
export const CACHE_DIR = path.join(__dirname, "..", "cache");
const DB_FILE = path.join(DATA_DIR, "books.json");

for (const dir of [DATA_DIR, UPLOADS_DIR, CACHE_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function load() {
  if (!fs.existsSync(DB_FILE)) return { books: {} };
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function listBooks() {
  const db = load();
  return Object.values(db.books).sort((a, b) => b.createdAt - a.createdAt);
}

export function getBook(id) {
  const db = load();
  return db.books[id] || null;
}

export function putBook(book) {
  const db = load();
  db.books[book.id] = book;
  save(db);
  return book;
}

export function updateBook(id, patch) {
  const db = load();
  if (!db.books[id]) return null;
  db.books[id] = { ...db.books[id], ...patch };
  save(db);
  return db.books[id];
}

export function deleteBook(id) {
  const db = load();
  delete db.books[id];
  save(db);
}

export function pagesFile(id) {
  return path.join(DATA_DIR, `${id}.pages.json`);
}

export function readPages(id) {
  const file = pagesFile(id);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function writePages(id, pages) {
  fs.writeFileSync(pagesFile(id), JSON.stringify(pages));
}
