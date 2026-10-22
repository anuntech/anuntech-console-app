import { z } from "zod";
import { getActor, allowedIds } from "@/lib/access/access";
import { MAX_TICKET_BYTES } from "@/lib/tickets/ticket-files";
import { appendTicketUpload, discardTicketUpload, stageTicketUpload } from "@/lib/tickets/ticket-uploads";
import { sameOrigin } from "@/lib/http/same-origin";
import { logDatabaseFault } from "@/lib/action-errors";
export const maxDuration = 60;
const respond = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
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
    return respond({ id: await stageTicketUpload(actor.user.id, input) });
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
    await appendTicketUpload(actor.user.id, { id, offset, part: Buffer.concat(chunks) });
    return respond({ success: true });
  } catch (error) {
    return respond(
      { error: error instanceof Error && !logDatabaseFault("ticket uploads", error) ? error.message : "O envio do anexo falhou. Tente de novo." },
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
  if (id) await discardTicketUpload(actor.user.id, id);
  return respond({ success: true });
}
