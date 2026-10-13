import { eq } from "drizzle-orm";
import { bookmarks } from "@/db/schema";
import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import { db } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A saved file, for whoever can see the bookmark. */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const item = await bookmarkFor(actor, id);
  if (!item?.fileName) return new Response(null, { status: 404 });
  // The bytes are read only after the access check, and only for a file bookmark.
  const [file] = await db.select({ content: bookmarks.content }).from(bookmarks).where(eq(bookmarks.id, item.id));
  if (!file?.content) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.content), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(item.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
