import { eq } from "drizzle-orm";
import { bookmarks } from "@/db/schema";
import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import { db } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The PNG of a whiteboard, for the card of whoever can see the bookmark. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const item = await bookmarkFor(actor, id);
  if (!item?.board) return new Response(null, { status: 404 });
  const [row] = await db.select({ preview: bookmarks.preview }).from(bookmarks).where(eq(bookmarks.id, item.id));
  if (!row?.preview) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.preview), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
