import { z } from "zod";
import { getActor } from "@/lib/access";
import { allowRequest, AssistantError, converse, type ChatTurn } from "@/lib/assistant";
import { pageSnapshotSchema } from "@/lib/page-snapshot";
import { appendExchange } from "@/lib/assistant-history";
export const runtime = "nodejs";
export const maxDuration = 120;

const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20000) }))
    .min(1)
    .max(60),
  page: pageSnapshotSchema.optional(),
  conversationId: z.string().uuid().optional(),
});

/** One conversational turn; the caller's own session scopes every tool. */
export async function POST(request: Request) {
  const actor = await getActor();
  if (!allowRequest(actor.user.id))
    return Response.json({ error: "Muitas mensagens em pouco tempo. Espere alguns minutos e tente de novo." }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagem inválida." }, { status: 400 });
  const history = parsed.data.messages as ChatTurn[];
  if (history[history.length - 1].role !== "user") return Response.json({ error: "A última mensagem precisa ser sua." }, { status: 400 });
  try {
    const reply = await converse(actor, history, parsed.data.page);
    const conversationId = await appendExchange(actor.user.id, parsed.data.conversationId ?? null, history[history.length - 1].content, reply).catch((error) => {
      console.warn("[assistant] history not saved", error instanceof Error ? error.message : error);
      return parsed.data.conversationId ?? null;
    });
    return Response.json({ ...reply, conversationId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AssistantError) return Response.json({ error: error.message }, { status: 503 });
    console.error("[assistant] turn failed", error);
    return Response.json({ error: "O assistente falhou nesta resposta. Tente de novo em instantes." }, { status: 500 });
  }
}
