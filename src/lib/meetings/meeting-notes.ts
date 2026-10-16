import "server-only";
import { and, asc, eq, isNotNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditEvents, bookmarkFolderShares, bookmarkFolders, bookmarks } from "@/db/schema";
import { db } from "../db";
import { accessibleCompanies, type Actor } from "../access/access";
import { companyAllowed, loadFolder, usable } from "../bookmarks/bookmark-access";
import { MEETING_APP, type MeetingInfo, type NoteInput } from "./meeting-rules";

/*
 * Where the Mac app may save a note and the saving itself. Notes are bookmark
 * files: they follow the bookmark rules (bookmark-access.ts) and show up in
 * Bookmarks like anything else, opening in the note reader.
 */

export type Destination = {
  /** "internal" for Anuntech's own space, otherwise the company id. */
  id: string;
  name: string;
  folders: { id: string; name: string }[];
};

/**
 * The spaces and folders for the app's "Salvar em" menu: the person's
 * companies (every active one for the team, plus Anuntech's own) and, in
 * each, the folders they see in Bookmarks: open to the company, theirs or
 * shared with them. Saving checks again; this only draws the menu.
 */
export async function destinationsFor(actor: Actor): Promise<Destination[]> {
  const companies = (await accessibleCompanies(actor, "overview")).filter((company) => !company.archived);
  const spaces: Destination[] = [
    ...(actor.admin ? [{ id: "internal", name: "Anuntech", folders: [] }] : []),
    ...companies
      .map((company) => ({ id: company.id, name: company.name, folders: [] }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  ];
  const folders = await db
    .select({ id: bookmarkFolders.id, name: bookmarkFolders.name, companyId: bookmarkFolders.companyId })
    .from(bookmarkFolders)
    .leftJoin(
      bookmarkFolderShares,
      and(eq(bookmarkFolderShares.folderId, bookmarkFolders.id), eq(bookmarkFolderShares.userId, actor.user.id)),
    )
    .where(
      or(
        eq(bookmarkFolders.visibility, "company"),
        eq(bookmarkFolders.ownerId, actor.user.id),
        isNotNull(bookmarkFolderShares.userId),
      ),
    )
    .orderBy(asc(bookmarkFolders.name));
  const byId = new Map(spaces.map((space) => [space.id, space]));
  for (const folder of folders)
    byId.get(folder.companyId ?? "internal")?.folders.push({ id: folder.id, name: folder.name });
  return spaces;
}

export type SavedNote = { id: string; created: boolean };

/**
 * Saves the note as a bookmark file where the person could have saved a link;
 * null when they may not. The same note sent twice (a retry after a timeout)
 * returns the bookmark already saved.
 */
export async function saveMeetingNote(actor: Actor, input: NoteInput, device: string | null): Promise<SavedNote | null> {
  let companyId: string | null;
  if (input.folderId) {
    const folder = await loadFolder(input.folderId);
    if (!folder || !(await usable(actor, folder))) return null;
    companyId = folder.companyId;
  } else {
    companyId = input.space === "internal" ? null : input.space;
    if (!companyAllowed(actor, companyId)) return null;
  }
  const [existing] = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.ownerId, actor.user.id), sql`${bookmarks.meeting}->>'noteId' = ${input.noteId}`));
  if (existing) return { id: existing.id, created: false };
  const meeting: MeetingInfo = {
    source: MEETING_APP,
    noteId: input.noteId,
    startedAt: new Date(input.startedAt).toISOString(),
    durationSeconds: input.durationSeconds,
    device,
  };
  const id = await db.transaction(async (tx) => {
    const [item] = await tx
      .insert(bookmarks)
      .values({
        ownerId: actor.user.id,
        companyId,
        folderId: input.folderId,
        title: input.title,
        fileName: input.fileName,
        content: Buffer.from(input.markdown, "utf8"),
        meeting,
      })
      .returning({ id: bookmarks.id });
    await tx.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId,
      action: "bookmark.created",
      entityId: item.id,
      details: { title: input.title, source: MEETING_APP },
    });
    return item.id;
  });
  revalidatePath("/bookmarks");
  return { id, created: true };
}
