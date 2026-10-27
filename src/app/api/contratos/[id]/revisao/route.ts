import { eq } from "drizzle-orm";
import { contracts } from "@/db/schema";
import { db } from "@/lib/db";
import { getActor } from "@/lib/access/access";
import { sameOrigin } from "@/lib/http/same-origin";
import { reserveHourly } from "@/lib/http/hourly-limit";
import { reviewContractDraft } from "@/lib/contracts/contract-review-ai";
import { logDatabaseFault } from "@/lib/action-errors";

/*
 * "Revisar com IA" in a draft contract: points to improve before it goes out, on screen only
 * (nothing is saved). Staff only, 10 an hour per person.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return respond({ error: "O pedido foi recusado. Recarregue a página e tente de novo." }, 403);
  const actor = await getActor();
  if (!actor.admin) return respond({ error: "Acesso negado." }, 403);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return respond({ error: "Contrato não encontrado." }, 404);
  const [contract] = await db.select({ status: contracts.status }).from(contracts).where(eq(contracts.id, id));
  if (!contract) return respond({ error: "Contrato não encontrado." }, 404);
  if (contract.status !== "draft" && contract.status !== "in_review") return respond({ error: "Só um rascunho é revisado." }, 409);
  if (!(await reserveHourly("contract-ai-review", actor.user.id, 10)))
    return respond({ error: "Muitas revisões na última hora. Tente mais tarde." }, 429);
  try {
    return respond({ points: await reviewContractDraft(id, request.signal) });
  } catch (error) {
    return respond({ error: error instanceof Error && !logDatabaseFault("contract review", error) ? error.message : "Não foi possível revisar agora." }, 502);
  }
}
