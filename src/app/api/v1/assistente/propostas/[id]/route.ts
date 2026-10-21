import { appActor } from "@/lib/api/app-request";
import { decideAssistantProposal } from "@/lib/assistant/assistant-http";
export const runtime = "nodejs";
export const maxDuration = 60;

/** A confirmation card decided in the app: the same rules as the web's panel. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await appActor(request, { json: true });
  if ("response" in caller) return caller.response;
  return decideAssistantProposal(caller.actor, (await params).id, request);
}
