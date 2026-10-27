import "server-only";
import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  auditEvents,
  bookmarkFolderShares,
  bookmarkFolders,
  bookmarks,
  fileUploads,
  fileVersions,
} from "@/db/schema";
import { TAG_SLUGS } from "../drive/tag-rules";
import { gateOpen, gateViewerOf, hasGate, sameGate } from "./folder-gate";
import { db } from "../db";
import { canAccess, type Actor } from "../access/access";
import { bookmarkInput, safeFileName } from "./bookmark-validation";
import { boardHref, bookmarkKinds, EMPTY_BOARD } from "./board-rules";
import { personInScope, scopeOf, searchBookmarkPeople } from "./bookmarks";
import type { ActionState } from "../action-state";
import { BOOKMARK_FILE, limitLabel } from "../tickets/attachment-rules";
import { claimUpload } from "../drive/upload-claim";
import { createInRefusal, descendantIds, moveRefusal } from "./folder-tree";
import { removeStoredFiles } from "../drive/r2";
import { TRASH_DAYS } from "../drive/drive-rules";

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
      parentId: bookmarkFolders.parentId,
      origin: bookmarkFolders.origin,
      area: bookmarkFolders.area,
      engagementId: bookmarkFolders.engagementId,
    })
    .from(bookmarkFolders)
    .where(eq(bookmarkFolders.id, folderId));
  return folder ?? null;
}
type Folder = NonNullable<Awaited<ReturnType<typeof loadFolder>>>;

/** Staff or the owner: rename, share, delete. A folder the Console keeps is the team's only. */
export const manages = (actor: Actor, folder: Folder) => actor.admin || (folder.ownerId === actor.user.id && !folder.origin);

/** The Console's own folders (contracts, deliveries) stay where they are and as they are. */
const SYSTEM_FOLDER = { error: "Esta pasta é mantida pelo Console: ela não pode ser excluída, movida nem compartilhada." };

/** What is behind a gate stays behind it: it moves only into a folder with the same gate (folder-gate.ts). */
const GATED = { error: "Este item está numa pasta de acesso restrito (contratos ou um projeto): ele só pode ir para outra pasta com a mesma restrição." };
async function gateKeeps(fromFolderId: string | null, target: Folder | null) {
  if (!fromFolderId) return true;
  const from = await loadFolder(fromFolderId);
  if (!from || !hasGate(from)) return true;
  return !!target && sameGate(from, target);
}

