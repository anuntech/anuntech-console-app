"use server";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import {
  createFolderAs,
  deleteBookmarkAs,
  replaceBookmarkFileAs,
  restoreVersionAs,
  purgeBookmarkAs,
  restoreBookmarkAs,
  deleteFolderAs,
  moveFolderAs,
  moveBookmarkAs,
  renameFolderAs,
  saveBookmarkAs,
  searchPeopleAs,
  shareFolderAs,
  updateBookmarkAs,
} from "./bookmark-core";
import { indexSoon } from "../drive/file-index";
import { copyBookmarkAs } from "./bookmark-copy";

/*
 * The web's bookmark forms. The rules live in bookmark-core.ts, shared with
 * the app's procedures (bookmarks.*); these only read the FormData.
 */

export async function createFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const state = await createFolderAs(actor, Object.fromEntries(form));
  delete state.id;
  return state;
}

export async function renameFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return renameFolderAs(actor, { id: form.get("id"), name: form.get("name") });
}

/** The folder goes away; what was inside stays with the company, loose. */
export async function moveFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return moveFolderAs(actor, { id: form.get("id"), parentId: form.get("parentId") });
}

export async function deleteFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return deleteFolderAs(actor, { id: form.get("id") });
}

/** Who sees the folder: the whole company, or only chosen people. */
export async function shareFolder(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return shareFolderAs(actor, {
    id: form.get("id"),
    visibility: form.get("visibility"),
    userIds: form.getAll("userIds"),
  });
}

/** Live search for the share dialog; only people the folder's company can include. */
export async function searchPeople(folderId: string, query: string) {
  const actor = await getActor();
  return searchPeopleAs(actor, folderId, query);
}

export async function saveBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const state = await saveBookmarkAs(actor, Object.fromEntries(form), form.get("file"));
  if (state.success) indexSoon();
  // The id is for the app; the web's form answers as it always did.
  delete state.id;
  return state;
}

/** Title, link and folder. A file bookmark keeps its file. */
export async function updateBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return updateBookmarkAs(actor, { ...Object.fromEntries(form), id: form.get("id") });
}

/** Only the folder changes; used by "Mover para". */
export async function moveBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return moveBookmarkAs(actor, { id: form.get("id"), folderId: form.get("folderId") });
}

export async function restoreBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return restoreBookmarkAs(actor, { id: form.get("id") });
}

export async function purgeBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return purgeBookmarkAs(actor, { id: form.get("id") });
}

export async function replaceBookmarkFile(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const state = await replaceBookmarkFileAs(actor, { id: form.get("id"), uploadId: form.get("uploadId") });
  if (state.success) indexSoon();
  return state;
}

export async function restoreVersion(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const state = await restoreVersionAs(actor, { id: form.get("id") });
  if (state.success) indexSoon();
  return state;
}

export async function deleteBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return deleteBookmarkAs(actor, { id: form.get("id") });
}

/** Several items at once (the list's selection): at most this many per request. */
const MAX_BATCH = 200;
const idsOf = (form: FormData) => [...new Set(form.getAll("id").map(String))].slice(0, MAX_BATCH);
const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** "Mover para…" on the selection: each item by the same rules as one ("" is Sem pasta). */
export async function moveBookmarks(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const folderId = String(form.get("folderId") ?? "");
  let moved = 0;
  let firstError = "";
  for (const id of idsOf(form)) {
    const state = await moveBookmarkAs(actor, { id, folderId });
    if (state.error) firstError ||= state.error;
    else moved++;
  }
  if (!moved) return { error: firstError || "Nada foi movido." };
  return { success: `${plural(moved, "item movido", "itens movidos")}.${firstError ? ` Alguns ficaram: ${firstError}` : ""}` };
}

/** "Mover para a lixeira" on the selection. */
export async function trashBookmarks(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  let trashed = 0;
  let firstError = "";
  for (const id of idsOf(form)) {
    const state = await deleteBookmarkAs(actor, { id });
    if (state.error) firstError ||= state.error;
    else trashed++;
  }
  if (!trashed) return { error: firstError || "Nada foi para a lixeira." };
  return { success: `${plural(trashed, "item foi", "itens foram")} para a lixeira.${firstError ? ` Alguns ficaram: ${firstError}` : ""}` };
}

/** "Copiar para…": one item, into a folder the person can add to. */
export async function copyBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  const state = await copyBookmarkAs(actor, { id: form.get("id"), folderId: form.get("folderId") ?? "" });
  if (state.success) indexSoon();
  return state;
}
