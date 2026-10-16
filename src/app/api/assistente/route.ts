import { z } from "zod";
import { getActor } from "@/lib/access/access";
import { AssistantError, converse, HOURLY_MESSAGES, type ChatTurn } from "@/lib/assistant/assistant";
import { pageSnapshotSchema } from "@/lib/assistant/page-snapshot";
import { appendExchange, conversationTurns } from "@/lib/assistant/assistant-history";
import { attachProposals } from "@/lib/assistant/assistant-proposals";
import { reserveHourly } from "@/lib/http/hourly-limit";
import { isJson, sameOrigin } from "@/lib/http/same-origin";
export const runtime = "nodejs";
export const maxDuration = 120;

/** A message, the screen and the history's id; the history itself comes from the database. */
const MAX_BODY_CHARS = 120_000;
const body = z.object({
  message: z.string().trim().min(1).max(20000),
  page: z.unknown().optional(),
  conversationId: z.string().uuid().optional(),
});

/**
 * One conversational turn; the caller's own session scopes every tool.
 * Only the Console itself may ask (Origin and a JSON body: a form from another
 * site can do neither), and earlier turns are read from the conversation the
 * person owns, never from what the browser sends.
 * The answer streams as NDJSON: `progress` lines with the tokens spent so far,
 * then one `done` line with the reply (or `error`). Refusals before the turn
 * starts stay plain JSON with their status.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request) || !isJson(request)) return Response.json({ error: "Pedido recusado." }, { status: 403 });
  const actor = await getActor();
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return Response.json({ error: "A mensagem ficou grande demais. Envie em partes." }, { status: 413 });
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Não foi possível ler a mensagem. Envie de novo." }, { status: 400 });
  if (!(await reserveHourly("assistant", actor.user.id, HOURLY_MESSAGES)))
    return Response.json({ error: "Muitas mensagens nesta hora. Espere um pouco e tente de novo." }, { status: 429 });
  // Reading the screen is a bonus: a snapshot that does not fit is dropped, the message still goes.
  const screen = parsed.data.page === undefined ? null : pageSnapshotSchema.safeParse(parsed.data.page);
  if (screen && !screen.success) console.warn("[assistant] screen snapshot refused", screen.error.issues.slice(0, 3));
  const page = screen?.success ? screen.data : undefined;
  const earlier = parsed.data.conversationId ? await conversationTurns(actor.user.id, parsed.data.conversationId) : [];
  const message = parsed.data.message;
  const history: ChatTurn[] = [...earlier, { role: "user", content: message }];
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
        const reply = await converse(actor, history, page, (progress) => send({ type: "progress", ...progress }));
        const conversationId = await appendExchange(actor.user.id, parsed.data.conversationId ?? null, message, reply).catch((error) => {
          console.warn("[assistant] history not saved", error instanceof Error ? error.message : error);
          return parsed.data.conversationId ?? null;
        });
        if (conversationId)
          await attachProposals(actor.user.id, reply.proposals.map((p) => p.id), conversationId).catch((error) =>
            console.warn("[assistant] proposals not linked", error instanceof Error ? error.message : error),
          );
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
