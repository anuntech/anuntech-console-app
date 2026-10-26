"use server";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import {
  createFolderAs,
  deleteBookmarkAs,
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

export async function deleteBookmark(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return deleteBookmarkAs(actor, { id: form.get("id") });
}
