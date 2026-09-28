import { getActor } from "@/lib/access/access";
import { listConversations } from "@/lib/assistant/assistant-history";
export const runtime = "nodejs";

/** The person's own conversations with the assistant, newest first. */
export async function GET() {
  const actor = await getActor();
  return Response.json({ conversations: await listConversations(actor.user.id) }, { headers: { "Cache-Control": "no-store" } });
}
