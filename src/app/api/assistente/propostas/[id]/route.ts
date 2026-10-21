import { getActor } from "@/lib/access/access";
import { decideAssistantProposal } from "@/lib/assistant/assistant-http";
import { isJson, sameOrigin } from "@/lib/http/same-origin";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The person's click on a confirmation card (lib/assistant/assistant-http.ts).
 * Same origin and JSON: only the Console's panel may ask.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request) || !isJson(request)) return Response.json({ error: "Pedido recusado." }, { status: 403 });
  return decideAssistantProposal(await getActor(), (await params).id, request);
}
