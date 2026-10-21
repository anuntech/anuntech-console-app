import { getActor } from "@/lib/access/access";
import { assistantConversation, removeAssistantConversation } from "@/lib/assistant/assistant-http";
import { sameOrigin } from "@/lib/http/same-origin";
export const runtime = "nodejs";

/** One conversation with its messages; only the person who had it can read it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return assistantConversation(await getActor(), (await params).id);
}

/** Deleting is a change: only the Console itself may ask. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  return removeAssistantConversation(await getActor(), (await params).id);
}
