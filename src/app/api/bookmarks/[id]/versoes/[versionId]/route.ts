import { and, eq } from "drizzle-orm";
import { fileVersions } from "@/db/schema";
import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import { db } from "@/lib/db";
import { downloadUrl } from "@/lib/drive/r2";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An earlier version, downloaded like the current file: same access check, a five-minute signed address. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const actor = await getActor();
  const { id, versionId } = await params;
  if (!UUID.test(id) || !UUID.test(versionId)) return new Response(null, { status: 404 });
  const item = await bookmarkFor(actor, id);
  if (!item) return new Response(null, { status: 404 });
  const [version] = await db
    .select({ key: fileVersions.storageKey, fileName: fileVersions.fileName })
    .from(fileVersions)
    .where(and(eq(fileVersions.id, versionId), eq(fileVersions.bookmarkId, item.id)));
  if (!version) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: await downloadUrl(version.key, version.fileName), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
