import {
  AISDKError,
  APICallError,
  gateway,
  InvalidResponseDataError,
  JSONParseError,
  RetryError,
  StreamProviderError,
  TypeValidationError,
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from "ai";
import { GatewayError, GatewayResponseError } from "@ai-sdk/gateway";
import { gatewayReady, PRIVATE_GATEWAY } from "../ai/gateway-env";
import { AssistantError, type ProviderFailure } from "./assistant-errors";

/**
 * What the model call of the round being streamed left behind, for the
 * turn: the calls whose arguments never became JSON (they reach the tools
 * as `{}`, to be refused), and whether the model started a call it never
 * finished (the output limit cut it mid-arguments).
 */
export type RoundState = { malformed: Set<string>; unfinished: boolean };
export const roundState = (): RoundState => ({ malformed: new Set(), unfinished: false });

/** Says the Gateway is not configured, in the words the person reads. */
export function assertGateway() {
  if (!gatewayReady()) throw new AssistantError("A IA ainda não foi ligada: falta configurar o AI Gateway da Vercel neste ambiente.");
}

/**
 * Every request leaves with the privacy options on top of whatever the
 * caller set, so no call can drop them; thinking models get a short
 * reasoning budget, so text remains within the output limit.
 */
function privately(reasoning: boolean): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    transformParams: async ({ params }) => ({
      ...params,
      ...(reasoning ? { reasoning: "low" as const } : {}),
      providerOptions: { ...params.providerOptions, gateway: { ...params.providerOptions?.gateway, ...PRIVATE_GATEWAY } },
    }),
  };
}

/** A text model through the Gateway that only reaches private providers, for single answers. */
export function privateModel(model: string, reasoning: boolean) {
  assertGateway();
  return wrapLanguageModel({ model: gateway(model), middleware: privately(reasoning) });
}

/**
 * The assistant's chat model: private like every call, with the round's
 * tool calls handed over in the order the model wrote them. `round` is
 * rewritten by every model call (see `inModelOrder`).
 */
export function chatModel(model: string, reasoning: boolean, round: RoundState = roundState()) {
  assertGateway();
  return wrapLanguageModel({ model: gateway(model), middleware: [privately(reasoning), inModelOrder(round)] });
}

type StreamPart = { type: string; [key: string]: unknown };

/**
 * Whether the SDK takes this text as a call's arguments: JSON that, like its
 * own parser (secureJsonParse), holds no `__proto__` key and no
 * `constructor.prototype` at any depth.
 */
export function parsesSecurely(text: string) {
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
 * Hands a round's tool calls to the SDK at the end of the round, in the
 * order the model started writing them, which is the order they run in. A
 * call is placed by its first piece (`tool-input-start`), or by the call
 * itself when it came whole. It also reports, in `round`, the calls whose
 * arguments are not JSON (sent on as `{}`, so the turn refuses them in words
 * instead of the SDK dropping them) and a call the model started but never
 * finished; both describe this model call only.
 */
export function inModelOrder(round: RoundState): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    wrapStream: async ({ doStream }) => {
      round.malformed.clear();
      round.unfinished = false;
      const { stream, ...rest } = await doStream();
      // Each call's place, by the id its pieces and the call share.
      const place = new Map<string, number>();
      const opened = new Set<string>();
      let held: StreamPart[] = [];
      const seen = (id: string) => {
        if (!place.has(id)) place.set(id, place.size);
      };
      const release = (controller: TransformStreamDefaultController<StreamPart>) => {
        const called = new Set(held.map((part) => String(part.toolCallId)));
        // The model started more calls than it finished: one was cut before its arguments closed.
        if ([...opened].some((id) => !called.has(id))) round.unfinished = true;
        const at = (part: StreamPart) => place.get(String(part.toolCallId)) ?? Number.MAX_SAFE_INTEGER;
        for (const part of [...held].sort((a, b) => at(a) - at(b))) {
          const input = typeof part.input === "string" ? part.input : "";
          if (input.trim() && !parsesSecurely(input)) {
            round.malformed.add(String(part.toolCallId));
            controller.enqueue({ ...part, input: "{}" });
          } else controller.enqueue(part);
        }
        held = [];
        opened.clear();
      };
      return {
        ...rest,
        stream: (stream as ReadableStream<StreamPart>).pipeThrough(
          new TransformStream<StreamPart, StreamPart>({
            transform(part, controller) {
              if (part.type === "tool-input-start") {
                opened.add(String(part.id));
                seen(String(part.id));
              }
              // A call the provider ran itself is followed by its result: it goes on at once, and is not cut.
              if (part.type === "tool-call" && part.providerExecuted) opened.delete(String(part.toolCallId));
              else if (part.type === "tool-call") {
                seen(String(part.toolCallId));
                held.push(part);
                return;
              }
              if (part.type === "finish") release(controller);
              controller.enqueue(part);
            },
            flush(controller) {
              if (held.length || opened.size) release(controller);
            },
          }),
        ) as typeof stream,
      };
    },
  };
}

