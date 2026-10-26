import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  auditEvents,
  bookmarkFolderShares,
  bookmarkFolders,
  bookmarks,
  fileUploads,
} from "@/db/schema";
import { db } from "../db";
import { canAccess, type Actor } from "../access/access";
import { bookmarkInput, safeFileName } from "./bookmark-validation";
import { boardHref, bookmarkKinds, EMPTY_BOARD } from "./board-rules";
import { personInScope, scopeOf, searchBookmarkPeople } from "./bookmarks";
import type { ActionState } from "../action-state";
import { BOOKMARK_FILE, limitLabel } from "../tickets/attachment-rules";
import { claimUpload } from "../drive/upload-claim";
import { removeStoredFiles } from "../drive/r2";

/*
 * The bookmark rules behind the web's actions (bookmark-actions.ts, which read
 * the FormData) and the app's procedures (bookmarks.*) and file route
 * (/api/v1/bookmarks/arquivo). Inputs arrive as the form would post them, so
 * both answer with the same words.
 */

const id = z.string().uuid();
/** The sheet's "Tipo"; older forms (and the smoke suite) post none and mean a link. */
const kindField = z.enum(bookmarkKinds).catch("link");
const companyField = z.union([id, z.literal("")]).default("");
const visibility = z.enum(["company", "people"]).default("company");
const folderName = z
  .string()
  .trim()
  .min(1, "Dê um nome à pasta.")
  .max(80, "O nome da pasta excede o tamanho permitido.");
const blocked = { error: "Você não tem permissão para fazer isso." };
const failure = (error: unknown): ActionState => ({
  error:
    error instanceof z.ZodError
      ? error.issues[0].message
      : "Não foi possível salvar. Tente novamente.",
});
const refresh = () => revalidatePath("/bookmarks");
const MAX_FILE = BOOKMARK_FILE.maxBytes;

/** Anuntech's own space (null) is staff-only; a company needs access to it. */
export function companyAllowed(actor: Actor, companyId: string | null) {
  return companyId ? canAccess(actor, companyId, "overview") : actor.admin;
}

