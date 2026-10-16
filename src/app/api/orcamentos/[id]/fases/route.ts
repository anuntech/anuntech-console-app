import { eq } from "drizzle-orm";
import { quotes } from "@/db/schema";
import { db } from "@/lib/db";
import { getActor } from "@/lib/access/access";
import { sameOrigin } from "@/lib/http/same-origin";
import { reserveHourly } from "@/lib/http/hourly-limit";
import { draftQuotePhases } from "@/lib/assistant/draft-phases";
import { logDatabaseFault } from "@/lib/action-errors";

/*
 * "Sugerir fases" on a draft proposal: phases, hours and tasks from the
 * client's request, into the editor only. Staff only, 20 an hour per person.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return respond({ error: "O pedido foi recusado. Recarregue a página e tente de novo." }, 403);
  const actor = await getActor();
  if (!actor.admin) return respond({ error: "Acesso negado." }, 403);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return respond({ error: "Orçamento não encontrado." }, 404);
  const [quote] = await db.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, id));
  if (!quote || quote.status !== "draft") return respond({ error: "Só um rascunho recebe sugestão de fases." }, 409);
  const body = (await request.json().catch(() => null)) as { title?: unknown; summary?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  if (summary.length < 20) return respond({ error: "Escreva o resumo do pedido antes: as fases saem dele." }, 400);
  if (!(await reserveHourly("quote-phases", actor.user.id, 20)))
    return respond({ error: "Muitas sugestões na última hora. Monte as fases à mão ou tente mais tarde." }, 429);
  try {
    return respond(await draftQuotePhases({ title, summary }));
  } catch (error) {
    return respond({ error: error instanceof Error && !logDatabaseFault("quote phases", error) ? error.message : "Não foi possível sugerir agora." }, 502);
  }
}
