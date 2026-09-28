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

/**
 * One conversational turn; the caller's own session scopes every tool.
 * The answer streams as NDJSON: `progress` lines with the tokens spent so far,
 * then one `done` line with the reply (or `error`). Refusals before the turn
 * starts stay plain JSON with their status.
 */
export async function POST(request: Request) {
  const actor = await getActor();
  if (!allowRequest(actor.user.id))
    return Response.json({ error: "Muitas mensagens em pouco tempo. Espere alguns minutos e tente de novo." }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Não foi possível ler a mensagem. Envie de novo." }, { status: 400 });
  const history = parsed.data.messages as ChatTurn[];
  if (history[history.length - 1].role !== "user") return Response.json({ error: "A última mensagem precisa ser sua." }, { status: 400 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The panel may be gone (tab closed); the turn still finishes and is saved.
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          /* reader went away */
        }
      };
      try {
        const reply = await converse(actor, history, parsed.data.page, (progress) => send({ type: "progress", ...progress }));
        const conversationId = await appendExchange(actor.user.id, parsed.data.conversationId ?? null, history[history.length - 1].content, reply).catch((error) => {
          console.warn("[assistant] history not saved", error instanceof Error ? error.message : error);
          return parsed.data.conversationId ?? null;
        });
        send({ type: "done", ...reply, conversationId });
      } catch (error) {
        if (!(error instanceof AssistantError)) console.error("[assistant] turn failed", error);
        send({
          type: "error",
          error: error instanceof AssistantError ? error.message : "O assistente falhou nesta resposta. Tente de novo em instantes.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
