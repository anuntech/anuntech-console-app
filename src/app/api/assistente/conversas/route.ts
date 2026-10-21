import { getActor } from "@/lib/access/access";
import { assistantConversations } from "@/lib/assistant/assistant-http";
export const runtime = "nodejs";

/** The person's own conversations with the assistant, newest first. */
export async function GET() {
  return assistantConversations(await getActor());
}