/** A stream the provider sent that could not be read: its content never goes into a log. */
const UNREADABLE = "resposta ilegível do provedor";

/** The Gateway's own words: a refusal it sent in a shape the SDK did not expect keeps them in `response`. */
function gatewayDetail(error: GatewayError) {
  const body = (error as { response?: unknown }).response;
  const said = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  return typeof said === "string" && said ? said : error.message;
}

/** How a model call failed, from what the AI SDK reports; null for anything else (a bug, a database fault). */
export function providerFailure(error: unknown): ProviderFailure | null {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  // The Gateway's refusals (key, credits, model, no private provider) and its timeouts. A request cut by a
  // deadline comes back wrapped as a 500 around the abort itself.
  if (GatewayError.isInstance(cause)) {
    const inner = (cause as { cause?: unknown }).cause;
    const stopped = cause.name === "GatewayTimeoutError" || (inner instanceof Error && (inner.name === "TimeoutError" || inner.name === "AbortError"));
    if (stopped) return { detail: cause.message, timeout: true };
    if (GatewayResponseError.isInstance(cause) && inner instanceof Error) {
      // Something that failed here before any answer (a body that cannot be sent, a bug) comes back as a 500
      // around the original error: it is not the Gateway's, and the route logs it as a fault.
      if (!APICallError.isInstance(inner)) return null;
      // A network failure got no answer at all: the original call says what happened.
      if (inner.statusCode === undefined && inner.responseBody === undefined) return { detail: inner.message };
    }
    return { status: cause.statusCode, detail: gatewayDetail(cause) };
  }
  // A missing or refused credential, as the SDK rewraps it: the status is gone, the name stays.
  if (cause instanceof Error && (cause.name === "GatewayAuthenticationError" || (cause.name === "GatewayError" && /unauthenticated/i.test(cause.message))))
    return { status: 401, detail: "credencial recusada" };
  if (APICallError.isInstance(cause)) return { status: cause.statusCode, detail: cause.message };
  // A failure after the stream started: the provider's own { statusCode, message }, as the SDK reads it.
  if (StreamProviderError.isInstance(cause)) {
    const code = Number(cause.statusCode ?? cause.code);
    return { status: Number.isInteger(code) ? code : undefined, detail: cause.message };
  }
  // These carry the unreadable piece itself, which can quote the model's answer.
  if (TypeValidationError.isInstance(cause) || JSONParseError.isInstance(cause) || InvalidResponseDataError.isInstance(cause)) return { detail: UNREADABLE };
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) return { detail: cause.message, timeout: true };
  // The same as above, when it arrives as the bare object.
  if (cause && typeof cause === "object" && !(cause instanceof Error) && "message" in cause) {
    const code = Number((cause as { statusCode?: unknown; code?: unknown }).statusCode ?? (cause as { code?: unknown }).code);
    return { status: Number.isInteger(code) ? code : undefined, detail: String((cause as { message: unknown }).message ?? "") };
  }
  return null;
}

/**
 * Whether an error came from the AI SDK or the Gateway; its message or its
 * cause may hold the request (client data included) or the answer.
 */
export const sdkError = (error: unknown) =>
  AISDKError.isInstance(error) || GatewayError.isInstance(error) || (error instanceof Error && error.name.startsWith("Gateway"));
