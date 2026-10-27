import { desc, eq } from "drizzle-orm";
import { fileVersions, user } from "@/db/schema";
import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import { db } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

/** The earlier versions of a file, newest first, for whoever can see the bookmark. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Não encontrado." }, { status: 404, headers });
  const item = await bookmarkFor(actor, id);
  if (!item?.fileName) return Response.json({ error: "Não encontrado." }, { status: 404, headers });
  const rows = await db
    .select({ id: fileVersions.id, version: fileVersions.version, fileName: fileVersions.fileName, fileSize: fileVersions.fileSize, createdAt: fileVersions.createdAt, by: user.name })
    .from(fileVersions)
    .leftJoin(user, eq(user.id, fileVersions.actorId))
    .where(eq(fileVersions.bookmarkId, item.id))
    .orderBy(desc(fileVersions.version));
  return Response.json(
    { editable: item.editable, versions: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), by: r.by ?? null })) },
    { headers },
  );
}
