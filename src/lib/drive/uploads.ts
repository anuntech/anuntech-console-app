import "server-only";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { bookmarks, companies, fileUploads } from "@/db/schema";
import { db } from "../db";
import type { Actor } from "../access/access";
import { companyAllowed, loadFolder, usable } from "../bookmarks/bookmark-core";
import {
  DEFAULT_COMPANY_QUOTA_BYTES,
  MAX_FILE_BYTES,
  PART_URL_BATCH,
  UPLOAD_TTL_HOURS,
  bytesLabel,
  cleanFileName,
  partCountFor,
  partSizeFor,
  storageKeyFor,
  uploadRefusal,
} from "./drive-rules";
import { abortMultipart, completeMultipart, deleteObject, objectSize, partUrl, startMultipart, StorageError } from "./r2";

/*
 * A file's way into Arquivos: started here (access, size, quota), sent by
 * the browser to R2 in parts, finished here (every part, the real size),
 * then taken by the bookmark that names it. Who started an upload is the only
 * one who can continue it.
 */

export type UploadResult<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
const fail = (error: string, status = 400): UploadResult<never> => ({ ok: false, error, status });
const notFound = () => fail("Não encontrado.", 404);

type Executor = Pick<typeof db, "select">;
const spaceIs = (column: typeof bookmarks.companyId | typeof fileUploads.companyId, companyId: string | null) =>
  companyId ? eq(column, companyId) : isNull(column);

/** Bytes a space holds: its files (in R2 and the older ones in the database) and the uploads under way. */
export async function spaceUsage(companyId: string | null, executor: Executor = db) {
  const [files] = await executor
    .select({ n: sql<string>`coalesce(sum(coalesce(${bookmarks.fileSize}, octet_length(${bookmarks.content}), 0)), 0)` })
    .from(bookmarks)
    .where(spaceIs(bookmarks.companyId, companyId));
  const [pending] = await executor
    .select({ n: sql<string>`coalesce(sum(${fileUploads.size}), 0)` })
    .from(fileUploads)
    .where(and(spaceIs(fileUploads.companyId, companyId), inArray(fileUploads.status, ["uploading", "completed"]), gt(fileUploads.expiresAt, new Date())));
  return Number(files.n) + Number(pending.n);
}

/** A company's space; Anuntech's own (null) has no limit. */
export async function spaceQuota(companyId: string | null, executor: Executor = db) {
  if (!companyId) return null;
  const [row] = await executor.select({ quota: companies.storageQuotaBytes }).from(companies).where(eq(companies.id, companyId));
  return row?.quota ?? DEFAULT_COMPANY_QUOTA_BYTES;
}

/** Used and total for each company the viewer sees (and Anuntech's space for the team). */
export async function spacesFor(companyIds: (string | null)[]) {
  return Promise.all(companyIds.map(async (companyId) => ({ companyId, used: await spaceUsage(companyId), quota: await spaceQuota(companyId) })));
}

const startInput = z.object({
  companyId: z.union([z.string().uuid(), z.literal("")]).default(""),
  folderId: z.union([z.string().uuid(), z.literal("")]).default(""),
  fileName: z.string().trim().min(1, "Selecione um arquivo.").max(1000),
  size: z.number().int().positive("Selecione um arquivo com conteúdo.").max(MAX_FILE_BYTES, `Escolha um arquivo de até ${bytesLabel(MAX_FILE_BYTES)}.`),
  mime: z.string().max(200).default(""),
});

/** Where a file would go: the folder's space, or the company chosen. Null when the person cannot add there. */
async function spaceFor(actor: Actor, companyId: string, folderId: string) {
  if (folderId) {
    const folder = await loadFolder(folderId);
    if (!folder || !(await usable(actor, folder))) return undefined;
    return folder.companyId;
  }
  const space = companyId || null;
  return companyAllowed(actor, space) ? space : undefined;
}

