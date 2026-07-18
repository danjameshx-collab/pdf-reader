import { upload } from "@vercel/blob/client";

const BASE = "/api";

async function json(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  listBooks: () => fetch(`${BASE}/books`).then(json),
  getBook: (id) => fetch(`${BASE}/books/${id}`).then(json),
  deleteBook: (id) => fetch(`${BASE}/books/${id}`, { method: "DELETE" }),
  getPage: (id, page) => fetch(`${BASE}/books/${id}/pages/${page}`).then(json),
  getVoices: () => fetch(`${BASE}/voices`).then(json),
  updateProgress: (id, patch) =>
    fetch(`${BASE}/books/${id}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  ttsUrl: (id, page, voice, rate) =>
    `${BASE}/books/${id}/tts/${page}?voice=${encodeURIComponent(voice)}&rate=${rate}`,
  // Uploads go straight from the browser to Blob storage (bypassing the API's
  // request-size limit), then a small JSON call tells the server to extract
  // the text and register the book.
  uploadBook: async (file, title, onProgress) => {
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: `${BASE}/blob-upload`,
      onUploadProgress: (p) => onProgress?.(p.percentage / 100),
    });
    return fetch(`${BASE}/books`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blobUrl: blob.url, title }),
    }).then(json);
  },
};
