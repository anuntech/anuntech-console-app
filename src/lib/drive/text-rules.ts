import { unzipSync } from "fflate";

/*
 * The text inside a file, for Arquivos' content search (phase 4). Pure (no
 * database, no R2), so the tests read the same documents the routine does.
 * Office files are zips of XML: the text is what sits between the tags, with
 * a line where a paragraph, a slide or a row ends. PDFs go through unpdf, in
 * text-extract.ts.
 */

export type TextKind = "pdf" | "docx" | "pptx" | "xlsx" | "odf" | "html" | "plain";

/** How much text a file keeps for the search: about 40 pages. */
export const TEXT_MAX_CHARS = 100_000;
/** Files bigger than this are not read (the routine downloads the whole file). */
export const TEXT_SOURCE_MAX_BYTES = 50 * 1024 * 1024;
/** One entry of a zip, once inflated: past this, it is not read (a zip bomb stops here). */
const ZIP_ENTRY_MAX_BYTES = 30 * 1024 * 1024;

const KINDS: Record<string, TextKind> = {
  pdf: "pdf",
  docx: "docx",
  docm: "docx",
  pptx: "pptx",
  pptm: "pptx",
  xlsx: "xlsx",
  xlsm: "xlsx",
  odt: "odf",
  ods: "odf",
  odp: "odf",
  html: "html",
  htm: "html",
  txt: "plain",
  md: "plain",
  csv: "plain",
  tsv: "plain",
  json: "plain",
  xml: "plain",
  log: "plain",
  yml: "plain",
  yaml: "plain",
};

export function textKindOf(fileName: string): TextKind | null {
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  return KINDS[ext] ?? null;
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** One space between words, at most one blank line, no NUL (Postgres refuses it), cut at the limit. */
export function tidyText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, TEXT_MAX_CHARS);
}

/** The words of an XML part: a line where `breaks` close, a tab for `tabs`, nothing of what `drop` holds. */
function xmlWords(xml: string, { breaks, tabs = [], drop = [] }: { breaks: string[]; tabs?: string[]; drop?: string[] }) {
  let out = xml;
  for (const tag of drop) out = out.replace(new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, "g"), "");
  for (const tag of tabs) out = out.replace(new RegExp(`<${tag}\\s*/>`, "g"), "\t");
  for (const tag of breaks) out = out.replace(new RegExp(`</${tag}>|<${tag}\\s*/>`, "g"), "\n");
  return decodeEntities(out.replace(/<[^>]+>/g, ""));
}

const utf8 = new TextDecoder("utf-8");
const byNumber = (a: string, b: string) => Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0) - Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);

function unzip(bytes: Uint8Array, wanted: (name: string) => boolean) {
  const files = unzipSync(bytes, { filter: (file) => wanted(file.name) && file.originalSize <= ZIP_ENTRY_MAX_BYTES });
  return Object.fromEntries(Object.entries(files).map(([name, data]) => [name, utf8.decode(data)]));
}

function docxText(bytes: Uint8Array) {
  const parts = unzip(bytes, (name) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(name));
  const order = ["word/document.xml", ...Object.keys(parts).filter((n) => n !== "word/document.xml").sort()];
  return order
    .filter((name) => parts[name])
    .map((name) => xmlWords(parts[name], { breaks: ["w:p", "w:br", "w:cr"], tabs: ["w:tab"], drop: ["w:instrText", "w:delText"] }))
    .join("\n");
}

function pptxText(bytes: Uint8Array) {
  const parts = unzip(bytes, (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  return Object.keys(parts)
    .sort(byNumber)
    .map((name) => xmlWords(parts[name], { breaks: ["a:p", "a:br"] }))
    .join("\n\n");
}

function xlsxText(bytes: Uint8Array) {
  const parts = unzip(bytes, (name) => name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const shared = [...(parts["xl/sharedStrings.xml"] ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlWords(m[1], { breaks: [] }));
  const sheets = Object.keys(parts)
    .filter((name) => name.startsWith("xl/worksheets/"))
    .sort(byNumber);
  const lines: string[] = [];
  for (const name of sheets) {
    for (const row of parts[name].matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [...row[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, attrs, inner = ""]) => {
        const type = attrs.match(/\st="([^"]+)"/)?.[1];
        if (type === "inlineStr") return xmlWords(inner, { breaks: [] });
        const value = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
        return type === "s" ? (shared[Number(value)] ?? "") : decodeEntities(value);
      });
      const line = cells.filter(Boolean).join("\t");
      if (line) lines.push(line);
      if (lines.length > 20_000) break;
    }
    lines.push("");
  }
  return lines.join("\n");
}

function odfText(bytes: Uint8Array) {
  const parts = unzip(bytes, (name) => name === "content.xml");
  return parts["content.xml"] ? xmlWords(parts["content.xml"], { breaks: ["text:p", "text:h", "table:table-row", "text:line-break"], tabs: ["text:tab"] }) : "";
}

export function htmlText(html: string) {
  const body = html.replace(/<(script|style|noscript|template)[\s>][\s\S]*?<\/\1>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  return decodeEntities(body.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, " "));
}

/** The text of a file that is not a PDF; null when the kind has none. A broken zip throws. */
export function documentText(bytes: Uint8Array, kind: Exclude<TextKind, "pdf">) {
  switch (kind) {
    case "docx":
      return tidyText(docxText(bytes));
    case "pptx":
      return tidyText(pptxText(bytes));
    case "xlsx":
      return tidyText(xlsxText(bytes));
    case "odf":
      return tidyText(odfText(bytes));
    case "html":
      return tidyText(htmlText(utf8.decode(bytes.subarray(0, TEXT_MAX_CHARS * 4))));
    case "plain":
      return tidyText(utf8.decode(bytes.subarray(0, TEXT_MAX_CHARS * 4)));
  }
}

/** Accents out, for the search on both sides (the SQL in file-index.ts uses the same letters). */
export const ACCENTED = "áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ";
export const PLAIN = "aaaaaaeeeeiiiiooooouuuucnyyAAAAAAEEEEIIIIOOOOOUUUUCNY";