/** Whoever can see the folder can add to it. */
export async function usable(actor: Actor, folder: Folder) {
  if (!companyAllowed(actor, folder.companyId)) return false;
  if (!gateOpen(gateViewerOf(actor), folder)) return false;
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
async function editableBookmark(actor: Actor, bookmarkId: string, { trashed = false } = {}) {
  const [item] = await db
    .select({
      id: bookmarks.id,
      ownerId: bookmarks.ownerId,
      companyId: bookmarks.companyId,
      folderId: bookmarks.folderId,
      folderOwner: bookmarkFolders.ownerId,
      folderOrigin: bookmarkFolders.origin,
      title: bookmarks.title,
      fileName: bookmarks.fileName,
      board: sql<boolean>`(${bookmarks.board} is not null)`,
    })
    .from(bookmarks)
    .leftJoin(bookmarkFolders, eq(bookmarkFolders.id, bookmarks.folderId))
    // The trash's own actions (restore, delete for good) reach trashed items; the rest never do.
    .where(and(eq(bookmarks.id, bookmarkId), trashed ? isNotNull(bookmarks.deletedAt) : isNull(bookmarks.deletedAt)));
  if (!item) return null;
  // The owner of a folder the Console keeps does not edit what is in it for that.
  if (actor.admin || item.ownerId === actor.user.id || (item.folderOwner === actor.user.id && !item.folderOrigin))
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
    const parsed = z.object({ name: folderName, companyId: companyField, visibility, parentId: companyField }).parse(input);
    // Inside another folder: its company, and who sees it, come from the folder above.
    const parent = parsed.parentId ? await loadFolder(parsed.parentId) : null;
    if (parsed.parentId && (!parent || !(await usable(actor, parent)))) return blocked;
    const companyId = parent ? parent.companyId : parsed.companyId || null;
    if (!companyAllowed(actor, companyId)) return blocked;
    if (parent) {
      const refusal = createInRefusal(await companyFolders(companyId), parent.id);
      if (refusal) return { error: refusal };
    }
    const folder = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(bookmarkFolders)
        .values({ ownerId: actor.user.id, companyId, name: parsed.name, visibility: parent ? parent.visibility : parsed.visibility, parentId: parent?.id ?? null })
        .returning({ id: bookmarkFolders.id });
      if (parent) await inheritAccess(tx, parent.id, [row.id]);
      return row;
    });
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
    if (folder.origin) return SYSTEM_FOLDER;
    // What was inside, files and subfolders, moves up one level (to Sem pasta at the top).
    const up = folder.parentId ?? null;
    // ...unless that would take it out from behind a gate: then only an empty folder goes.
    const parent = up ? await loadFolder(up) : null;
    if (hasGate(folder) && !(parent && sameGate(folder, parent))) {
      const [inside] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(bookmarks)
        .where(eq(bookmarks.folderId, folder.id));
      const [below] = await db.select({ n: sql<number>`count(*)::int` }).from(bookmarkFolders).where(eq(bookmarkFolders.parentId, folder.id));
      if (inside.n || below.n) return { error: "Esta pasta tem acesso restrito: esvazie (inclusive a lixeira dela) antes de excluir, para nada ficar aberto para toda a empresa." };
    }
    await db.transaction(async (tx) => {
      await tx.update(bookmarks).set({ folderId: up }).where(eq(bookmarks.folderId, folder.id));
      await tx.update(fileUploads).set({ folderId: up }).where(eq(fileUploads.folderId, folder.id));
      await tx.update(bookmarkFolders).set({ parentId: up }).where(eq(bookmarkFolders.parentId, folder.id));
      await tx.delete(bookmarkFolderShares).where(eq(bookmarkFolderShares.folderId, folder.id));
      await tx.delete(bookmarkFolders).where(eq(bookmarkFolders.id, folder.id));
    });
    await audit(actor, "bookmark_folder.deleted", folder.id, folder.companyId, { name: folder.name });
    refresh();
    return { success: "Pasta excluída.", href: up ? `/bookmarks?pasta=${up}` : "/bookmarks" };
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
    if (folder.origin) return SYSTEM_FOLDER;
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
      // The subfolders follow: who sees a folder sees what is inside it.
      const below = descendantIds(await companyFolders(folder.companyId, tx), folder.id);
      if (below.length) await inheritAccess(tx, folder.id, below);
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A space's folders, for the tree rules (folder-tree.ts). */
async function companyFolders(companyId: string | null, executor: Pick<typeof db, "select"> = db) {
  return executor
    .select({ id: bookmarkFolders.id, parentId: bookmarkFolders.parentId, companyId: bookmarkFolders.companyId, name: bookmarkFolders.name })
    .from(bookmarkFolders)
    .where(companyId ? eq(bookmarkFolders.companyId, companyId) : isNull(bookmarkFolders.companyId));
}

/**
 * `targets` see what `sourceId` sees: the same visibility and the same people,
 * plus the source's owner (who created the folder above must not lose what was
 * put inside it). Each target's own owner always sees it.
 */
