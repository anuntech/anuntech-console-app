import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import { thumbnailAddress } from "@/lib/drive/thumb-url";

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
  // Only the picture of the file as it is now (a new version waits for its own).
  const location = await thumbnailAddress(item.id);
  if (!location) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "private, max-age=240",
      "Referrer-Policy": "no-referrer",
    },
  });
}
