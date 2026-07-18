import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

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
