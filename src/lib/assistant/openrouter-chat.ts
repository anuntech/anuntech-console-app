import {
  AISDKError,
  APICallError,
  InvalidResponseDataError,
  JSONParseError,
  RetryError,
  StreamProviderError,
  TypeValidationError,
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { AssistantError, type ProviderFailure } from "./assistant-errors";

/** Client data only goes to providers that keep nothing and train on nothing. */
export const PRIVATE_PROVIDERS = { zdr: true, data_collection: "deny" } as const;

/**
 * What the model call of the round being streamed left behind, for the
 * turn: the calls whose arguments never became JSON (the provider would run
 * them with `{}`), and whether the model started a call the provider never
 * handed over (the output limit cut it mid-arguments).
 */
export type RoundState = { malformed: Set<string>; unfinished: boolean };
export const roundState = (): RoundState => ({ malformed: new Set(), unfinished: false });

/**
 * A chat model through OpenRouter, for the AI SDK. Never a bare model id: the
 * SDK would send that to the Vercel AI Gateway instead. Strict mode streams
 * the usage the daily budget counts, and every request asks for providers
 * that keep nothing. `round` is rewritten by every model call (see
 * `inModelOrder`).
 */
export function chatModel(model: string, reasoning: boolean, round: RoundState = roundState()) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AssistantError("O assistente ainda não foi ligado: falta a chave do OpenRouter nas variáveis do ambiente.");
  const openrouter = createOpenRouter({
    apiKey: key,
    compatibility: "strict",
    headers: { "HTTP-Referer": process.env.BETTER_AUTH_URL || "https://console.anuntech.com", "X-Title": "Anuntech Console" },
  });
  return wrapLanguageModel({
    model: openrouter.chat(model, {
      provider: PRIVATE_PROVIDERS,
      usage: { include: true },
      // Thinking models spend the output budget on reasoning first; keep it short so text remains.
      ...(reasoning ? { reasoning: { effort: "low" as const } } : {}),
    }),
    middleware: inModelOrder(round),
  });
}

type StreamPart = { type: string; [key: string]: unknown };
type ToolCallDelta = { index?: number | null; function?: { name?: string | null; arguments?: string | null } | null };

/**
 * Whether the provider takes this text as a call's arguments: JSON that,
 * like its own parser (secureJsonParse), holds no `__proto__` key and no
 * `constructor.prototype` at any depth.
 */
export function parsesLikeProvider(text: string) {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return false;
  }
  const own = (node: object, key: string) => Object.prototype.hasOwnProperty.call(node, key);
  for (let next = [value]; next.length; ) {
    const nodes = next;
    next = [];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      if (own(node, "__proto__")) return false;
      const ctor = (node as { constructor?: unknown }).constructor;
      if (own(node, "constructor") && ctor && typeof ctor === "object" && own(ctor, "prototype")) return false;
      next.push(...Object.values(node));
    }
  }
  return true;
}

/**
 * Hands a round's tool calls to the SDK in the order the model wrote them
 * (OpenRouter's `index`), which is the order they run in. The provider
 * emits a call as soon as its arguments parse, so a call whose arguments
 * come last, or never parse, would otherwise run after the calls written
 * after it. It also reports, in `round`, the calls whose arguments never
 * parsed (the provider sends them as `{}`) and a call the model started but
 * the provider never handed over; both describe this model call only.
 *
 * Each call is known by the id the provider gives it, which is not always
 * the model's (a missing or repeated id gets a new one), so the index is
 * bound when the provider opens the call (`tool-input-start`), following
 * the provider's own rule for when that happens.
 */
