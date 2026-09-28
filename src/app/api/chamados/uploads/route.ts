import { and, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getActor, allowedIds } from "@/lib/access/access";
import { db } from "@/lib/db";
import { ticketUploads } from "@/db/schema";
import { MAX_TICKET_BYTES, normalizeTicketFile } from "@/lib/tickets/ticket-files";
import { safeFileName } from "@/lib/bookmarks/bookmark-validation";
export const maxDuration = 60;
const respond = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
function sameOrigin(request: Request) {
  return (
    request.headers.get("origin") ===
      new URL(process.env.BETTER_AUTH_URL || request.url).origin &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return respond({ error: "O envio foi recusado. Recarregue a página e tente de novo." }, 403);
  const actor = await getActor();
  if (!actor.admin && !allowedIds(actor, "support").length)
    return respond({ error: "Acesso negado." }, 403);
  try {
    const input = z
      .object({
        name: z.string().min(1).max(255),
        size: z.number().int().min(1).max(MAX_TICKET_BYTES),
      })
      .parse(await request.json());
    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${actor.user.id}))`,
      );
      await tx
        .delete(ticketUploads)
        .where(lt(ticketUploads.expiresAt, new Date()));
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(ticketUploads)
        .where(eq(ticketUploads.authorId, actor.user.id));
      if (n >= 10)
        throw new Error(
          "Há muitos envios pendentes. Tente novamente mais tarde.",
        );
      await tx
        .insert(ticketUploads)
        .values({
          id,
          authorId: actor.user.id,
          name: safeFileName(input.name),
          expectedSize: input.size,
          content: Buffer.alloc(0),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
    });
    return respond({ id });
  } catch {
    return respond(
      {
        error:
          "Não foi possível iniciar o envio. Use arquivos de até 20 MB e tente novamente.",
      },
      400,
    );
  }
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request))
    return respond({ error: "O envio foi recusado. Recarregue a página e tente de novo." }, 403);
  const actor = await getActor();
  if (!actor.admin && !allowedIds(actor, "support").length)
    return respond({ error: "Acesso negado." }, 403);
  const url = new URL(request.url),
    id = url.searchParams.get("id"),
    offset = Number(url.searchParams.get("offset"));
  if (!id || !Number.isSafeInteger(offset) || offset < 0)
    return respond({ error: "Não foi possível continuar o envio. Selecione o arquivo de novo." }, 400);
  const reader = request.body?.getReader();
  if (!reader) return respond({ error: "Arquivo vazio." }, 400);
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 1024 * 1024) {
        await reader.cancel();
        return respond({ error: "Parte excede o limite." }, 413);
      }
      chunks.push(value);
    }
    if (!length) return respond({ error: "Arquivo vazio." }, 400);
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(ticketUploads)
        .where(
          and(
            eq(ticketUploads.id, id),
            eq(ticketUploads.authorId, actor.user.id),
          ),
        )
        .for("update");
      if (
        !row ||
        row.ready ||
        row.expiresAt < new Date() ||
        row.receivedSize !== offset ||
        offset + length > row.expectedSize
      )
        throw new Error("Envio expirado ou incompleto. Tente novamente.");
      const content = Buffer.concat([row.content, Buffer.concat(chunks)]),
        ready = content.length === row.expectedSize;
      const file = ready ? await normalizeTicketFile(content, row.name) : null;
      await tx
        .update(ticketUploads)
        .set({
          content: file?.content || content,
          receivedSize: offset + length,
          ready,
          mime: file?.mime,
          name: file?.name || row.name,
        })
        .where(eq(ticketUploads.id, id));
    });
    return respond({ success: true });
  } catch (error) {
    return respond(
      { error: error instanceof Error ? error.message : "O envio do anexo falhou. Tente de novo." },
      400,
    );
  } finally {
    reader.releaseLock();
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return respond({}, 403);
  const actor = await getActor(),
    id = new URL(request.url).searchParams.get("id");
  if (id)
    await db
      .delete(ticketUploads)
      .where(
        and(
          eq(ticketUploads.id, id),
          eq(ticketUploads.authorId, actor.user.id),
        ),
      );
  return respond({ success: true });
}
