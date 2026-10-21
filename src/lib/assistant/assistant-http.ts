import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import type { Actor } from "../access/access";
import { AssistantError, converse, HOURLY_MESSAGES, type ChatTurn } from "./assistant";
import { readActions, readCard, type AssistantMessage } from "./assistant-stream";
import { sdkError } from "./chat-model";
import { pageSnapshotSchema } from "./page-snapshot";
import { appendExchange, conversationMessages, conversationTurns, deleteConversation, listConversations } from "./assistant-history";
import { attachProposals, confirmProposal, dismissProposal } from "./assistant-proposals";
import { reserveTurn, spendTokens } from "./assistant-budget";
import { reserveHourly } from "../http/hourly-limit";
import { logDatabaseFault } from "../action-errors";

/*
 * What the assistant's routes do once the caller is known: the web's
 * /api/assistente (same origin, getActor) and the app's /api/v1/assistente
 * (session cookie, no assisted access) check the request their own way and
 * then call these, so the assistant behaves the same in both.
 */

/**
 * A message, the screen and the history's id; the history itself comes from
 * the database. Anything else (a `messages` array, a tool result, an approval)
 * is refused: the client never writes the conversation.
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
 * Earlier turns are read from the conversation the person owns, never from
 * what the client sends. Besides the hourly limit, the day's budget (tokens
 * per person and per company, messages per company) can refuse the message,
 * and each round's tokens are counted as they come. Refusals before the turn
 * starts are plain JSON with their status; the turn itself is an AI SDK UI
 * message stream (assistant-stream.ts): the reply as one text part, the
 * progress, chips, cards and page actions as data parts, and the
 * conversation's id and the tokens in the closing metadata. Tool calls and
 * their results stay on the server.
 */
export async function assistantTurn(actor: Actor, request: Request) {
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
        // A database error's message is the SQL plus its parameters (the person's words, the reply): only the fault is logged.
        const conversationId = await appendExchange(actor.user.id, parsed.data.conversationId ?? null, message, reply).catch((error) => {
          if (!logDatabaseFault("assistant history", error)) console.warn("[assistant] history not saved", error instanceof Error ? error.name : typeof error);
          return parsed.data.conversationId ?? null;
        });
        if (conversationId)
          await attachProposals(actor.user.id, reply.proposals.map((p) => p.id), conversationId).catch((error) => {
            if (!logDatabaseFault("assistant proposals", error)) console.warn("[assistant] proposals not linked", error instanceof Error ? error.name : typeof error);
          });
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

/** The person's own conversations, newest first. */
export async function assistantConversations(actor: Actor) {
  return Response.json({ conversations: await listConversations(actor.user.id) }, { headers: { "Cache-Control": "no-store" } });
}

const conversationId = z.string().uuid();

/** One conversation with its messages; only the person who had it can read it. */
export async function assistantConversation(actor: Actor, id: string) {
  const parsed = conversationId.safeParse(id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const conversation = await conversationMessages(actor.user.id, parsed.data);
  if (!conversation) return new Response(null, { status: 404 });
  return Response.json(conversation, { headers: { "Cache-Control": "no-store" } });
}

export async function removeAssistantConversation(actor: Actor, id: string) {
  const parsed = conversationId.safeParse(id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const removed = await deleteConversation(actor.user.id, parsed.data);
  return new Response(null, { status: removed ? 204 : 404 });
}

const decision = z.object({ nonce: z.string().min(20).max(100), decisao: z.enum(["confirmar", "descartar"]) });

/**
 * The person's click on a confirmation card: the only way an assistant write
 * runs. The nonce only that client received, before it expires, once; the
 * tool then checks the person's access again.
 */
export async function decideAssistantProposal(actor: Actor, id: string, request: Request) {
  const proposal = conversationId.safeParse(id);
  const parsed = decision.safeParse(await request.json().catch(() => null));
  if (!proposal.success || !parsed.success) return Response.json({ error: "Confirmação inválida." }, { status: 400 });
  if (!(await reserveHourly("assistant-confirm", actor.user.id, 120)))
    return Response.json({ error: "Muitas confirmações nesta hora. Espere um pouco e tente de novo." }, { status: 429 });
  if (parsed.data.decisao === "descartar") {
    const dismissed = await dismissProposal(actor, proposal.data, parsed.data.nonce);
    return dismissed ? new Response(null, { status: 204 }) : Response.json({ error: "Esta confirmação não está mais pendente." }, { status: 409 });
  }
  const outcome = await confirmProposal(actor, proposal.data, parsed.data.nonce);
  if (!outcome.ok) return Response.json({ error: outcome.error }, { status: outcome.status, headers: { "Cache-Control": "no-store" } });
  return Response.json({ summary: outcome.summary, actions: outcome.actions }, { headers: { "Cache-Control": "no-store" } });
}
