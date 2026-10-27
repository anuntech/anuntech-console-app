import "server-only";
import { getDocumentProxy } from "unpdf";
import { TEXT_MAX_CHARS, documentText, textKindOf, tidyText } from "./text-rules";

export type Extracted = { status: "done"; text: string } | { status: "skipped"; reason: string };

/** A PDF's text, page by page, until the limit (a long PDF is not read to the end for nothing). */
async function pdfText(bytes: Uint8Array) {
  // pdf.js takes the buffer over; a copy keeps the caller's intact.
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { useSystemFonts: false, disableFontFace: true });
  try {
    const pages: string[] = [];
    let length = 0;
    for (let number = 1; number <= pdf.numPages && length < TEXT_MAX_CHARS; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : "")).join("");
      pages.push(text);
      length += text.length;
      page.cleanup();
    }
    return tidyText(pages.join("\n\n"));
  } finally {
    await pdf.cleanup();
    // pdf.js has destroy() on the document (it ends the loading task), missing from its types.
    await (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.();
  }
}

/**
 * The text of a file, for the content search. A kind without text, or a
 * document with none (a scanned PDF, an empty sheet), is skipped with the
 * reason; a broken or locked file throws, and the routine tries again later.
 */
export async function extractFileText(bytes: Uint8Array, fileName: string): Promise<Extracted> {
  const kind = textKindOf(fileName);
  if (!kind) return { status: "skipped", reason: "Tipo de arquivo sem texto para a busca." };
  const text = kind === "pdf" ? await pdfText(bytes) : documentText(bytes, kind);
  return text ? { status: "done", text } : { status: "skipped", reason: kind === "pdf" ? "PDF sem texto (pode ser uma imagem escaneada)." : "Arquivo sem texto." };
}