async function inheritAccess(tx: Tx, sourceId: string, targets: string[]) {
  const [source] = await tx
    .select({ visibility: bookmarkFolders.visibility, ownerId: bookmarkFolders.ownerId, area: bookmarkFolders.area, engagementId: bookmarkFolders.engagementId })
    .from(bookmarkFolders)
    .where(eq(bookmarkFolders.id, sourceId));
  if (!source || !targets.length) return;
  // A gate above (contracts, a project) comes down too; one the target had is never taken off, so nothing opens by moving.
  if (source.area) await tx.update(bookmarkFolders).set({ area: source.area }).where(and(inArray(bookmarkFolders.id, targets), isNull(bookmarkFolders.area)));
  if (source.engagementId)
    await tx.update(bookmarkFolders).set({ engagementId: source.engagementId }).where(and(inArray(bookmarkFolders.id, targets), isNull(bookmarkFolders.engagementId)));
  const people = (await tx.select({ userId: bookmarkFolderShares.userId }).from(bookmarkFolderShares).where(eq(bookmarkFolderShares.folderId, sourceId))).map((r) => r.userId);
  const owners = await tx.select({ id: bookmarkFolders.id, ownerId: bookmarkFolders.ownerId }).from(bookmarkFolders).where(inArray(bookmarkFolders.id, targets));
  await tx.update(bookmarkFolders).set({ visibility: source.visibility }).where(inArray(bookmarkFolders.id, targets));
  await tx.delete(bookmarkFolderShares).where(inArray(bookmarkFolderShares.folderId, targets));
  if (source.visibility !== "people") return;
  const rows = owners.flatMap((target) =>
    [...new Set([...people, source.ownerId])].filter((userId) => userId !== target.ownerId).map((userId) => ({ folderId: target.id, userId })),
  );
  if (rows.length) await tx.insert(bookmarkFolderShares).values(rows);
}

/** A folder into another of the same company (or to the top, ""), with its subfolders; who sees it follows the new place. */
export async function moveFolderAs(actor: Actor, input: { id: unknown; parentId: unknown }): Promise<ActionState> {
  try {
    const folderId = id.parse(input.id);
    const target = companyField.parse(input.parentId ?? "");
    const folder = await loadFolder(folderId);
    if (!folder || !manages(actor, folder)) return blocked;
    if (folder.origin) return SYSTEM_FOLDER;
    if ((folder.parentId ?? "") === target) return { success: "A pasta já está aí." };
    const into = target ? await loadFolder(target) : null;
    if (target && (!into || !(await usable(actor, into)))) return blocked;
    // A folder with a gate goes only behind the same gate; one without takes the gate of where it goes.
    if (hasGate(folder) && !(into && sameGate(folder, into))) return GATED;
    const tree = await companyFolders(folder.companyId);
    const refusal = moveRefusal(tree, folder.id, target);
    if (refusal) return { error: refusal };
    await db.transaction(async (tx) => {
      await tx.update(bookmarkFolders).set({ parentId: target || null }).where(eq(bookmarkFolders.id, folder.id));
      if (target) await inheritAccess(tx, target, [folder.id, ...descendantIds(tree, folder.id)]);
    });
    await audit(actor, "bookmark_folder.moved", folder.id, folder.companyId, { name: folder.name, parentId: target || null });
    refresh();
    return { success: into ? `Pasta movida para “${into.name}”.` : "Pasta movida para o início." };
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
    // The tag changes only when the form brings one that differs: saving the title keeps the Console's suggestion as it is.
    const tagInput = "tag" in input ? z.union([z.enum(TAG_SLUGS), z.literal("")]).safeParse(input.tag ?? "") : null;
    if (tagInput && !tagInput.success) return { error: "Escolha uma etiqueta da lista." };
    const [current] = await db.select({ tag: bookmarks.tag }).from(bookmarks).where(eq(bookmarks.id, bookmarkId));
    const chosen = tagInput?.success ? tagInput.data || null : undefined;
    const tagChange = chosen !== undefined && chosen !== (current?.tag ?? null) ? { tag: chosen, tagSource: "person" as const } : {};
    let companyId = item.companyId;
    if ((fields.folderId || null) !== item.folderId) {
      const folder = fields.folderId ? await loadFolder(fields.folderId) : null;
      if (fields.folderId && (!folder || !(await usable(actor, folder)))) return blocked;
      if (!(await gateKeeps(item.folderId, folder))) return GATED;
      if (folder) companyId = folder.companyId;
    }
    await db
      .update(bookmarks)
      .set({
        title: fields.title,
        url: keepsContent ? null : fields.url,
        folderId: fields.folderId || null,
        companyId,
        ...tagChange,
        updatedAt: new Date(),
      })
      .where(eq(bookmarks.id, bookmarkId));
    await audit(actor, "bookmark.updated", bookmarkId, companyId, { title: fields.title, ...("tag" in tagChange ? { tag: tagChange.tag } : {}) });
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
    const folder = folderId ? await loadFolder(folderId) : null;
    if (folderId) {
      if (!folder || !(await usable(actor, folder))) return blocked;
      companyId = folder.companyId;
    }
    if ((folderId || null) !== item.folderId && !(await gateKeeps(item.folderId, folder))) return GATED;
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

/** "Excluir": into the trash for TRASH_DAYS, with the file kept in R2 until then. */
export async function deleteBookmarkAs(actor: Actor, input: { id: unknown }): Promise<ActionState> {
  try {
    const bookmarkId = id.parse(input.id);
    const item = await editableBookmark(actor, bookmarkId);
    if (!item) return blocked;
    await db.update(bookmarks).set({ deletedAt: new Date(), deletedBy: actor.user.id }).where(and(eq(bookmarks.id, bookmarkId), isNull(bookmarks.deletedAt)));
    await audit(actor, "bookmark.trashed", bookmarkId, item.companyId, { title: item.title });
    refresh();
    return { success: `Movido para a lixeira. Fica lá por ${TRASH_DAYS} dias.` };
  } catch (error) {
    return failure(error);
  }
}

/** Back from the trash, to its folder (or Sem pasta, when the folder is gone). */
export async function restoreBookmarkAs(actor: Actor, input: { id: unknown }): Promise<ActionState> {
  try {
    const bookmarkId = id.parse(input.id);
    const item = await editableBookmark(actor, bookmarkId, { trashed: true });
    if (!item) return blocked;
    await db.update(bookmarks).set({ deletedAt: null, deletedBy: null }).where(eq(bookmarks.id, bookmarkId));
    await audit(actor, "bookmark.restored", bookmarkId, item.companyId, { title: item.title });
    refresh();
    return { success: "Restaurado." };
  } catch (error) {
    return failure(error);
  }
}

/** Gone for good, its file in R2 too; only from the trash. */
export async function purgeBookmarkAs(actor: Actor, input: { id: unknown }): Promise<ActionState> {
  try {
    const bookmarkId = id.parse(input.id);
    const item = await editableBookmark(actor, bookmarkId, { trashed: true });
    if (!item) return blocked;
    const versions = await versionKeys([bookmarkId]);
    const [removed] = await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId)).returning({ storageKey: bookmarks.storageKey });
    await removeStoredFiles([removed?.storageKey, ...versions]);
    await audit(actor, "bookmark.deleted", bookmarkId, item.companyId, { title: item.title });
    refresh();
    return { success: "Excluído de vez." };
  } catch (error) {
    return failure(error);
  }
}

