import "server-only";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, bookmarks } from "@/db/schema";
import { db } from "../db";
import type { Actor } from "../access/access";
import type { ActionState } from "../action-state";
import { bookmarkFor } from "./bookmarks";
import { GATED, companyAllowed, gateKeeps, loadFolder, usable } from "./bookmark-core";
import { bytesLabel, storageKeyFor, uploadRefusal } from "../drive/drive-rules";
import { COPY_MAX_BYTES, copyObject, deleteObject, storageConfigured } from "../drive/r2";
import { spaceQuota, spaceUsage } from "../drive/uploads";

/*
 * "Copiar para…" (Arquivos): an item the person sees, again in a folder they
 * can add to ("" is Sem pasta, in the item's own company). A file is copied
 * inside R2 and counts in the space where it lands (checked under the
 * space's lock, like an upload); a link and a whiteboard are copied as they
 * are. What is behind a gate stays behind the same gate, as with "Mover".
 */

const input = z.object({ id: z.string().uuid(), folderId: z.union([z.string().uuid(), z.literal("")]).default("") });

export async function copyBookmarkAs(actor: Actor, raw: unknown): Promise<ActionState> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: "Item não encontrado." };
  const item = await bookmarkFor(actor, parsed.data.id);
  if (!item) return { error: "Item não encontrado." };
  const folder = parsed.data.folderId ? await loadFolder(parsed.data.folderId) : null;
  if (parsed.data.folderId && (!folder || !(await usable(actor, folder)))) return { error: "Você não pode adicionar itens nessa pasta." };
  const companyId = folder ? folder.companyId : item.companyId;
  if (!folder && !companyAllowed(actor, companyId)) return { error: "Você não pode adicionar itens aí." };
  if (!(await gateKeeps(item.folderId, folder))) return GATED;
  const [source] = await db
    .select({
      url: bookmarks.url,
      fileName: bookmarks.fileName,
      storageKey: bookmarks.storageKey,
      content: bookmarks.content,
      fileSize: bookmarks.fileSize,
      mime: bookmarks.mime,
      board: bookmarks.board,
      preview: bookmarks.preview,
      tag: bookmarks.tag,
    })
    .from(bookmarks)
    .where(eq(bookmarks.id, item.id));
  if (!source) return { error: "Item não encontrado." };
  const id = crypto.randomUUID();
  const sameFolder = (folder?.id ?? null) === item.folderId;
  const title = (sameFolder ? `${item.title} (cópia)` : item.title).slice(0, 160);
  let storageKey: string | null = null;
  if (source.storageKey) {
    if (!storageConfigured()) return { error: "O armazenamento de arquivos não está disponível agora." };
    const size = source.fileSize ?? 0;
    if (size > COPY_MAX_BYTES) return { error: `Arquivos acima de ${bytesLabel(COPY_MAX_BYTES)} não são copiados aqui. Baixe e envie de novo.` };
    storageKey = storageKeyFor(companyId, id);
    await copyObject(source.storageKey, storageKey);
  }
  // The space is checked under its lock (the same one as the uploads), with the copy already in R2.
  const refused = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`arquivos:${companyId ?? "anuntech"}`}))`);
    const size = source.fileSize ?? source.content?.length ?? 0;
    if (size) {
      const refusal = uploadRefusal({ size, used: await spaceUsage(companyId, tx), quota: await spaceQuota(companyId, tx) });
      if (refusal) return refusal;
    }
    await tx.insert(bookmarks).values({
      id,
      companyId,
      folderId: folder?.id ?? null,
      ownerId: actor.user.id,
      title,
      url: source.url,
      fileName: source.fileName,
      content: storageKey ? null : source.content,
      storageKey,
      fileSize: source.fileSize,
      mime: source.mime,
      board: source.board,
      preview: source.preview,
      tag: source.tag,
      tagSource: source.tag ? "auto" : null,
    });
    await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId, action: "bookmark.created", entityId: id, details: { title, copiedFrom: item.id } });
    return null;
  });
  if (refused) {
    if (storageKey) await deleteObject(storageKey).catch(() => undefined);
    return { error: refused };
  }
  revalidatePath("/bookmarks");
  return { success: folder ? `Cópia criada em “${folder.name}”.` : "Cópia criada." };
}
