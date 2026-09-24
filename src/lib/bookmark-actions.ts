"use server";
import { and, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  auditEvents,
  bookmarkFolderShares,
  bookmarkFolders,
  bookmarks,
  user,
} from "@/db/schema";
import { db } from "./db";
import { getActor } from "./access";
import { bookmarkInput, safeFileName } from "./bookmark-validation";
import type { ActionState } from "./action-state";

const id = z.string().uuid();
const folderName = z
  .string()
  .trim()
  .min(1, "Dê um nome à pasta.")
  .max(80, "O nome da pasta excede o tamanho permitido.");
const blocked = { error: "Você não tem permissão para realizar esta ação." };
const failure = (error: unknown): ActionState => ({
  error:
    error instanceof z.ZodError
      ? error.issues[0].message
      : "Não foi possível salvar. Tente novamente.",
});
const refresh = () => revalidatePath("/bookmarks");
const MAX_FILE = 1024 * 1024;

/** Owner or someone the folder was shared with. */
async function folderAccess(folderId: string, userId: string) {
  const [folder] = await db
    .select({ id: bookmarkFolders.id, ownerId: bookmarkFolders.ownerId })
    .from(bookmarkFolders)
    .leftJoin(
      bookmarkFolderShares,
      and(eq(bookmarkFolderShares.folderId, bookmarkFolders.id), eq(bookmarkFolderShares.userId, userId)),
    )
    .where(
      and(
        eq(bookmarkFolders.id, folderId),
        or(eq(bookmarkFolders.ownerId, userId), eq(bookmarkFolderShares.userId, userId)),
      ),
    );
  return folder ?? null;
}

/** The bookmark's owner, or the owner of the folder it sits in. */
async function bookmarkAccess(bookmarkId: string, userId: string) {
  const [item] = await db
    .select({
      id: bookmarks.id,
      ownerId: bookmarks.ownerId,
      folderId: bookmarks.folderId,
      folderOwner: bookmarkFolders.ownerId,
      title: bookmarks.title,
    })
    .from(bookmarks)
    .leftJoin(bookmarkFolders, eq(bookmarkFolders.id, bookmarks.folderId))
    .where(eq(bookmarks.id, bookmarkId));
  if (!item || (item.ownerId !== userId && item.folderOwner !== userId)) return null;
  return item;
}

async function audit(actorId: string, action: string, entityId: string, details?: unknown) {
  await db.insert(auditEvents).values({ actorId, action, entityId, details: details ?? null });
}

export async function createFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const name = folderName.parse(form.get("name"));
    const [folder] = await db
      .insert(bookmarkFolders)
      .values({ ownerId: actor.user.id, name })
      .returning({ id: bookmarkFolders.id });
    await audit(actor.user.id, "bookmark_folder.created", folder.id, { name });
    refresh();
    return { success: "Pasta criada.", href: `/bookmarks?pasta=${folder.id}` };
  } catch (error) {
    return failure(error);
  }
}

export async function renameFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const folderId = id.parse(form.get("id"));
    const name = folderName.parse(form.get("name"));
    const [folder] = await db
      .update(bookmarkFolders)
      .set({ name })
      .where(and(eq(bookmarkFolders.id, folderId), eq(bookmarkFolders.ownerId, actor.user.id)))
      .returning({ id: bookmarkFolders.id });
    if (!folder) return blocked;
    await audit(actor.user.id, "bookmark_folder.updated", folder.id, { name });
    refresh();
    return { success: "Pasta renomeada." };
  } catch (error) {
    return failure(error);
  }
}

/** The folder goes away; what was inside returns to each owner's "Sem pasta". */
export async function deleteFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const folderId = id.parse(form.get("id"));
    const done = await db.transaction(async (tx) => {
      const [folder] = await tx
        .select({ id: bookmarkFolders.id, name: bookmarkFolders.name })
        .from(bookmarkFolders)
        .where(and(eq(bookmarkFolders.id, folderId), eq(bookmarkFolders.ownerId, actor.user.id)))
        .for("update");
      if (!folder) return false;
      await tx.update(bookmarks).set({ folderId: null }).where(eq(bookmarks.folderId, folder.id));
      await tx.delete(bookmarkFolderShares).where(eq(bookmarkFolderShares.folderId, folder.id));
      await tx.delete(bookmarkFolders).where(eq(bookmarkFolders.id, folder.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        action: "bookmark_folder.deleted",
        entityId: folder.id,
        details: { name: folder.name },
      });
      return true;
    });
    if (!done) return blocked;
    refresh();
    return { success: "Pasta excluída.", href: "/bookmarks" };
  } catch (error) {
    return failure(error);
  }
}

