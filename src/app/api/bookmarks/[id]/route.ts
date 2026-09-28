import { and, eq } from "drizzle-orm";
import { bookmarkFolderShares, bookmarkFolders, bookmarks } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access/access";
import { db } from "@/lib/db";

/** A saved file, for whoever can see the bookmark. */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  const { id } = await params;
  const [file] = await db
    .select({
      content: bookmarks.content,
      name: bookmarks.fileName,
      companyId: bookmarks.companyId,
      ownerId: bookmarks.ownerId,
      folderVisibility: bookmarkFolders.visibility,
      folderOwner: bookmarkFolders.ownerId,
      sharedWithMe: bookmarkFolderShares.userId,
    })
    .from(bookmarks)
    .leftJoin(bookmarkFolders, eq(bookmarkFolders.id, bookmarks.folderId))
    .leftJoin(
      bookmarkFolderShares,
      and(
        eq(bookmarkFolderShares.folderId, bookmarks.folderId),
        eq(bookmarkFolderShares.userId, actor.user.id),
      ),
    )
    .where(eq(bookmarks.id, id));
  if (!file?.content || !file.name) return new Response(null, { status: 404 });
  const inCompany = file.companyId ? canAccess(actor, file.companyId, "overview") : actor.admin;
  const folderOpen =
    !file.folderVisibility ||
    file.folderVisibility === "company" ||
    file.folderOwner === actor.user.id ||
    !!file.sharedWithMe;
  if (!actor.admin && !(inCompany && folderOpen)) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.content), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
