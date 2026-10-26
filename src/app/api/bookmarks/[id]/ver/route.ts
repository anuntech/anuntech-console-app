import { eq } from "drizzle-orm";
import { bookmarks } from "@/db/schema";
import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import { db } from "@/lib/db";
import { previewOf } from "@/lib/drive/drive-rules";
import { downloadUrl } from "@/lib/drive/r2";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A file to look at without downloading it (Arquivos' preview): only the kinds
 * previewOf allows, from R2, through a five-minute address made after the same
 * access check as the download. Anything else answers 404 and is downloaded.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  const item = await bookmarkFor(actor, id);
  if (!item?.fileName) return new Response(null, { status: 404 });
  const [stored] = await db.select({ key: bookmarks.storageKey, size: bookmarks.fileSize }).from(bookmarks).where(eq(bookmarks.id, item.id));
  const preview = previewOf(item.fileName, stored?.size);
  if (!stored?.key || !preview) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: await downloadUrl(stored.key, item.fileName, true, preview.type), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
