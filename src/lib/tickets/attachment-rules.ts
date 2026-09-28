import { fileSizeLabel } from "../format";

/**
 * What a file field accepts. The same object drives the picker, the upload
 * hook and the server checks, so the limits people read are the ones enforced.
 * Entries in `accept` are MIME types or extensions (".md").
 */
export type AttachmentRules = {
  /** Omit to accept any kind of file. */
  accept?: string[];
  /** How the accepted kinds read to people, e.g. "PDF, PNG, JPEG ou WebP". */
  acceptLabel?: string;
  /** Files at once; 1 turns the field into a single-file picker that replaces on a new pick. */
  max: number;
  /** Total bytes across the files. */
  maxBytes: number;
};

/** Tickets and tasks: documents and pictures, up to 5 files and 20 MB. */
export const DOCUMENT_ATTACHMENTS: AttachmentRules = {
  accept: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  acceptLabel: "PDF, PNG, JPEG ou WebP",
  max: 5,
  maxBytes: 20 * 1024 * 1024,
};

/** A bookmark's file: anything small enough to keep in the database. */
export const BOOKMARK_FILE: AttachmentRules = {
  acceptLabel: "Qualquer tipo",
  max: 1,
  maxBytes: 1024 * 1024,
};

/** A knowledge-base document for the assistant: plain text it can read. */
export const KNOWLEDGE_DOCUMENT: AttachmentRules = {
  accept: [".md", ".markdown", ".txt", ".csv", "text/plain", "text/markdown", "text/csv"],
  acceptLabel: ".md, .txt ou .csv",
  max: 1,
  maxBytes: 300 * 1024,
};

/** A profile photo, before it is cropped and optimized to 512 px. */
export const AVATAR_IMAGE: AttachmentRules = {
  accept: ["image/png", "image/jpeg", "image/webp"],
  acceptLabel: "PNG, JPEG ou WebP",
  max: 1,
  maxBytes: 20 * 1024 * 1024,
};

/** Limits read as round numbers: "20 MB", not "20,0 MB". */
export const limitLabel = (bytes: number) => fileSizeLabel(bytes).replace(",0 MB", " MB");

/** The hint under a field, from its rules: "PDF, PNG, JPEG ou WebP · até 5 arquivos, 20 MB no total". */
export function attachmentHint({ acceptLabel, max, maxBytes }: AttachmentRules) {
  const size = limitLabel(maxBytes);
  const kinds = acceptLabel ? `${acceptLabel} · ` : "";
  return max > 1 ? `${kinds}até ${max} arquivos, ${size} no total` : `${kinds}até ${size}`;
}

/** What to say when a pick goes over the count or the size. */
export function attachmentLimitError({ max, maxBytes }: AttachmentRules) {
  return max > 1
    ? `Até ${max} arquivos, com ${limitLabel(maxBytes)} no total.`
    : `Escolha um arquivo de até ${limitLabel(maxBytes)}.`;
}
