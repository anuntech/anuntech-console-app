import { eq } from "drizzle-orm";
import { auditEvents, bookmarks } from "@/db/schema";
import { getActor } from "@/lib/access/access";
import { bookmarkFor } from "@/lib/bookmarks/bookmarks";
import { BOARD_INVALID, MAX_PREVIEW_BYTES, parseBoard } from "@/lib/bookmarks/board-rules";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/http/same-origin";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PNG = [0x89, 0x50, 0x4e, 0x47];
const respond = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * The editor's autosave: the whole scene and, when there is something drawn,
 * a PNG for the card. A route handler rather than a server action because
 * saves fire every few seconds, can outgrow an action's 2 MB body and must not
 * queue behind other actions on the page. Only the people who may edit the
 * bookmark (staff, who saved it, the folder's owner) can draw on it.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request))
    return respond({ error: "O envio foi recusado. Recarregue a página e tente de novo." }, 403);
  const actor = await getActor();
  const { id } = await params;
  if (!UUID.test(id)) return respond({ error: "Lousa não encontrada." }, 404);
  const item = await bookmarkFor(actor, id);
  if (!item?.board) return respond({ error: "Lousa não encontrada." }, 404);
  if (!item.editable)
    return respond({ error: "Só quem criou a lousa, o dono da pasta ou a equipe pode desenhar nela." }, 403);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond({ error: BOARD_INVALID }, 400);
  }
  const scene = form.get("scene");
  if (typeof scene !== "string") return respond({ error: BOARD_INVALID }, 400);
  const parsed = parseBoard(scene);
  if ("error" in parsed) return respond({ error: parsed.error }, 400);
  const picture = form.get("preview");
  let preview: Buffer | undefined;
  if (picture instanceof File && picture.size > 0) {
    if (picture.size > MAX_PREVIEW_BYTES) return respond({ error: "A imagem da lousa ficou grande demais." }, 400);
    const bytes = Buffer.from(await picture.arrayBuffer());
    if (!PNG.every((byte, index) => bytes[index] === byte))
      return respond({ error: "A imagem da lousa não é um PNG." }, 400);
    preview = bytes;
  }
  const savedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(bookmarks)
      .set({ board: parsed.board, updatedAt: savedAt, ...(preview ? { preview } : {}) })
      .where(eq(bookmarks.id, item.id));
    // One audit entry per editing session, not per stroke: the editor flags its first save.
    if (form.get("first") === "1")
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: item.companyId,
        action: "bookmark.board_edited",
        entityId: item.id,
        details: { title: item.title, elements: parsed.board.elements.length },
      });
  });
  return respond({ ok: true, savedAt: savedAt.toISOString() });
}
