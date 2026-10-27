import { and, eq } from "drizzle-orm";
import { bookmarks, fileTexts } from "@/db/schema";
import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import { db } from "@/lib/db";
import { downloadUrl } from "@/lib/drive/r2";
import { thumbKeyOf } from "@/lib/drive/thumbnails";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A photo's card picture, for whoever sees the item: a five-minute address
 * to the small WebP in R2 (made by the reading routine). The answer itself
 * may be reused for four minutes, so a list page does not ask again.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const item = await bookmarkFor(actor, id);
  if (!item?.fileName) return new Response(null, { status: 404 });
  const [row] = await db
    .select({ key: bookmarks.storageKey, thumb: fileTexts.thumbStatus, source: fileTexts.sourceKey })
    .from(bookmarks)
    .innerJoin(fileTexts, eq(fileTexts.bookmarkId, bookmarks.id))
    .where(and(eq(bookmarks.id, item.id)));
  // Only the picture of the file as it is now (a new version waits for its own).
  if (!row?.key || row.thumb !== "done" || row.source !== row.key) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: await downloadUrl(thumbKeyOf(row.key), "miniatura.webp", true, "image/webp"),
      "Cache-Control": "private, max-age=240",
      "Referrer-Policy": "no-referrer",
    },
  });
}