export async function loadFolder(folderId: string) {
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
export const manages = (actor: Actor, folder: Folder) => actor.admin || folder.ownerId === actor.user.id;

/** Whoever can see the folder can add to it. */
export async function usable(actor: Actor, folder: Folder) {
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
      board: sql<boolean>`(${bookmarks.board} is not null)`,
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

/** A new folder: `{ name, companyId, visibility }` ("" company is Anuntech's own space). `id` is for the app. */
export async function createFolderAs(
  actor: Actor,
  input: Record<string, unknown>,
): Promise<ActionState & { id?: string }> {
  try {
    const parsed = z.object({ name: folderName, companyId: companyField, visibility }).parse(input);
    const companyId = parsed.companyId || null;
    if (!companyAllowed(actor, companyId)) return blocked;
    const [folder] = await db
      .insert(bookmarkFolders)
      .values({ ownerId: actor.user.id, companyId, name: parsed.name, visibility: parsed.visibility })
      .returning({ id: bookmarkFolders.id });
    await audit(actor, "bookmark_folder.created", folder.id, companyId, { name: parsed.name });
    refresh();
    return { success: "Pasta criada.", href: `/bookmarks?pasta=${folder.id}`, id: folder.id };
  } catch (error) {
    return failure(error);
  }
}

export async function renameFolderAs(actor: Actor, input: { id: unknown; name: unknown }): Promise<ActionState> {
  try {
    const folderId = id.parse(input.id);
    const name = folderName.parse(input.name);
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
export async function deleteFolderAs(actor: Actor, input: { id: unknown }): Promise<ActionState> {
  try {
    const folderId = id.parse(input.id);
    const folder = await loadFolder(folderId);
    if (!folder || !manages(actor, folder)) return blocked;
    await db.transaction(async (tx) => {
      await tx.update(bookmarks).set({ folderId: null }).where(eq(bookmarks.folderId, folder.id));
      await tx.update(fileUploads).set({ folderId: null }).where(eq(fileUploads.folderId, folder.id));
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

/** Who sees the folder: the whole company, or only chosen people (`userIds`, up to 50). */
export async function shareFolderAs(
  actor: Actor,
  input: { id: unknown; visibility: unknown; userIds: unknown[] },
): Promise<ActionState> {
  try {
    const folderId = id.parse(input.id);
    const mode = visibility.parse(input.visibility ?? "company");
    const userIds =
      mode === "people"
        ? [
            ...new Set(
              input.userIds
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
export async function searchPeopleAs(actor: Actor, folderId: string, query: string) {
  const folder = id.safeParse(folderId).success ? await loadFolder(folderId) : null;
  if (!folder || !manages(actor, folder) || query.trim().length < 1) return [];
  return searchBookmarkPeople(scopeOf(actor), folder.companyId, query);
}

/** What saving answers; `id` is the new bookmark's, for the app. */
export type BookmarkSaved = ActionState & { id?: string };

/**
 * A new bookmark: a link, a small file (`file`) or a blank whiteboard
 * (`kind: "board"`), with `{ title, url, companyId, folderId, kind }` as the
 * sheet posts them. Inside a folder, the folder's company wins.
 */
export async function saveBookmarkAs(
  actor: Actor,
  input: Record<string, unknown>,
  file: unknown,
): Promise<BookmarkSaved> {
  const parsed = bookmarkInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const fields = parsed.data;
  const kind = kindField.parse(input.kind ?? "link");
  // A whiteboard starts empty: no link and no file, whatever else the form carried.
  const uploaded = kind !== "board" && file instanceof File && file.size > 0 ? file : null;
  // A large file went to R2 first (lib/drive/uploads.ts); the form then names the finished upload.
  const uploadId = kind === "file" && !uploaded && typeof input.uploadId === "string" ? input.uploadId : "";
  const url = kind === "board" ? "" : fields.url;
  if (kind !== "board" && !url && !uploaded && !uploadId) return { error: "Informe um link ou selecione um arquivo." };
  if (url && (uploaded || uploadId)) return { error: "Salve um link ou um arquivo por vez." };
  if (uploaded && uploaded.size > MAX_FILE)
    return { error: `Escolha um arquivo de até ${limitLabel(MAX_FILE)}.` };
  try {
    let companyId: string | null = fields.companyId || null;
    if (fields.folderId) {
      const folder = await loadFolder(fields.folderId);
      if (!folder || !(await usable(actor, folder))) return blocked;
      companyId = folder.companyId;
    } else if (!companyAllowed(actor, companyId)) return blocked;
    const content = uploaded ? Buffer.from(await uploaded.arrayBuffer()) : null;
    const item = await db.transaction(async (tx) => {
      // The upload must be this person's, finished and for this same space; it is taken once.
      const stored = uploadId ? await claimUpload(actor, uploadId, companyId, tx) : null;
      if (uploadId && !stored) return null;
      const [row] = await tx
        .insert(bookmarks)
        .values({
          ownerId: actor.user.id,
          companyId,
          folderId: fields.folderId || null,
          title: fields.title,
          url: url || null,
          fileName: stored ? stored.fileName : uploaded ? safeFileName(uploaded.name) : null,
          content,
          storageKey: stored?.storageKey ?? null,
          fileSize: stored?.size ?? uploaded?.size ?? null,
          mime: stored?.mime ?? (uploaded?.type || null),
          board: kind === "board" ? EMPTY_BOARD : null,
        })
        .returning({ id: bookmarks.id });
      return row;
    });
    if (!item) return { error: "O envio do arquivo não foi concluído. Envie de novo." };
    await audit(actor, "bookmark.created", item.id, companyId, { title: fields.title, kind });
    refresh();
    if (kind === "board") return { success: "Lousa criada.", href: boardHref(item.id), id: item.id };
    return { success: "Bookmark salvo.", id: item.id };
  } catch {
    return { error: "Não foi possível salvar o bookmark. Tente novamente." };
  }
}

/** Title, link and folder (`{ id, title, url, folderId }`). A file bookmark keeps its file. */
export async function updateBookmarkAs(actor: Actor, input: Record<string, unknown>): Promise<ActionState> {
  try {
    const bookmarkId = id.parse(input.id);
    const parsed = bookmarkInput.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const fields = parsed.data;
    const item = await editableBookmark(actor, bookmarkId);
    if (!item) return blocked;
    const keepsContent = !!item.fileName || item.board;
    if (!keepsContent && !fields.url) return { error: "Informe um link." };
    let companyId = item.companyId;
    if (fields.folderId && fields.folderId !== item.folderId) {
      const folder = await loadFolder(fields.folderId);
      if (!folder || !(await usable(actor, folder))) return blocked;
      companyId = folder.companyId;
    }
    await db
      .update(bookmarks)
      .set({
        title: fields.title,
        url: keepsContent ? null : fields.url,
        folderId: fields.folderId || null,
        companyId,
        updatedAt: new Date(),
      })
      .where(eq(bookmarks.id, bookmarkId));
    await audit(actor, "bookmark.updated", bookmarkId, companyId, { title: fields.title });
    refresh();
    return { success: "Bookmark atualizado." };
  } catch (error) {
    return failure(error);
  }
}

/** Only the folder changes ("" is Sem pasta); used by "Mover para". */
export async function moveBookmarkAs(actor: Actor, input: { id: unknown; folderId: unknown }): Promise<ActionState> {
  try {
    const bookmarkId = id.parse(input.id);
    const folderId = z.union([id, z.literal("")]).parse(input.folderId ?? "");
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

export async function deleteBookmarkAs(actor: Actor, input: { id: unknown }): Promise<ActionState> {
  try {
    const bookmarkId = id.parse(input.id);
    const item = await editableBookmark(actor, bookmarkId);
    if (!item) return blocked;
    const [removed] = await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId)).returning({ storageKey: bookmarks.storageKey });
    await removeStoredFiles([removed?.storageKey]);
    await audit(actor, "bookmark.deleted", bookmarkId, item.companyId, { title: item.title });
    refresh();
    return { success: "Bookmark excluído." };
  } catch (error) {
    return failure(error);
  }
}