/**
 * The daily routine: what has been in the trash for TRASH_DAYS goes for good,
 * files included. Returns how many left.
 */
export async function emptyExpiredTrash(now = new Date()) {
  const expired = lt(bookmarks.deletedAt, new Date(now.getTime() - TRASH_DAYS * 86_400_000));
  const ids = (await db.select({ id: bookmarks.id }).from(bookmarks).where(expired)).map((r) => r.id);
  if (!ids.length) return 0;
  const versions = await versionKeys(ids);
  const removed = await db.delete(bookmarks).where(inArray(bookmarks.id, ids)).returning({ storageKey: bookmarks.storageKey });
  await removeStoredFiles([...removed.map((r) => r.storageKey), ...versions]);
  return removed.length;
}

/** The R2 keys of these bookmarks' earlier versions (their rows go with the bookmark, by cascade). */
export async function versionKeys(bookmarkIds: string[]) {
  if (!bookmarkIds.length) return [];
  return (await db.select({ key: fileVersions.storageKey }).from(fileVersions).where(inArray(fileVersions.bookmarkId, bookmarkIds))).map((r) => r.key);
}

/** "Enviar nova versão": the finished upload becomes the file; the one it replaces is kept as a version. */
export async function replaceBookmarkFileAs(actor: Actor, input: { id: unknown; uploadId: unknown }): Promise<ActionState> {
  try {
    const bookmarkId = id.parse(input.id);
    const uploadId = z.string().uuid().parse(input.uploadId);
    const item = await editableBookmark(actor, bookmarkId);
    if (!item) return blocked;
    const [current] = await db
      .select({ storageKey: bookmarks.storageKey, fileName: bookmarks.fileName, fileSize: bookmarks.fileSize, mime: bookmarks.mime, ownerId: bookmarks.ownerId, updatedAt: bookmarks.updatedAt })
      .from(bookmarks)
      .where(eq(bookmarks.id, bookmarkId));
    if (!current?.storageKey || !current.fileName) return { error: "Só um arquivo guardado no Arquivos ganha versões." };
    const [copy] = await db.select({ origin: bookmarks.origin }).from(bookmarks).where(eq(bookmarks.id, bookmarkId));
    if (copy?.origin) return { error: "Este arquivo é uma cópia que o Console guarda (de um contrato ou de uma entrega). Para mudar, mude o contrato ou a tarefa." };
    const done = await db.transaction(async (tx) => {
      const stored = await claimUpload(actor, uploadId, item.companyId, tx);
      if (!stored) return null;
      const [{ last }] = await tx.select({ last: sql<number>`coalesce(max(${fileVersions.version}), 0)::int` }).from(fileVersions).where(eq(fileVersions.bookmarkId, bookmarkId));
      await tx.insert(fileVersions).values({
        bookmarkId,
        companyId: item.companyId,
        version: last + 1,
        fileName: current.fileName!,
        fileSize: current.fileSize ?? 0,
        mime: current.mime,
        storageKey: current.storageKey!,
        actorId: current.ownerId,
        createdAt: current.updatedAt,
      });
      await tx
        .update(bookmarks)
        .set({ storageKey: stored.storageKey, fileSize: stored.size, mime: stored.mime, fileName: stored.fileName, updatedAt: new Date() })
        .where(eq(bookmarks.id, bookmarkId));
      return last + 2;
    });
    if (!done) return { error: "O envio do arquivo não foi concluído. Envie de novo." };
    await audit(actor, "bookmark.version_added", bookmarkId, item.companyId, { title: item.title, version: done });
    refresh();
    return { success: `Nova versão salva (versão ${done}). A anterior fica em Versões.` };
  } catch (error) {
    return failure(error);
  }
}

