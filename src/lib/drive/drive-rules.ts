/*
 * Arquivos (the Bookmarks area as a drive): the limits of a file kept in
 * Cloudflare R2. Pure, so the uploader, the routes and the tests share it.
 * Kauan's decisions of 26/10/2026: up to 100 GB per file, 5 GB per client
 * company by default; Anuntech's own space has no quota.
 */

const GB = 1024 ** 3;
const MB = 1024 ** 2;

export const MAX_FILE_BYTES = 100 * GB;
export const DEFAULT_COMPANY_QUOTA_BYTES = 5 * GB;

/** S3 multipart: parts of 5 MB to 5 GB, at most 10,000 of them. */
const MIN_PART = 16 * MB;
const MAX_PARTS = 10_000;
/** How many part addresses the uploader asks for at a time. */
export const PART_URL_BATCH = 100;
/** A started upload not finished in this time is abandoned (the bucket's lifecycle aborts it too). */
export const UPLOAD_TTL_HOURS = 72;

/** The part size for a file: 16 MB, or larger so the file never needs more than 9,000 parts. */
export function partSizeFor(size: number) {
  const needed = Math.ceil(size / (MAX_PARTS - 1000));
  return Math.max(MIN_PART, Math.ceil(needed / MB) * MB);
}

export const partCountFor = (size: number, partSize = partSizeFor(size)) => Math.max(1, Math.ceil(size / partSize));

/** "512 KB", "3,4 MB", "1,2 GB". */
export function bytesLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
}

/**
 * Why a new file cannot start, or null. `used` counts the space's files and
 * the uploads still under way; `quota` null means no limit (Anuntech's space).
 */
export function uploadRefusal(input: { size: number; used: number; quota: number | null }) {
  if (!Number.isFinite(input.size) || input.size <= 0) return "Selecione um arquivo com conteúdo.";
  if (input.size > MAX_FILE_BYTES) return `Escolha um arquivo de até ${bytesLabel(MAX_FILE_BYTES)}.`;
  if (input.quota !== null && input.used + input.size > input.quota) {
    const left = Math.max(0, input.quota - input.used);
    return `O espaço da empresa acabou: restam ${bytesLabel(left)} de ${bytesLabel(input.quota)}. Exclua arquivos ou fale com a Anuntech para aumentar.`;
  }
  return null;
}

/** The object's key in the bucket: by space, never by name, so nothing about the file shows in the key. */
export const storageKeyFor = (companyId: string | null, uploadId: string) => `${companyId ?? "anuntech"}/${uploadId}`;

/** A file name safe for a header and the key-less download: no path, no control characters, at most 200 characters. */
export function cleanFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (clean || "arquivo").slice(0, 200);
}

export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text";

/** What the Console shows without a download, by extension; the content type it is served with. */
const PREVIEWS: Record<string, { kind: PreviewKind; type: string }> = {
  png: { kind: "image", type: "image/png" },
  jpg: { kind: "image", type: "image/jpeg" },
  jpeg: { kind: "image", type: "image/jpeg" },
  gif: { kind: "image", type: "image/gif" },
  webp: { kind: "image", type: "image/webp" },
  avif: { kind: "image", type: "image/avif" },
  // Shown in an <img>, where an SVG's scripts never run.
  svg: { kind: "image", type: "image/svg+xml" },
  pdf: { kind: "pdf", type: "application/pdf" },
  mp4: { kind: "video", type: "video/mp4" },
  webm: { kind: "video", type: "video/webm" },
  mov: { kind: "video", type: "video/quicktime" },
  mp3: { kind: "audio", type: "audio/mpeg" },
  m4a: { kind: "audio", type: "audio/mp4" },
  wav: { kind: "audio", type: "audio/wav" },
  ogg: { kind: "audio", type: "audio/ogg" },
  txt: { kind: "text", type: "text/plain; charset=utf-8" },
  md: { kind: "text", type: "text/plain; charset=utf-8" },
  csv: { kind: "text", type: "text/plain; charset=utf-8" },
  json: { kind: "text", type: "text/plain; charset=utf-8" },
  css: { kind: "text", type: "text/plain; charset=utf-8" },
};
/** Text shown on screen up to this size; a larger one is downloaded. */
export const TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

export function previewOf(fileName: string | null | undefined, size?: number | null) {
  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  const preview = PREVIEWS[ext];
  if (!preview) return null;
  if (preview.kind === "text" && (size ?? 0) > TEXT_PREVIEW_BYTES) return null;
  return preview;
}
