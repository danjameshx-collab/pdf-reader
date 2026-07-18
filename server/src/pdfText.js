import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

// pdf.js resolves its worker script dynamically, which serverless bundlers
// can't detect via static analysis — point it at the file explicitly (as a
// file:// URL, required for the ESM loader on Windows too) so it resolves
// correctly once bundled (paired with `includeFiles` in vercel.json to make
// sure the file actually ships with the function).
GlobalWorkerOptions.workerSrc = import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");

// Joins PDF text-content items into readable page text, restoring
// paragraph breaks that pdf.js loses (each item is just a positioned run).
function itemsToText(items) {
  let text = "";
  let lastY = null;
  for (const item of items) {
    if (lastY !== null && item.transform[5] !== lastY) {
      text += /\s$/.test(text) ? "" : " ";
    }
    text += item.str;
    if (item.hasEOL) text += "\n";
    lastY = item.transform[5];
  }
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractPages(buffer) {
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const doc = await loadingTask.promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(itemsToText(content.items));
    page.cleanup();
  }
  await doc.destroy();
  return pages;
}
