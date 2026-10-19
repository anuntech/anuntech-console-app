import "server-only";
import { generateText } from "ai";
import type { z } from "zod";
import { AssistantError, assistantConfig } from "./assistant";
import { failureText } from "./assistant-errors";
import { assertGateway, privateModel, providerFailure, sdkError } from "./chat-model";
import { modelSupportsReasoning } from "./gateway-models";

/*
 * One question, one answer: a single completion with the team's model, no
 * tools and no history, through the AI Gateway. The journey helpers,
 * Sugerir resposta and Sugerir fases (anything that needs a draft the team
 * reviews) go through here. Every call only reaches providers that keep
 * nothing and train on nothing (chat-model.ts). Nothing here logs what was
 * asked or answered.
 */

export type OneShotOptions = {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
  /** The whole call, retries included. */
  timeoutMs?: number;
  /** The caller's own cancel (the request closing, for example). */
  signal?: AbortSignal;
  /**
   * Thinking models get a short reasoning budget (the default). False sends
   * no reasoning option at all, so the model's own default applies, as the
   * drafts always had: asking for thinking would spend their short limit.
   */
  reasoning?: boolean;
};

/** A reply whose JSON does not fit the schema; callers may say it in their own words. */
export const OUT_OF_FORMAT = "A IA respondeu fora do formato. Tente de novo.";

async function call(options: OneShotOptions, model: string, reasoning: boolean, signal: AbortSignal): Promise<string> {
  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model: privateModel(model, reasoning),
      instructions: options.system,
      prompt: options.user,
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxTokens,
      // One more try when the model is busy (429, 5xx); none for a refused key or missing credits.
      maxRetries: 1,
      abortSignal: signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw new AssistantError("O pedido foi cancelado antes da resposta da IA.");
    const failure = providerFailure(error);
    if (failure) {
      console.warn("[assistant] Gateway refused", { model, ...failure, maxTokens: options.maxTokens, oneShot: true });
      throw new AssistantError(failure.timeout ? "A IA demorou demais para responder. Tente de novo em instantes." : failureText(failure, model));
    }
    // Any other error of the SDK may carry the request or the answer in its message: only its name is logged.
    if (sdkError(error)) {
      const cause = (error as { cause?: unknown }).cause;
      console.error("[assistant] one-shot failed", { model, name: (error as Error).name, cause: cause instanceof Error ? cause.name : undefined });
      throw new AssistantError("A IA falhou nesta resposta. Tente de novo em instantes.");
    }
    throw error;
  }
  const text = result.text.trim();
  if (!text) {
    console.warn("[assistant] one-shot empty reply", { model, finishReason: result.finishReason, maxTokens: options.maxTokens });
    throw new AssistantError(
      result.finishReason === "length" ? "A resposta da IA passou do tamanho permitido. Tente de novo." : "A IA não respondeu agora. Tente de novo em instantes.",
    );
  }
  return text;
}

/** A Markdown answer wrapped whole in a ```markdown fence comes out unwrapped. */
function unfence(text: string) {
  const match = /^```(?:markdown|md)?[ \t]*\n([\s\S]*?)\n```\s*$/i.exec(text);
  return match ? match[1].trim() : text;
}

type Path = PropertyKey[];
const containerAt = (root: unknown, path: Path): unknown =>
  path.reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<PropertyKey, unknown>)[key] : undefined), root);

/**
 * Models overshoot limits by a few characters or items, or put a stray value
 * in an optional field. Before giving up: long text and long lists are cut to
 * the limit, a bad item leaves its list, a bad optional field falls back to
 * its default. Whatever still fails after that is out of format.
 */
function fit<T>(schema: z.ZodType<T>, raw: unknown): T | null {
  const value = raw;
  for (let pass = 0; pass < 4; pass++) {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    const removals: Path[] = [];
    let changed = false;
    for (const issue of result.error.issues) {
      const path = issue.path as Path;
      if (issue.code === "too_big" && (issue.origin === "string" || issue.origin === "array") && path.length) {
        const parent = containerAt(value, path.slice(0, -1)) as Record<PropertyKey, unknown> | undefined;
        const leaf = path[path.length - 1];
        const current = parent?.[leaf];
        if (typeof current === "string" || Array.isArray(current)) {
          parent![leaf] = current.slice(0, Number(issue.maximum));
          changed = true;
        }
        continue;
      }
      // Inside a list, the item goes; outside, an optional field returns to its default.
      const index = path.findLastIndex((key) => typeof key === "number");
      if (index >= 0) removals.push(path.slice(0, index + 1));
      else if ((issue.code === "invalid_type" || issue.code === "invalid_value") && path.length) removals.push(path);
    }
    const seen = new Set<string>();
    const ordered = removals
      .filter((path) => {
        const id = JSON.stringify(path.map(String));
        return seen.has(id) ? false : (seen.add(id), true);
      })
      // Later items first, so earlier indexes stay valid.
      .sort((a, b) => Number(b[b.length - 1]) - Number(a[a.length - 1]) || 0);
    for (const path of ordered) {
      const parent = containerAt(value, path.slice(0, -1));
      const leaf = path[path.length - 1];
      if (Array.isArray(parent) && typeof leaf === "number" && leaf < parent.length) {
        parent.splice(leaf, 1);
        changed = true;
      } else if (parent && typeof parent === "object" && !Array.isArray(parent) && leaf in parent) {
        delete (parent as Record<PropertyKey, unknown>)[leaf];
        changed = true;
      }
    }
    if (!changed) return null;
  }
  const last = schema.safeParse(value);
  return last.success ? last.data : null;
}

/**
 * A single completion with the model chosen in Configurações › Assistente.
 * With `schema`, the answer's first JSON object is parsed and checked; a
 * reply that does not fit throws a message the screen can show as is.
 */
export async function oneShot(options: OneShotOptions & { schema?: undefined }): Promise<string>;
export async function oneShot<T>(options: OneShotOptions & { schema: z.ZodType<T> }): Promise<T>;
export async function oneShot<T>(options: OneShotOptions & { schema?: z.ZodType<T> }): Promise<string | T> {
  assertGateway();
  const { model } = await assistantConfig();
  const reasoning = options.reasoning !== false && (await modelSupportsReasoning(model));
  const deadline = AbortSignal.timeout(options.timeoutMs ?? 45000);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  const text = await call(options, model, reasoning, signal);
  if (!options.schema) return unfence(text);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  let parsed: T | null = null;
  if (start >= 0 && end > start) {
    try {
      parsed = fit(options.schema, JSON.parse(text.slice(start, end + 1)));
    } catch {
      parsed = null;
    }
  }
  if (parsed === null) {
    console.warn("[assistant] one-shot out of format", { model, chars: text.length });
    throw new AssistantError(OUT_OF_FORMAT);
  }
  return parsed;
}
