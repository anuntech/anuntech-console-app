import { z } from "zod";
import type { UIMessage } from "ai";
import { TURN_PHASES } from "./activity";

/*
 * The assistant's wire format: an AI SDK UI message stream (SSE). The reply
 * streams as one text part; everything else travels as the data parts below,
 * so the route writes and the panel reads the same shapes, checked on both
 * ends. Tool calls and their results never reach the browser: the route
 * writes only these parts.
 */

/** What an answer (or a confirmed card) asks of the page; the panel carries it out. */
export const pageActionSchema = z.discriminatedUnion("type", [
  // Only a path of the Console itself: the panel navigates inside the app.
  z.object({ type: z.literal("navigate"), href: z.string().regex(/^\/(?![/\\])/) }),
  z.object({ type: z.literal("open_support") }),
  /** Only into the form the snapshot named; submitting goes through a confirmation card. */
  z.object({
    type: z.literal("fill"),
    form: z.string(),
    fields: z.array(z.object({ campo: z.string(), valor: z.string() })),
    submit: z.boolean(),
  }),
  /** One control marked data-assistant-action, by its exact text. */
  z.object({ type: z.literal("click"), text: z.string() }),
  /** Data behind the open screen changed (a tool wrote it); the page reloads its data. */
  z.object({ type: z.literal("refresh") }),
]);
export type PageAction = z.infer<typeof pageActionSchema>;

/** A change waiting for the person's click; the model never sees its id or nonce. */
export const proposalCardSchema = z.object({
  id: z.string().min(1),
  nonce: z.string().min(1),
  title: z.string(),
  details: z.array(z.object({ label: z.string(), value: z.string() })),
  /** Prepared after the turn read text written by someone else: the card says so. */
  tainted: z.boolean(),
  /** Screen actions apply only on this page. */
  path: z.string().nullable(),
  expiresAt: z.string(),
});
export type ProposalCard = z.infer<typeof proposalCardSchema>;

export const assistantDataSchemas = {
  /** Transient: where the turn is and the tokens spent so far (the orb and the clock row). */
  phase: z.object({ phase: z.enum(TURN_PHASES), tokens: z.number().nonnegative() }),
  /** What the tools did, as chips; rewritten in place (id "steps") while the turn works. */
  steps: z.array(z.string()),
  /** One part per card (id = the card's id), written once the answer is saved. */
  proposal: proposalCardSchema,
  /** Transient: applied when the answer ends, only refreshes when the panel is closed. */
  actions: z.array(pageActionSchema),
};

export const assistantMetadataSchema = z.object({
  /** The conversation the answer was saved in (null when saving failed). */
  conversationId: z.string().uuid().nullable().optional(),
  /** Model tokens the answer spent, every round. */
  tokens: z.number().nonnegative().optional(),
  /** A turn that did not finish, added by the panel itself: never sent by the server. */
  failed: z.boolean().optional(),
});

export type AssistantMetadata = z.infer<typeof assistantMetadataSchema>;
export type AssistantData = { [K in keyof typeof assistantDataSchemas]: z.infer<(typeof assistantDataSchemas)[K]> };
export type AssistantMessage = UIMessage<AssistantMetadata, AssistantData>;

/** The text of a message, its text parts in order. */
export function messageText(message: Pick<AssistantMessage, "parts"> | undefined) {
  return (message?.parts ?? []).map((part) => (part.type === "text" ? part.text : "")).join("");
}

/**
 * What the person reads when a turn could not even start: the route refuses
 * as plain JSON (`{ error }`) with its status, which the transport hands over
 * as the error's message.
 */
export function refusalText(body: string | undefined): string | null {
  if (!body) return null;
  try {
    const data = JSON.parse(body) as { error?: unknown };
    return typeof data?.error === "string" && data.error.trim() ? data.error : null;
  } catch {
    return null;
  }
}