export async function startUpload(actor: Actor, raw: unknown): Promise<UploadResult<{ id: string; partSize: number; partCount: number }>> {
  const parsed = startInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const input = parsed.data;
  const space = await spaceFor(actor, input.companyId, input.folderId);
  if (space === undefined) return notFound();
  const id = crypto.randomUUID();
  const key = storageKeyFor(space, id);
  const partSize = partSizeFor(input.size);
  const mime = input.mime || "application/octet-stream";
  // A quick look first, so a full space is refused before R2 is asked for anything.
  const early = uploadRefusal({ size: input.size, used: await spaceUsage(space), quota: await spaceQuota(space) });
  if (early) return fail(early, 413);
  let multipartId: string;
  try {
    multipartId = await startMultipart(key, mime);
  } catch (error) {
    console.error("[arquivos] start failed", error instanceof Error ? error.message : error);
    return fail("Não foi possível começar o envio agora. Tente de novo em alguns minutos.", 502);
  }
  // The quota is checked again under a lock on the space, so two uploads at once cannot both take the last gigabytes.
  const refusal = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`arquivos:${space ?? "anuntech"}`}))`);
    const refused = uploadRefusal({ size: input.size, used: await spaceUsage(space, tx), quota: await spaceQuota(space, tx) });
    if (refused) return refused;
    await tx.insert(fileUploads).values({
      id,
      actorId: actor.user.id,
      companyId: space,
      folderId: input.folderId || null,
      fileName: cleanFileName(input.fileName),
      mime,
      size: input.size,
      partSize,
      storageKey: key,
      multipartId,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_HOURS * 3600_000),
    });
    return null;
  });
  if (refusal) {
    await abortMultipart(key, multipartId).catch(() => undefined);
    return fail(refusal, 413);
  }
  return { ok: true, value: { id, partSize, partCount: partCountFor(input.size, partSize) } };
}

async function ownUpload(actor: Actor, uploadId: string) {
  if (!z.string().uuid().safeParse(uploadId).success) return null;
  const [row] = await db.select().from(fileUploads).where(and(eq(fileUploads.id, uploadId), eq(fileUploads.actorId, actor.user.id)));
  return row ?? null;
}

export async function signParts(actor: Actor, uploadId: string, raw: unknown): Promise<UploadResult<{ partNumber: number; url: string }[]>> {
  const row = await ownUpload(actor, uploadId);
  if (!row || row.status !== "uploading" || row.expiresAt <= new Date()) return notFound();
  const count = partCountFor(row.size, row.partSize);
  const parsed = z.array(z.number().int().min(1).max(count)).min(1).max(PART_URL_BATCH).safeParse(raw);
  if (!parsed.success) return fail("Partes inválidas.");
  const urls = await Promise.all(parsed.data.map(async (partNumber) => ({ partNumber, url: await partUrl(row.storageKey, row.multipartId, partNumber) })));
  return { ok: true, value: urls };
}

export async function finishUpload(actor: Actor, uploadId: string, raw: unknown): Promise<UploadResult<{ id: string }>> {
  const row = await ownUpload(actor, uploadId);
  if (!row || row.expiresAt <= new Date()) return notFound();
  if (row.status === "completed") return { ok: true, value: { id: row.id } };
  if (row.status !== "uploading") return notFound();
  const count = partCountFor(row.size, row.partSize);
  const parsed = z
    .array(z.object({ partNumber: z.number().int().min(1).max(count), etag: z.string().min(1).max(200) }))
    .length(count, "O envio não terminou: faltam partes.")
    .safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const parts = [...parsed.data].sort((a, b) => a.partNumber - b.partNumber);
  if (parts.some((part, index) => part.partNumber !== index + 1)) return fail("O envio não terminou: faltam partes.");
  try {
    await completeMultipart(row.storageKey, row.multipartId, parts);
    // The browser said how big the file was; R2 says how big it is.
    const stored = await objectSize(row.storageKey);
    if (stored !== row.size) {
      await deleteObject(row.storageKey).catch(() => undefined);
      await db.update(fileUploads).set({ status: "aborted" }).where(eq(fileUploads.id, row.id));
      return fail("O arquivo chegou com um tamanho diferente do informado. Envie de novo.");
    }
  } catch (error) {
    console.error("[arquivos] finish failed", error instanceof StorageError ? error.message : error);
    return fail("Não foi possível concluir o envio agora. Tente de novo.", 502);
  }
  await db.update(fileUploads).set({ status: "completed" }).where(and(eq(fileUploads.id, row.id), eq(fileUploads.status, "uploading")));
  return { ok: true, value: { id: row.id } };
}

export async function cancelUpload(actor: Actor, uploadId: string): Promise<UploadResult<null>> {
  const row = await ownUpload(actor, uploadId);
  if (!row) return notFound();
  if (row.status === "used") return fail("Este arquivo já foi salvo.");
  if (row.status === "uploading") await abortMultipart(row.storageKey, row.multipartId).catch(() => undefined);
  if (row.status === "completed") await deleteObject(row.storageKey).catch(() => undefined);
  await db.update(fileUploads).set({ status: "aborted" }).where(eq(fileUploads.id, row.id));
  return { ok: true, value: null };
}
