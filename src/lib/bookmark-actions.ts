"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  auditEvents,
  bookmarkFolderShares,
  bookmarkFolders,
  bookmarks,
} from "@/db/schema";
import { db } from "./db";
import { getActor, canAccess, type Actor } from "./access";
import { bookmarkInput, safeFileName } from "./bookmark-validation";
import { personInScope, scopeOf, searchBookmarkPeople } from "./bookmarks";
import type { ActionState } from "./action-state";
import { BOOKMARK_FILE, limitLabel } from "./attachment-rules";

const id = z.string().uuid();
const companyField = z.union([id, z.literal("")]).default("");
const visibility = z.enum(["company", "people"]).default("company");
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
const MAX_FILE = BOOKMARK_FILE.maxBytes;

/** Anuntech's own space (null) is staff-only; a company needs access to it. */
function companyAllowed(actor: Actor, companyId: string | null) {
  return companyId ? canAccess(actor, companyId, "overview") : actor.admin;
}

async function loadFolder(folderId: string) {
  const [folder] = await db
    .select({
      id: bookmarkFolders.id,
      companyId: bookmarkFolders.companyId,
      ownerId: bookmarkFolders.ownerId,
      name: bookmarkFolders.name,
      visibility: bookmarkFolders.visibility,
    })
    .from(bookmarkFolders)
    .where(eq(bookmarkFolders.id, folderId));
  return folder ?? null;
}
type Folder = NonNullable<Awaited<ReturnType<typeof loadFolder>>>;

/** Staff or the owner: rename, share, delete. */
const manages = (actor: Actor, folder: Folder) => actor.admin || folder.ownerId === actor.user.id;

/** Whoever can see the folder can add to it. */
async function usable(actor: Actor, folder: Folder) {
  if (!companyAllowed(actor, folder.companyId)) return false;
  if (actor.admin || folder.visibility === "company" || folder.ownerId === actor.user.id) return true;
  const [share] = await db
    .select({ userId: bookmarkFolderShares.userId })
    .from(bookmarkFolderShares)
    .where(
      and(eq(bookmarkFolderShares.folderId, folder.id), eq(bookmarkFolderShares.userId, actor.user.id)),
    );
  return !!share;
}

/** Staff, the person who saved it, or the owner of its folder. */
async function editableBookmark(actor: Actor, bookmarkId: string) {
  const [item] = await db
    .select({
      id: bookmarks.id,
      ownerId: bookmarks.ownerId,
      companyId: bookmarks.companyId,
      folderId: bookmarks.folderId,
      folderOwner: bookmarkFolders.ownerId,
      title: bookmarks.title,
      fileName: bookmarks.fileName,
    })
    .from(bookmarks)
    .leftJoin(bookmarkFolders, eq(bookmarkFolders.id, bookmarks.folderId))
    .where(eq(bookmarks.id, bookmarkId));
  if (!item) return null;
  if (actor.admin || item.ownerId === actor.user.id || item.folderOwner === actor.user.id)
    return item;
  return null;
}

async function audit(actor: Actor, action: string, entityId: string, companyId: string | null, details?: unknown) {
  await db.insert(auditEvents).values({
    actorId: actor.user.id,
    companyId,
    action,
    entityId,
    details: details ?? null,
  });
}

export async function createFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = z
      .object({ name: folderName, companyId: companyField, visibility })
      .parse(Object.fromEntries(form));
    const companyId = input.companyId || null;
    if (!companyAllowed(actor, companyId)) return blocked;
    const [folder] = await db
      .insert(bookmarkFolders)
      .values({ ownerId: actor.user.id, companyId, name: input.name, visibility: input.visibility })
      .returning({ id: bookmarkFolders.id });
    await audit(actor, "bookmark_folder.created", folder.id, companyId, { name: input.name });
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
    const folder = await loadFolder(folderId);
    if (!folder || !manages(actor, folder)) return blocked;
    await db.update(bookmarkFolders).set({ name }).where(eq(bookmarkFolders.id, folder.id));
    await audit(actor, "bookmark_folder.updated", folder.id, folder.companyId, { name });
    refresh();
    return { success: "Pasta renomeada." };
  } catch (error) {
    return failure(error);
  }
}

/** The folder goes away; what was inside stays with the company, loose. */
export async function deleteFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const folderId = id.parse(form.get("id"));
    const folder = await loadFolder(folderId);
    if (!folder || !manages(actor, folder)) return blocked;
    await db.transaction(async (tx) => {
      await tx.update(bookmarks).set({ folderId: null }).where(eq(bookmarks.folderId, folder.id));
      await tx.delete(bookmarkFolderShares).where(eq(bookmarkFolderShares.folderId, folder.id));
      await tx.delete(bookmarkFolders).where(eq(bookmarkFolders.id, folder.id));
    });
    await audit(actor, "bookmark_folder.deleted", folder.id, folder.companyId, { name: folder.name });
    refresh();
    return { success: "Pasta excluída.", href: "/bookmarks" };
  } catch (error) {
    return failure(error);
  }
}

