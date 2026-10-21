import { appActor } from "@/lib/api/app-request";
import { assistantConversations } from "@/lib/assistant/assistant-http";
export const runtime = "nodejs";

/** The person's own conversations, for the app. */
export async function GET(request: Request) {
  const caller = await appActor(request);
  if ("response" in caller) return caller.response;
  return assistantConversations(caller.actor);
}
