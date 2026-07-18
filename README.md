# PDF Listener

Upload a PDF, listen to it read aloud with natural neural voices, and resume from any page.

## Stack

- **API** (`api/` + `server/src/`): Express app (deployed as a single Vercel serverless
  function). Extracts per-page text from PDFs with `pdfjs-dist`, synthesizes speech with
  `edge-tts-universal` (Microsoft Edge's free neural "Read Aloud" voices — no API key, no
  per-character cost), and caches generated audio in **Vercel Blob** so a page is only ever
  synthesized once. Book/progress metadata and extracted page text also live in Blob (as
  JSON), since serverless functions have no persistent local disk.
- **Frontend** (`client/`): React + Vite + Tailwind. Library view for uploads (PDFs upload
  directly from the browser to Blob storage, bypassing the API's request-size limit), reader
  view with a sticky audio player, page jump, voice/speed picker, and progress saved per book
  so you can pick up on any device.

## Deploying to Vercel

1. Import this repo into Vercel (already done if you're reading this after a deploy).
2. In the project's **Storage** tab, add a **Blob** store and connect it to the project —
   this automatically sets the `BLOB_READ_WRITE_TOKEN` environment variable.
3. Redeploy (or it'll happen automatically on the next push). `vercel.json` at the repo root
   already wires up the build: it builds `client/` as the static site and deploys `api/index.js`
   as the serverless function handling everything under `/api/*`.

## Run it locally

Local dev also talks to Vercel Blob (there's no local-disk fallback), so you need a token:

```bash
npx vercel login
npx vercel link          # link this folder to the Vercel project
npx vercel env pull .env.local
```

Then:

```bash
# Terminal 1 — backend (port 4000), reads BLOB_READ_WRITE_TOKEN from .env.local
npm install
npm run dev

# Terminal 2 — frontend (port 5173, proxies /api to the backend)
cd client
npm install
npm run dev
```

Open http://localhost:5173.
