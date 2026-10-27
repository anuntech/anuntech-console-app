import { eq } from "drizzle-orm";
import { contracts } from "@/db/schema";
import { db } from "@/lib/db";
import { getActor } from "@/lib/access/access";
import { sameOrigin } from "@/lib/http/same-origin";
import { reserveHourly } from "@/lib/http/hourly-limit";
import { contractFields } from "@/lib/contracts/contract-fields";
import { contractFieldSuggestions } from "@/lib/contracts/contract-suggestions";
import { draftContractFields } from "@/lib/contracts/contract-field-ai";
import { logDatabaseFault } from "@/lib/action-errors";

/*
 * "Preencher com IA" in a draft contract: suggestions for the project's open fields, into the
 * fields panel only (nothing is saved). Staff only, 20 an hour per person.
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
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
  if (!contract) return respond({ error: "Contrato não encontrado." }, 404);
  if (contract.status !== "draft" && contract.status !== "in_review") return respond({ error: "Só um rascunho recebe sugestões." }, 409);
  const keys = contractFields(contract.body).map((field) => field.key);
  if (!keys.length) return respond({ suggestions: {}, gaps: [] });
  if (!(await reserveHourly("contract-fields", actor.user.id, 20)))
    return respond({ error: "Muitas sugestões na última hora. Preencha à mão ou tente mais tarde." }, 429);
  try {
    const known = await contractFieldSuggestions(contract, { name: actor.user.name, email: actor.user.email }, keys);
    return respond(await draftContractFields(id, known, request.signal));
  } catch (error) {
    return respond({ error: error instanceof Error && !logDatabaseFault("contract fields", error) ? error.message : "Não foi possível sugerir agora." }, 502);
  }
}
