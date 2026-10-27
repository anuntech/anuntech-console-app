/*
 * What kind of file an item is, for its card (Arquivos): the label on the
 * badge ("PDF", "DOCX") and the group that picks the icon. Pure, by the
 * extension, so the card, the list and the tests agree.
 */

export type FileGroup = "image" | "video" | "audio" | "pdf" | "document" | "sheet" | "slides" | "archive" | "code" | "design" | "other";

const GROUPS: [FileGroup, string[]][] = [
  ["image", ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "svg", "tif", "tiff", "bmp", "ico", "raw", "dng"]],
  ["video", ["mp4", "mov", "m4v", "webm", "avi", "mkv", "wmv"]],
  ["audio", ["mp3", "m4a", "wav", "ogg", "aac", "flac", "opus"]],
  ["pdf", ["pdf"]],
  ["document", ["doc", "docx", "odt", "rtf", "txt", "md", "pages"]],
  ["sheet", ["xls", "xlsx", "xlsm", "csv", "tsv", "ods", "numbers"]],
  ["slides", ["ppt", "pptx", "key", "odp"]],
  ["archive", ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"]],
  ["code", ["json", "xml", "html", "htm", "css", "js", "ts", "tsx", "jsx", "py", "sql", "yml", "yaml", "sh"]],
  ["design", ["fig", "sketch", "xd", "ai", "psd", "eps", "indd", "afdesign"]],
];
const BY_EXTENSION = new Map(GROUPS.flatMap(([group, extensions]) => extensions.map((ext) => [ext, group] as const)));

export const extensionOf = (fileName: string | null | undefined) =>
  fileName && fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase().slice(0, 8) : "";

export function fileTypeOf(fileName: string | null | undefined): { group: FileGroup; label: string } {
  const ext = extensionOf(fileName);
  return { group: BY_EXTENSION.get(ext) ?? "other", label: ext ? ext.toUpperCase() : "ARQUIVO" };
}

/** The groups whose text, when read, is drawn on the card as a page. */
export const showsPage = (group: FileGroup) => group === "pdf" || group === "document" || group === "sheet" || group === "slides" || group === "code";
