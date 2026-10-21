import { appActor } from "@/lib/api/app-request";
import { assistantConversation, removeAssistantConversation } from "@/lib/assistant/assistant-http";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await appActor(request);
  if ("response" in caller) return caller.response;
  return assistantConversation(caller.actor, (await params).id);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await appActor(request);
  if ("response" in caller) return caller.response;
  return removeAssistantConversation(caller.actor, (await params).id);
}
