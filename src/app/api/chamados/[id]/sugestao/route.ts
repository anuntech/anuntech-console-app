import { getActor } from "@/lib/access/access";
import { sameOrigin } from "@/lib/http/same-origin";
import { reserveHourly } from "@/lib/http/hourly-limit";
import { draftTicketReply } from "@/lib/assistant/draft-reply";
import { logDatabaseFault } from "@/lib/action-errors";

/*
 * "Sugerir resposta" in a ticket: the team gets a draft in the reply box and
 * sends it themselves. Staff only, 30 an hour per person.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return respond({ error: "O pedido foi recusado. Recarregue a página e tente de novo." }, 403);
  const actor = await getActor();
  if (!actor.admin) return respond({ error: "Acesso negado." }, 403);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return respond({ error: "Chamado não encontrado." }, 404);
  if (!(await reserveHourly("reply-draft", actor.user.id, 30)))
    return respond({ error: "Muitas sugestões na última hora. Escreva a resposta ou tente mais tarde." }, 429);
  try {
    return respond({ text: await draftTicketReply(id) });
  } catch (error) {
    return respond({ error: error instanceof Error && !logDatabaseFault("reply draft", error) ? error.message : "Não foi possível sugerir agora." }, 502);
  }
}
