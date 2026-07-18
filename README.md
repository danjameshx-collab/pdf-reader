# PDF Listener

Upload a PDF, listen to it read aloud with natural neural voices, and resume from any page.

## Stack

- **Backend** (`server/`): Node/Express. Extracts per-page text from PDFs with `pdfjs-dist`,
  synthesizes speech with `edge-tts-universal` (Microsoft Edge's free neural "Read Aloud"
  voices — no API key, no per-character cost), and caches generated audio to disk so a page
  is only ever synthesized once.
- **Frontend** (`client/`): React + Vite + Tailwind. Library view for uploads, reader view
  with a sticky audio player, page jump, voice/speed picker, and progress that's saved per
  book so you can pick up on any device.

## Run it locally

```bash
# Terminal 1 — backend (port 4000)
cd server
npm install
npm run dev

# Terminal 2 — frontend (port 5173, proxies /api to the backend)
cd client
npm install
npm run dev
```

Open http://localhost:5173.

## Data

Uploaded PDFs, extracted page text, and cached mp3s live under `server/uploads`,
`server/data`, and `server/cache`. Book/progress metadata is a flat JSON file at
`server/data/books.json` — fine for personal use; swap for a real DB if this grows.

## Deploying

Both halves are stateless aside from the `server/{uploads,data,cache}` folders — put those
on a persistent volume wherever you host it (a small VPS, Fly.io, Render, etc. all work).
Build the client with `npm run build` in `client/` and serve the static output from the
Express app (or a static host) pointed at the backend's `/api`.
