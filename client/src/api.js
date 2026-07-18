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
  uploadBook: (file, title, onProgress) =>
    new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      if (title) form.append("title", title);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/books`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || "Upload failed"));
        } catch {
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(form);
    }),
};
