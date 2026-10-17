import sharp from "sharp";
import { and, eq, gt, inArray } from "drizzle-orm";
import { ticketUploads } from "@/db/schema";
import type { db } from "../db";
import { safeFileName } from "../bookmarks/bookmark-validation";
import { imageFormatOf } from "../images/image-format";
import { DOCUMENT_ATTACHMENTS, limitLabel } from "./attachment-rules";
export const MAX_TICKET_BYTES = DOCUMENT_ATTACHMENTS.maxBytes;
const MAX_TICKET_FILES = DOCUMENT_ATTACHMENTS.max;
const limit = limitLabel(MAX_TICKET_BYTES);
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function normalizeTicketFile(content: Buffer, name: string) {
  if (!content.length || content.length > MAX_TICKET_BYTES)
    throw new Error(`Escolha um arquivo de até ${limit}.`);
  if (content.subarray(0, 5).toString() === "%PDF-")
    return {
      content,
      name: safeFileName(name),
      size: content.length,
      mime: "application/pdf",
    };
  try {
    // By the first bytes, before sharp: other formats never reach its decoders.
    const format = imageFormatOf(content);
    if (!format) throw new Error();
    const image = sharp(content, {
      limitInputPixels: 50_000_000,
      animated: false,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (meta.format !== format || (meta.pages || 1) > 1) throw new Error();
    const optimized = await image
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .timeout({ seconds: 15 })
      .toBuffer();
    return {
      content: optimized,
      name: safeFileName(name.replace(/\.[^.]+$/, "") + ".webp"),
      size: optimized.length,
      mime: "image/webp",
    };
  } catch {
    throw new Error("Envie um PDF ou uma imagem PNG, JPEG ou WebP válida.");
  }
}
export async function prepareTicketFiles(values: FormDataEntryValue[]) {
  const files = values.filter(
    (value): value is File => value instanceof File && value.size > 0,
  );
  if (
    files.length > MAX_TICKET_FILES ||
    files.reduce((total, file) => total + file.size, 0) > MAX_TICKET_BYTES
  )
    throw new Error(`Selecione até ${MAX_TICKET_FILES} anexos, com no máximo ${limit} no total.`);
  const result = [];
  for (const file of files)
    result.push(
      await normalizeTicketFile(
        Buffer.from(await file.arrayBuffer()),
        file.name,
      ),
    );
  return result;
}
export async function takeTicketUploads(
  tx: Tx,
  authorId: string,
  form: FormData,
) {
  const ids = form.getAll("uploadId").map(String);
  if (!ids.length) return [];
  if (ids.length > MAX_TICKET_FILES || new Set(ids).size !== ids.length)
    throw new Error("Não foi possível ler os anexos. Selecione os arquivos de novo.");
  const rows = await tx
    .delete(ticketUploads)
    .where(
      and(
        inArray(ticketUploads.id, ids),
        eq(ticketUploads.authorId, authorId),
        eq(ticketUploads.ready, true),
        gt(ticketUploads.expiresAt, new Date()),
      ),
    )
    .returning();
  if (rows.length !== ids.length)
    throw new Error("Os anexos expiraram. Selecione os arquivos novamente.");
  if (rows.reduce((sum, row) => sum + row.expectedSize, 0) > MAX_TICKET_BYTES)
    throw new Error(`Os anexos devem ter até ${limit} no total.`);
  return rows.map((row) => ({
    content: row.content,
    name: row.name,
    mime: row.mime!,
    size: row.content.length,
  }));
}
