import { z } from "zod";
import { getActor } from "@/lib/access/access";
import { conversationMessages, deleteConversation } from "@/lib/assistant/assistant-history";
export const runtime = "nodejs";

const id = z.string().uuid();

/** One conversation with its messages; only the person who had it can read it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const parsed = id.safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const conversation = await conversationMessages(actor.user.id, parsed.data);
  if (!conversation) return new Response(null, { status: 404 });
  return Response.json(conversation, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const parsed = id.safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const removed = await deleteConversation(actor.user.id, parsed.data);
  return new Response(null, { status: removed ? 204 : 404 });
}