export function inModelOrder(round: RoundState): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    // The raw chunks carry each call's index; they are read here and never passed on.
    transformParams: async ({ params }) => ({ ...params, includeRawChunks: true }),
    wrapStream: async ({ doStream }) => {
      round.malformed.clear();
      round.unfinished = false;
      const { stream, ...rest } = await doStream();
      // By index, as the provider keeps them: the arguments so far, whether it opened the call and whether it
      // handed the call over while streaming (its arguments parsed at some point).
      const calls = new Map<number, { args: string; named: boolean; opened: boolean; sent: boolean; id?: string }>();
      // Calls the provider opens next, in the order it will open them.
      const opening: number[] = [];
      const indexOf = new Map<string, number>();
      let held: StreamPart[] = [];
      const read = (raw: unknown) => {
        const deltas = (raw as { choices?: { delta?: { tool_calls?: ToolCallDelta[] | null } | null }[] } | null)?.choices?.[0]?.delta?.tool_calls ?? [];
        for (const delta of deltas) {
          // The provider's default: the last call so far (-1 before any).
          const index = delta.index ?? (calls.size ? Math.max(...calls.keys()) : -1);
          const piece = delta.function?.arguments ?? "";
          const call = calls.get(index);
          if (!call) {
            // A new call opens (and goes out) at once only when its arguments already parse.
            const named = delta.function?.name != null;
            const ready = named && parsesLikeProvider(piece);
            calls.set(index, { args: piece, named, opened: ready, sent: ready });
            if (ready) opening.push(index);
          } else {
            if (!call.opened) {
              call.opened = true;
              opening.push(index);
            }
            call.args += piece;
            if (!call.sent && call.named && parsesLikeProvider(call.args)) call.sent = true;
          }
        }
      };
      // A call opened without a delta of its own is one the provider opens at the end, lowest index first.
      const bind = (id: string) => {
        const index =
          opening.shift() ??
          [...calls.entries()]
            .filter(([key, c]) => key >= 0 && c.id === undefined && !c.opened)
            .sort(([a], [b]) => a - b)[0]?.[0];
        if (index === undefined) return;
        const call = calls.get(index)!;
        call.id = id;
        call.opened = true;
        indexOf.set(id, index);
      };
      const release = (controller: TransformStreamDefaultController<StreamPart>) => {
        // The model started more calls than the provider handed over: one was cut before its arguments closed.
        if (calls.size > held.length) round.unfinished = true;
        const order = (part: StreamPart) => indexOf.get(String(part.toolCallId)) ?? Number.MAX_SAFE_INTEGER;
        for (const part of [...held].sort((a, b) => order(a) - order(b))) {
          const index = indexOf.get(String(part.toolCallId));
          const call = index === undefined ? undefined : calls.get(index);
          // Never handed over while streaming, and what the model wrote is not JSON: the provider sent `{}`.
          if (call && !call.sent && call.args.trim() && !parsesLikeProvider(call.args)) round.malformed.add(String(part.toolCallId));
          controller.enqueue(part);
        }
        held = [];
      };
      return {
        ...rest,
        stream: (stream as ReadableStream<StreamPart>).pipeThrough(
          new TransformStream<StreamPart, StreamPart>({
            transform(part, controller) {
              if (part.type === "raw") return read(part.rawValue);
              if (part.type === "tool-input-start") bind(String(part.id));
              if (part.type === "tool-call") {
                held.push(part);
                return;
              }
              if (part.type === "finish") release(controller);
              controller.enqueue(part);
            },
            flush(controller) {
              if (held.length) release(controller);
            },
          }),
        ) as typeof stream,
      };
    },
  };
}

/** A stream OpenRouter sent that could not be read: its content never goes into a log. */
const UNREADABLE = "resposta ilegível do provedor";

/** How a model call failed, from what the AI SDK reports; null for anything else (a bug, a database fault). */
export function providerFailure(error: unknown): ProviderFailure | null {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(cause)) return { status: cause.statusCode, detail: cause.message };
  // A failure after the stream started: OpenRouter's own { code, message }, as the SDK reads it.
  if (StreamProviderError.isInstance(cause)) {
    const code = Number(cause.statusCode ?? cause.code);
    return { status: Number.isInteger(code) ? code : undefined, detail: cause.message };
  }
  // These carry the unreadable piece itself, which can quote the model's answer.
  if (TypeValidationError.isInstance(cause) || JSONParseError.isInstance(cause) || InvalidResponseDataError.isInstance(cause)) return { detail: UNREADABLE };
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) return { detail: cause.message, timeout: true };
  // The same as above, when it arrives as the bare object.
  if (cause && typeof cause === "object" && !(cause instanceof Error) && "message" in cause) {
    const code = Number((cause as { code?: unknown }).code);
    return { status: Number.isInteger(code) ? code : undefined, detail: String((cause as { message: unknown }).message ?? "") };
  }
  return null;
}

/** Whether an error came from the AI SDK itself; its message may hold the request or the answer. */
export const sdkError = (error: unknown) => AISDKError.isInstance(error);
