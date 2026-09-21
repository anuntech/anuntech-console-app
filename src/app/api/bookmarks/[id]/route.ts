import { eq } from "drizzle-orm";
import { bookmarks } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { db } from "@/lib/db";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  const { id } = await params;
  const [meta] = await db
    .select({ companyId: bookmarks.companyId })
    .from(bookmarks)
    .where(eq(bookmarks.id, id));
  if (!meta || !canAccess(actor, meta.companyId, "overview"))
    return new Response(null, { status: 404 });
  const [file] = await db
    .select({ content: bookmarks.content, name: bookmarks.fileName })
    .from(bookmarks)
    .where(eq(bookmarks.id, id));
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
