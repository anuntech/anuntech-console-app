import { z } from "zod";
import { getActor } from "@/lib/access/access";
import { confirmProposal, dismissProposal } from "@/lib/assistant/assistant-proposals";
import { reserveHourly } from "@/lib/http/hourly-limit";
import { isJson, sameOrigin } from "@/lib/http/same-origin";
export const runtime = "nodejs";
export const maxDuration = 60;

const id = z.string().uuid();
const body = z.object({ nonce: z.string().min(20).max(100), decisao: z.enum(["confirmar", "descartar"]) });

/**
 * The person's click on a confirmation card: the only way an assistant write
 * runs. Same origin, JSON, the nonce only that panel received, before it
 * expires, once; the tool then checks the person's access again.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || !isJson(request)) return Response.json({ error: "Pedido recusado." }, { status: 403 });
  const actor = await getActor();
  const proposal = id.safeParse((await params).id);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!proposal.success || !parsed.success) return Response.json({ error: "Confirmação inválida." }, { status: 400 });
  if (!(await reserveHourly("assistant-confirm", actor.user.id, 120)))
    return Response.json({ error: "Muitas confirmações nesta hora. Espere um pouco e tente de novo." }, { status: 429 });
  if (parsed.data.decisao === "descartar") {
    const dismissed = await dismissProposal(actor, proposal.data, parsed.data.nonce);
    return dismissed ? new Response(null, { status: 204 }) : Response.json({ error: "Esta confirmação não está mais pendente." }, { status: 409 });
  }
  const outcome = await confirmProposal(actor, proposal.data, parsed.data.nonce);
  if (!outcome.ok) return Response.json({ error: outcome.error }, { status: outcome.status, headers: { "Cache-Control": "no-store" } });
  return Response.json({ summary: outcome.summary, actions: outcome.actions }, { headers: { "Cache-Control": "no-store" } });
}
