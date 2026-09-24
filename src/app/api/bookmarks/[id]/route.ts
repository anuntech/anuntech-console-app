import { and, eq, or } from "drizzle-orm";
import { bookmarkFolderShares, bookmarkFolders, bookmarks } from "@/db/schema";
import { getActor } from "@/lib/access";
import { db } from "@/lib/db";

/** A saved file: for its owner, or for anyone the folder is shared with. */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  const { id } = await params;
  const [file] = await db
    .select({ content: bookmarks.content, name: bookmarks.fileName })
    .from(bookmarks)
    .leftJoin(bookmarkFolders, eq(bookmarkFolders.id, bookmarks.folderId))
    .leftJoin(
      bookmarkFolderShares,
      and(
        eq(bookmarkFolderShares.folderId, bookmarks.folderId),
        eq(bookmarkFolderShares.userId, actor.user.id),
      ),
    )
    .where(
      and(
        eq(bookmarks.id, id),
        or(
          eq(bookmarks.ownerId, actor.user.id),
          eq(bookmarkFolders.ownerId, actor.user.id),
          eq(bookmarkFolderShares.userId, actor.user.id),
        ),
      ),
    );
  if (!file?.content || !file.name) return new Response(null, { status: 404 });
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
