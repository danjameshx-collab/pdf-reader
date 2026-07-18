import { put, get, del, BlobNotFoundError } from "@vercel/blob";

// Pass the token explicitly on every call — @vercel/blob otherwise tries
// Vercel's OIDC auth first, which hangs indefinitely on this project.
const token = process.env.BLOB_READ_WRITE_TOKEN;

// This Blob store only allows private access, so reads go through the
// authenticated `get()` call (a stream) rather than a public blob URL.
const ACCESS = "private";

const BOOKS_KEY = "books.json";

async function getJson(pathname) {
  try {
    const result = await get(pathname, { access: ACCESS, token });
    if (!result) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}

async function putJson(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });
}

async function loadDb() {
  return (await getJson(BOOKS_KEY)) || { books: {} };
}

export async function listBooks() {
  const db = await loadDb();
  return Object.values(db.books).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getBook(id) {
  const db = await loadDb();
  return db.books[id] || null;
}

export async function putBook(book) {
  const db = await loadDb();
  db.books[book.id] = book;
  await putJson(BOOKS_KEY, db);
  return book;
}

export async function updateBook(id, patch) {
  const db = await loadDb();
  if (!db.books[id]) return null;
  db.books[id] = { ...db.books[id], ...patch };
  await putJson(BOOKS_KEY, db);
  return db.books[id];
}

export async function deleteBook(id) {
  const db = await loadDb();
  delete db.books[id];
  await putJson(BOOKS_KEY, db);
  await del(`pages/${id}.json`, { token }).catch(() => {});
}

export async function readPages(id) {
  return await getJson(`pages/${id}.json`);
}

export async function writePages(id, pages) {
  await putJson(`pages/${id}.json`, pages);
}
