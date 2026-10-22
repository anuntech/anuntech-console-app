import { fetch as streamingFetch } from "expo/fetch";
import { sessionHeaders } from "./api";
import { CONSOLE_URL } from "./config";

/*
 * The assistant's routes on the Console (/api/v1/assistente/**). The turn is
 * an AI SDK UI message stream (server-sent events); expo/fetch reads it as it
 * arrives. The shapes mirror src/lib/assistant/assistant-stream.ts.
 */

export type Card = {
  id: string;
  nonce: string;
  title: string;
  details: { label: string; value: string }[];
  tainted: boolean;
  path: string | null;
  expiresAt: string;
};
export type PageAction = { type: "navigate"; href: string } | { type: "open_support" } | { type: string };
export type Conversation = { id: string; title: string; updatedAt: string; messages: number };
export type StoredMessage = { id: string; role: "user" | "assistant"; content: string; steps?: string[] };

const base = `${CONSOLE_URL}/api/v1/assistente`;
const fallback = "Não foi possível falar com o assistente. Confira a internet e tente de novo.";

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  return fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    credentials: "omit",
    headers: {
      ...(await sessionHeaders()),
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

/** The Console's sentence for a refusal, or a generic one. */
async function refusal(response: { json: () => Promise<unknown> }) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export async function listConversations(): Promise<Conversation[]> {
  const response = await call("/conversas");
  if (!response.ok) throw new Error(await refusal(response));
  return ((await response.json()) as { conversations: Conversation[] }).conversations;
}

export async function loadConversation(id: string): Promise<{ id: string; title: string; messages: StoredMessage[] }> {
  const response = await call(`/conversas/${id}`);
  if (!response.ok) throw new Error(response.status === 404 ? "Esta conversa não existe mais." : fallback);
  return response.json();
}

export async function removeConversation(id: string) {
  const response = await call(`/conversas/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(fallback);
}

/** The person's tap on a confirmation card: the only way an assistant change runs. */
export async function decideCard(card: Card, decision: "confirmar" | "descartar") {
  const response = await call(`/propostas/${card.id}`, { method: "POST", body: { nonce: card.nonce, decisao: decision } });
  if (!response.ok) throw new Error(await refusal(response));
  if (response.status === 204) return { summary: null as string | null, actions: [] as PageAction[] };
  const body = (await response.json()) as { summary?: string; actions?: PageAction[] };
  return { summary: body.summary ?? null, actions: body.actions ?? [] };
}

export type TurnEvents = {
  text: (delta: string) => void;
  steps: (steps: string[]) => void;
  phase: (phase: string) => void;
  card: (card: Card) => void;
  actions: (actions: PageAction[]) => void;
  finish: (meta: { conversationId?: string | null }) => void;
};

/** One turn: the message goes out, the answer comes back piece by piece. */
export async function sendTurn(
  input: { message: string; conversationId?: string },
  on: TurnEvents,
  signal?: AbortSignal,
) {
  const response = await streamingFetch(base, {
    method: "POST",
    credentials: "omit",
    headers: { ...(await sessionHeaders()), "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(await refusal(response));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Events end with a blank line; each carries one "data: {json}" line.
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const event = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        let part: { type?: string; delta?: string; data?: unknown; errorText?: string; messageMetadata?: { conversationId?: string | null } };
        try {
          part = JSON.parse(raw);
        } catch {
          continue;
        }
        if (part.type === "text-delta" && typeof part.delta === "string") on.text(part.delta);
        else if (part.type === "data-steps" && Array.isArray(part.data)) on.steps(part.data as string[]);
        else if (part.type === "data-phase") on.phase((part.data as { phase?: string })?.phase ?? "");
        else if (part.type === "data-proposal" && part.data) on.card(part.data as Card);
        else if (part.type === "data-actions" && Array.isArray(part.data)) on.actions(part.data as PageAction[]);
        else if (part.type === "error") throw new Error(part.errorText || fallback);
        else if (part.type === "finish") on.finish(part.messageMetadata ?? {});
      }
    }
  }
}
