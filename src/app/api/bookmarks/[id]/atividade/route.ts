import { getActor } from "@/lib/access/access";
import { bookmarkActivity } from "@/lib/drive/activity";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

/** An item's activity, newest first, for who may edit it. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  const rows = UUID.test(id) ? await bookmarkActivity(actor, id) : null;
  if (!rows) return Response.json({ error: "Não encontrado." }, { status: 404, headers });
  return Response.json({ activity: rows }, { headers });
}
