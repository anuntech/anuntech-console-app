import "server-only";
import { and, eq } from "drizzle-orm";
import { bookmarkFolderShares, bookmarkFolders } from "@/db/schema";
import { db } from "../db";
import { canAccess, type Actor } from "../access/access";

/*
 * Who may put something where, shared by the bookmark actions and the Mac
 * meeting-notes API (lib/meetings), so a note lands only where a link could.
 */

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
export type Folder = NonNullable<Awaited<ReturnType<typeof loadFolder>>>;

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
