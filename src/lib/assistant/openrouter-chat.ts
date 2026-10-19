import { APICallError, RetryError, StreamProviderError } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { AssistantError, type ProviderFailure } from "./assistant-errors";

/** Client data only goes to providers that keep nothing and train on nothing. */
export const PRIVATE_PROVIDERS = { zdr: true, data_collection: "deny" } as const;

/**
 * A chat model through OpenRouter, for the AI SDK. Never a bare model id: the
 * SDK would send that to the Vercel AI Gateway instead. Strict mode streams
 * the usage the daily budget counts, and every request asks for providers
 * that keep nothing.
 */
export function chatModel(model: string, reasoning: boolean) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AssistantError("O assistente ainda não foi ligado: falta a chave do OpenRouter nas variáveis do ambiente.");
  const openrouter = createOpenRouter({
    apiKey: key,
    compatibility: "strict",
    headers: { "HTTP-Referer": process.env.BETTER_AUTH_URL || "https://console.anuntech.com", "X-Title": "Anuntech Console" },
  });
  return openrouter.chat(model, {
    provider: PRIVATE_PROVIDERS,
    usage: { include: true },
    // Thinking models spend the output budget on reasoning first; keep it short so text remains.
    ...(reasoning ? { reasoning: { effort: "low" as const } } : {}),
  });
}

/** How a model call failed, from what the AI SDK reports; null for anything else (a bug, a database fault). */
export function providerFailure(error: unknown): ProviderFailure | null {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(cause)) return { status: cause.statusCode, detail: cause.message };
  // A failure after the stream started: OpenRouter's own { code, message }, as the SDK reads it.
  if (StreamProviderError.isInstance(cause)) {
    const code = Number(cause.statusCode ?? cause.code);
    return { status: Number.isInteger(code) ? code : undefined, detail: cause.message };
  }
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) return { detail: cause.message, timeout: true };
  // The same, when it arrives as the bare object.
  if (cause && typeof cause === "object" && !(cause instanceof Error) && "message" in cause) {
    const code = Number((cause as { code?: unknown }).code);
    return { status: Number.isInteger(code) ? code : undefined, detail: String((cause as { message: unknown }).message ?? "") };
  }
  return null;
}
