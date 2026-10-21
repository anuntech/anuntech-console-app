import { appActor } from "@/lib/api/app-request";
import { assistantTurn } from "@/lib/assistant/assistant-http";
export const runtime = "nodejs";
export const maxDuration = 120;

/** The app's turn with the assistant: the same as /api/assistente, with the app's session. */
export async function POST(request: Request) {
  const caller = await appActor(request, { json: true });
  if ("response" in caller) return caller.response;
  return assistantTurn(caller.actor, request);
}
