import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { getActor } from "@/lib/access/access";
import { AssistantError, converse, HOURLY_MESSAGES, type ChatTurn } from "@/lib/assistant/assistant";
import { readActions, readCard, type AssistantMessage } from "@/lib/assistant/assistant-stream";
import { sdkError } from "@/lib/assistant/chat-model";
import { pageSnapshotSchema } from "@/lib/assistant/page-snapshot";
import { appendExchange, conversationTurns } from "@/lib/assistant/assistant-history";
import { attachProposals } from "@/lib/assistant/assistant-proposals";
import { reserveTurn, spendTokens } from "@/lib/assistant/assistant-budget";
import { reserveHourly } from "@/lib/http/hourly-limit";
import { isJson, sameOrigin } from "@/lib/http/same-origin";
import { logDatabaseFault } from "@/lib/action-errors";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * A message, the screen and the history's id; the history itself comes from
 * the database. Anything else (a `messages` array, a tool result, an approval)
 * is refused: the browser never writes the conversation.
 */
const MAX_BODY_CHARS = 120_000;
const body = z
  .object({
    message: z.string().trim().min(1).max(20000),
    page: z.unknown().optional(),
    conversationId: z.string().uuid().optional(),
  })
  .strict();

/**
 * One conversational turn; the caller's own session scopes every tool.
 * Only the Console itself may ask (Origin and a JSON body: a form from another
 * site can do neither), and earlier turns are read from the conversation the
 * person owns, never from what the browser sends. Besides the hourly limit,
 * the day's budget (tokens per person and per company, messages per company)
 * can refuse the message, and each round's tokens are counted as they come.
 * Refusals before the turn starts are plain JSON with their status; the turn
 * itself is an AI SDK UI message stream (assistant-stream.ts): the reply as
 * one text part, the progress, chips, cards and page actions as data parts,
 * and the conversation's id and the tokens in the closing metadata. Tool
 * calls and their results stay on the server.
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
  const turn = await reserveTurn(actor);
  if ("error" in turn) return Response.json({ error: turn.error }, { status: 429 });
  // Reading the screen is a bonus: a snapshot that does not fit is dropped, the message still goes.
  const screen = parsed.data.page === undefined ? null : pageSnapshotSchema.safeParse(parsed.data.page);
  if (screen && !screen.success) console.warn("[assistant] screen snapshot refused", screen.error.issues.slice(0, 3));
  const page = screen?.success ? screen.data : undefined;
  const earlier = parsed.data.conversationId ? await conversationTurns(actor.user.id, parsed.data.conversationId) : [];
  const message = parsed.data.message;
  const history: ChatTurn[] = [...earlier, { role: "user", content: message }];

  // The panel may be gone (tab closed): the turn still finishes and is saved, and the function stays up for it.
  let settle = () => {};
  const settled = new Promise<void>((resolve) => (settle = resolve));
  after(() => settled);
  const stream = createUIMessageStream<AssistantMessage>({
    execute: async ({ writer }) => {
      try {
        writer.write({ type: "start" });
        // The reply is one text part, opened with its first piece.
        const textId = randomUUID();
        let writing = false;
        const reply = await converse(
          actor,
          history,
          page,
          {
            progress: (progress) => writer.write({ type: "data-phase", data: progress, transient: true }),
            text: (delta) => {
              if (!writing) writer.write({ type: "text-start", id: textId });
              writing = true;
              writer.write({ type: "text-delta", id: textId, delta });
            },
            steps: (steps) => writer.write({ type: "data-steps", id: "steps", data: steps }),
          },
          (tokens) => spendTokens(turn.budget, tokens),
        );
        if (writing) writer.write({ type: "text-end", id: textId });
        const conversationId = await appendExchange(actor.user.id, parsed.data.conversationId ?? null, message, reply).catch((error) => {
          console.warn("[assistant] history not saved", error instanceof Error ? error.message : error);
          return parsed.data.conversationId ?? null;
        });
        if (conversationId)
          await attachProposals(actor.user.id, reply.proposals.map((p) => p.id), conversationId).catch((error) =>
            console.warn("[assistant] proposals not linked", error instanceof Error ? error.message : error),
          );
        if (reply.steps.length) writer.write({ type: "data-steps", id: "steps", data: reply.steps });
        // Only what the panel's schemas accept leaves the server (a navigation outside the Console never does).
        for (const card of reply.proposals) {
          const checked = readCard(card);
          if (checked) writer.write({ type: "data-proposal", id: checked.id, data: checked });
          else console.error("[assistant] card left out: not a valid card", { id: card.id });
        }
        const actions = readActions(reply.actions);
        if (actions.length < reply.actions.length) console.error("[assistant] page actions left out", { sent: actions.length, of: reply.actions.length });
        if (actions.length) writer.write({ type: "data-actions", data: actions, transient: true });
        writer.write({ type: "finish", finishReason: "stop", messageMetadata: { conversationId, ...(reply.tokens !== undefined ? { tokens: reply.tokens } : {}) } });
      } finally {
        settle();
      }
    },
    // A failed turn saves nothing; the person reads what went wrong and the next step.
    onError: (error) => {
      if (error instanceof AssistantError) return error.message;
      // An AI SDK error may carry the request or the answer in its message: only its name is logged.
      if (sdkError(error)) console.error("[assistant] turn failed", { name: (error as Error).name });
      else if (!logDatabaseFault("assistant turn", error)) console.error("[assistant] turn failed", error);
      return "O assistente falhou nesta resposta. Tente de novo em instantes.";
    },
  });
  return createUIMessageStreamResponse({ stream, headers: { "Cache-Control": "no-store" } });
}
