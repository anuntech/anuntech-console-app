import { getActor } from "@/lib/access/access";
import { assistantTurn } from "@/lib/assistant/assistant-http";
import { isJson, sameOrigin } from "@/lib/http/same-origin";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * One turn with the assistant (lib/assistant/assistant-http.ts). Only the
 * Console itself may ask: Origin and a JSON body, which a form from another
 * site can do neither of.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request) || !isJson(request)) return Response.json({ error: "Pedido recusado." }, { status: 403 });
  return assistantTurn(await getActor(), request);
}
