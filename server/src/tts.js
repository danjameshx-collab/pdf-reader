import crypto from "node:crypto";
import { head, put } from "@vercel/blob";
import { EdgeTTS } from "edge-tts-universal";

// Pass the token explicitly on every call — @vercel/blob otherwise tries
// Vercel's OIDC auth first, which hangs indefinitely on this project.
const token = process.env.BLOB_READ_WRITE_TOKEN;

// Curated set of natural-sounding Edge neural voices worth surfacing in the UI.
export const VOICES = [
  { id: "en-US-AndrewMultilingualNeural", label: "Andrew (US, male, warm)" },
  { id: "en-US-AvaMultilingualNeural", label: "Ava (US, female, warm)" },
  { id: "en-US-BrianMultilingualNeural", label: "Brian (US, male, deep)" },
  { id: "en-US-EmmaMultilingualNeural", label: "Emma (US, female, bright)" },
  { id: "en-GB-RyanNeural", label: "Ryan (UK, male)" },
  { id: "en-GB-SoniaNeural", label: "Sonia (UK, female)" },
  { id: "en-AU-NatashaNeural", label: "Natasha (AU, female)" },
  { id: "en-IE-ConnorNeural", label: "Connor (Irish, male)" },
];

function cachePathname(bookId, pageIndex, voice, rate) {
  const hash = crypto
    .createHash("sha1")
    .update(`${bookId}:${pageIndex}:${voice}:${rate}`)
    .digest("hex");
  return `audio/${hash}.mp3`;
}

// Edge's SSML rate wants a signed percentage, e.g. "+20%" or "-10%".
function rateToProsody(rate) {
  const pct = Math.round((Number(rate) - 1) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/**
 * Synthesize (or reuse cached) audio for a page and return its public URL.
 */
export async function synthesizePage(bookId, pageIndex, text, voice, rate) {
  const pathname = cachePathname(bookId, pageIndex, voice, rate);

  try {
    const info = await head(pathname, { token });
    return info.url;
  } catch (e) {
    if (e.name !== "BlobNotFoundError") throw e;
  }

  if (!text || !text.trim()) {
    text = "Blank page.";
  }

  const tts = new EdgeTTS(text, voice, { rate: rateToProsody(rate) });
  const result = await tts.synthesize();
  const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

  const blob = await put(pathname, audioBuffer, {
    access: "public",
    contentType: "audio/mpeg",
    addRandomSuffix: false,
    token,
  });
  return blob.url;
}
