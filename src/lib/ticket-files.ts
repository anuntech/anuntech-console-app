import sharp from "sharp";
import { and, eq, gt, inArray } from "drizzle-orm";
import { ticketUploads } from "@/db/schema";
import type { db } from "./db";
import { safeFileName } from "./bookmark-validation";
export const MAX_TICKET_BYTES = 20 * 1024 * 1024;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function normalizeTicketFile(content: Buffer, name: string) {
  if (!content.length || content.length > MAX_TICKET_BYTES)
    throw new Error("Escolha um arquivo de até 20 MB.");
  if (content.subarray(0, 5).toString() === "%PDF-")
    return {
      content,
      name: safeFileName(name),
      size: content.length,
      mime: "application/pdf",
    };
  try {
    const image = sharp(content, {
      limitInputPixels: 50_000_000,
      animated: false,
    });
    const meta = await image.metadata();
    if (
      !["png", "jpeg", "webp"].includes(meta.format || "") ||
      (meta.pages || 1) > 1
    )
      throw new Error();
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
    files.length > 5 ||
    files.reduce((total, file) => total + file.size, 0) > MAX_TICKET_BYTES
  )
    throw new Error("Selecione até 5 anexos, com no máximo 20 MB no total.");
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
  if (ids.length > 5 || new Set(ids).size !== ids.length)
    throw new Error("Anexos inválidos.");
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
    throw new Error("Os anexos devem ter até 20 MB no total.");
  return rows.map((row) => ({
    content: row.content,
    name: row.name,
    mime: row.mime!,
    size: row.content.length,
  }));
}