/** Who sees the folder: the whole company, or only chosen people. */
export async function shareFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const folderId = id.parse(form.get("id"));
    const mode = visibility.parse(form.get("visibility") ?? "company");
    const userIds =
      mode === "people"
        ? [
            ...new Set(
              form
                .getAll("userIds")
                .map((value) => String(value).trim())
                .filter((value) => value && value.length <= 128 && value !== actor.user.id),
            ),
          ]
        : [];
    if (userIds.length > 50) return { error: "Compartilhe com até 50 pessoas." };
    const folder = await loadFolder(folderId);
    if (!folder || !manages(actor, folder)) return blocked;
    for (const userId of userIds)
      if (!(await personInScope(userId, folder.companyId)))
        return { error: "Uma das pessoas escolhidas não participa desta empresa." };
    await db.transaction(async (tx) => {
      await tx
        .update(bookmarkFolders)
        .set({ visibility: mode })
        .where(eq(bookmarkFolders.id, folder.id));
      await tx.delete(bookmarkFolderShares).where(eq(bookmarkFolderShares.folderId, folder.id));
      if (userIds.length)
        await tx
          .insert(bookmarkFolderShares)
          .values(userIds.map((userId) => ({ folderId: folder.id, userId })));
    });
    await audit(actor, "bookmark_folder.shared", folder.id, folder.companyId, {
      visibility: mode,
      people: userIds.length,
    });
    refresh();
    return {
      success:
        mode === "company" ? "Pasta aberta para toda a empresa." : "Compartilhamento atualizado.",
    };
  } catch (error) {
    return failure(error);
  }
}

/** Live search for the share dialog; only people the folder's company can include. */
export async function searchPeople(folderId: string, query: string) {
  const actor = await getActor();
  const folder = id.safeParse(folderId).success ? await loadFolder(folderId) : null;
  if (!folder || !manages(actor, folder) || query.trim().length < 1) return [];
  return searchBookmarkPeople(scopeOf(actor), folder.companyId, query);
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
  if (uploaded && uploaded.size > MAX_FILE)
    return { error: `Escolha um arquivo de até ${limitLabel(MAX_FILE)}.` };
  try {
    let companyId: string | null = input.companyId || null;
    if (input.folderId) {
      const folder = await loadFolder(input.folderId);
      if (!folder || !(await usable(actor, folder))) return blocked;
      companyId = folder.companyId;
    } else if (!companyAllowed(actor, companyId)) return blocked;
    const content = uploaded ? Buffer.from(await uploaded.arrayBuffer()) : null;
    const [item] = await db
      .insert(bookmarks)
      .values({
        ownerId: actor.user.id,
        companyId,
        folderId: input.folderId || null,
        title: input.title,
        url: input.url || null,
        fileName: uploaded ? safeFileName(uploaded.name) : null,
        content,
      })
      .returning({ id: bookmarks.id });
    await audit(actor, "bookmark.created", item.id, companyId, { title: input.title });
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
    const item = await editableBookmark(actor, bookmarkId);
    if (!item) return blocked;
    if (!item.fileName && !input.url) return { error: "Informe um link." };
    let companyId = item.companyId;
    if (input.folderId && input.folderId !== item.folderId) {
      const folder = await loadFolder(input.folderId);
      if (!folder || !(await usable(actor, folder))) return blocked;
      companyId = folder.companyId;
    }
    await db
      .update(bookmarks)
      .set({
        title: input.title,
        url: item.fileName ? null : input.url,
        folderId: input.folderId || null,
        companyId,
        updatedAt: new Date(),
      })
      .where(eq(bookmarks.id, bookmarkId));
    await audit(actor, "bookmark.updated", bookmarkId, companyId, { title: input.title });
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
    const item = await editableBookmark(actor, bookmarkId);
    if (!item) return blocked;
    let companyId = item.companyId;
    if (folderId) {
      const folder = await loadFolder(folderId);
      if (!folder || !(await usable(actor, folder))) return blocked;
      companyId = folder.companyId;
    }
    await db
      .update(bookmarks)
      .set({ folderId: folderId || null, companyId, updatedAt: new Date() })
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
    const item = await editableBookmark(actor, bookmarkId);
    if (!item) return blocked;
    await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId));
    await audit(actor, "bookmark.deleted", bookmarkId, item.companyId, { title: item.title });
    refresh();
    return { success: "Bookmark excluído." };
  } catch (error) {
    return failure(error);
  }
}