/** An earlier version becomes the file again; the current one goes to the versions, so nothing is lost. */
export async function restoreVersionAs(actor: Actor, input: { id: unknown }): Promise<ActionState> {
  try {
    const versionId = id.parse(input.id);
    const [version] = await db.select().from(fileVersions).where(eq(fileVersions.id, versionId));
    if (!version) return blocked;
    const item = await editableBookmark(actor, version.bookmarkId);
    if (!item) return blocked;
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ storageKey: bookmarks.storageKey, fileName: bookmarks.fileName, fileSize: bookmarks.fileSize, mime: bookmarks.mime, ownerId: bookmarks.ownerId, updatedAt: bookmarks.updatedAt })
        .from(bookmarks)
        .where(eq(bookmarks.id, version.bookmarkId))
        .for("update");
      if (!current?.storageKey) throw Error();
      const [{ last }] = await tx.select({ last: sql<number>`coalesce(max(${fileVersions.version}), 0)::int` }).from(fileVersions).where(eq(fileVersions.bookmarkId, version.bookmarkId));
      await tx.insert(fileVersions).values({
        bookmarkId: version.bookmarkId,
        companyId: version.companyId,
        version: last + 1,
        fileName: current.fileName ?? version.fileName,
        fileSize: current.fileSize ?? 0,
        mime: current.mime,
        storageKey: current.storageKey,
        actorId: current.ownerId,
        createdAt: current.updatedAt,
      });
      await tx.delete(fileVersions).where(eq(fileVersions.id, version.id));
      await tx
        .update(bookmarks)
        .set({ storageKey: version.storageKey, fileSize: version.fileSize, mime: version.mime, fileName: version.fileName, updatedAt: new Date() })
        .where(eq(bookmarks.id, version.bookmarkId));
    });
    await audit(actor, "bookmark.version_restored", version.bookmarkId, item.companyId, { title: item.title, version: version.version });
    refresh();
    return { success: `A versão ${version.version} voltou a ser o arquivo. A que estava fica em Versões.` };
  } catch (error) {
    return failure(error);
  }
}