/** Replaces who the folder is shared with. */
export async function shareFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const folderId = id.parse(form.get("id"));
    const userIds = [
      ...new Set(
        form
          .getAll("userIds")
          .map((value) => String(value).trim())
          .filter((value) => value && value.length <= 128 && value !== actor.user.id),
      ),
    ];
    if (userIds.length > 50) return { error: "Compartilhe com até 50 pessoas." };
    const done = await db.transaction(async (tx) => {
      const [folder] = await tx
        .select({ id: bookmarkFolders.id })
        .from(bookmarkFolders)
        .where(and(eq(bookmarkFolders.id, folderId), eq(bookmarkFolders.ownerId, actor.user.id)))
        .for("update");
      if (!folder) return false;
      if (userIds.length) {
        const known = await tx.select({ id: user.id }).from(user).where(inArray(user.id, userIds));
        if (known.length !== userIds.length) throw new Error("Pessoa desconhecida.");
      }
      await tx.delete(bookmarkFolderShares).where(eq(bookmarkFolderShares.folderId, folder.id));
      if (userIds.length)
        await tx
          .insert(bookmarkFolderShares)
          .values(userIds.map((userId) => ({ folderId: folder.id, userId })));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        action: "bookmark_folder.shared",
        entityId: folder.id,
        details: { people: userIds.length },
      });
      return true;
    });
    if (!done) return blocked;
    refresh();
    return { success: userIds.length ? "Compartilhamento atualizado." : "Pasta agora é só sua." };
  } catch (error) {
    return failure(error);
  }
}

export async function saveBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const parsed = bookmarkInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const file = form.get("file");
  const uploaded = file instanceof File && file.size > 0 ? file : null;
  if (!input.url && !uploaded) return { error: "Informe um link ou selecione um arquivo." };
  if (input.url && uploaded) return { error: "Salve um link ou um arquivo por vez." };
  if (uploaded && uploaded.size > MAX_FILE) return { error: "Escolha um arquivo de até 1 MB." };
  try {
    if (input.folderId && !(await folderAccess(input.folderId, actor.user.id))) return blocked;
    const content = uploaded ? Buffer.from(await uploaded.arrayBuffer()) : null;
    const [item] = await db
      .insert(bookmarks)
      .values({
        ownerId: actor.user.id,
        folderId: input.folderId || null,
        title: input.title,
        url: input.url || null,
        fileName: uploaded ? safeFileName(uploaded.name) : null,
        content,
      })
      .returning({ id: bookmarks.id });
    await audit(actor.user.id, "bookmark.created", item.id, { title: input.title });
    refresh();
    return { success: "Bookmark salvo." };
  } catch {
    return { error: "Não foi possível salvar o bookmark. Tente novamente." };
  }
}

/** Title, link and folder. A file bookmark keeps its file. */
export async function updateBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const bookmarkId = id.parse(form.get("id"));
    const parsed = bookmarkInput.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const input = parsed.data;
    const item = await bookmarkAccess(bookmarkId, actor.user.id);
    if (!item) return blocked;
    if (input.folderId && input.folderId !== item.folderId && !(await folderAccess(input.folderId, actor.user.id)))
      return blocked;
    const [current] = await db
      .select({ fileName: bookmarks.fileName })
      .from(bookmarks)
      .where(eq(bookmarks.id, bookmarkId));
    if (!current.fileName && !input.url) return { error: "Informe um link." };
    await db
      .update(bookmarks)
      .set({
        title: input.title,
        url: current.fileName ? null : input.url,
        folderId: input.folderId || null,
        updatedAt: new Date(),
      })
      .where(eq(bookmarks.id, bookmarkId));
    await audit(actor.user.id, "bookmark.updated", bookmarkId, { title: input.title });
    refresh();
    return { success: "Bookmark atualizado." };
  } catch (error) {
    return failure(error);
  }
}

/** Only the folder changes; used by "Mover para". */
export async function moveBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const bookmarkId = id.parse(form.get("id"));
    const folderId = z.union([id, z.literal("")]).parse(form.get("folderId") ?? "");
    const item = await bookmarkAccess(bookmarkId, actor.user.id);
    if (!item) return blocked;
    if (folderId && !(await folderAccess(folderId, actor.user.id))) return blocked;
    await db
      .update(bookmarks)
      .set({ folderId: folderId || null, updatedAt: new Date() })
      .where(eq(bookmarks.id, bookmarkId));
    refresh();
    return { success: "Bookmark movido." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const bookmarkId = id.parse(form.get("id"));
    const item = await bookmarkAccess(bookmarkId, actor.user.id);
    if (!item) return blocked;
    await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId));
    await audit(actor.user.id, "bookmark.deleted", bookmarkId, { title: item.title });
    refresh();
    return { success: "Bookmark removido." };
  } catch (error) {
    return failure(error);
  }
}
