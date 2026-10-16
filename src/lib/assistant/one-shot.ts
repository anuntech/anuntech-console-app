import "server-only";
import type { z } from "zod";
import { AssistantError, assistantConfig, PRIVATE_PROVIDERS } from "./assistant";
import { modelSupportsReasoning } from "./openrouter-models";

/*
 * One question, one answer: a single chat completion with the team's model,
 * no tools and no history. The journey helpers (and anything else that needs
 * a draft the team reviews) go through here. Every call asks OpenRouter for
 * providers that do not keep the data: client briefings never train a model.
 * Nothing here logs what was asked or answered.
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
};

/** Providers differ on the shape of `content`; this flattens it to text (same as the assistant's). */
const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text ?? "") : "")).join("")
      : "";

type Attempt = { model: string; reasoning: boolean; maxTokens: number; signal: AbortSignal; retried: boolean };

async function call(options: OneShotOptions, attempt: Attempt): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new AssistantError("A IA ainda não foi ligada: falta a chave do OpenRouter nas variáveis do ambiente.");
  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.BETTER_AUTH_URL || "https://console.anuntech.com",
        "X-Title": "Anuntech Console",
      },
      body: JSON.stringify({
        model: attempt.model,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user },
        ],
        temperature: options.temperature ?? 0.3,
        max_tokens: attempt.maxTokens,
        // Only providers that neither store nor train on the prompt.
        provider: PRIVATE_PROVIDERS,
        ...(attempt.reasoning ? { reasoning: { effort: "low" } } : {}),
      }),
      signal: attempt.signal,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError") throw new AssistantError("A IA demorou demais para responder. Tente de novo em instantes.");
    if (name === "AbortError") throw new AssistantError("O pedido foi cancelado antes da resposta da IA.");
    console.warn("[assistant] one-shot unreachable", { model: attempt.model, error: name || "unknown" });
    throw new AssistantError("Não foi possível falar com o OpenRouter agora. Tente de novo em instantes.");
  }
  const data = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: unknown }; finish_reason?: string }[]; error?: { message?: string } }
    | null;
  if (!res.ok || !data?.choices?.length) {
    const detail = data?.error?.message ?? `HTTP ${res.status}`;
    console.warn("[assistant] OpenRouter refused", { model: attempt.model, status: res.status, detail, maxTokens: attempt.maxTokens, oneShot: true });
    if (res.status === 401) throw new AssistantError("A chave do OpenRouter foi recusada. Confira em Configurações › Assistente.");
    if ((res.status === 429 || res.status >= 500) && !attempt.retried) {
      // Busy models hiccup; one short pause usually clears it. The deadline stays the same.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (attempt.signal.aborted) throw new AssistantError("A IA demorou demais para responder. Tente de novo em instantes.");
      return call(options, { ...attempt, retried: true });
    }
    if (res.status === 429)
      throw new AssistantError("O modelo está no limite de uso do OpenRouter agora. Tente de novo em instantes ou escolha outro modelo em Configurações › Assistente.");
    if (res.status === 402) {
      // "You requested up to 4000 tokens, but can only afford 3372": shrink the budget once and go on.
      const affordable = Number(/afford (\d+)/.exec(detail)?.[1]);
      if (affordable >= 600 && affordable < attempt.maxTokens) return call(options, { ...attempt, maxTokens: affordable - 50 });
      throw new AssistantError("A conta do OpenRouter está sem créditos. Adicione créditos em openrouter.ai/settings/credits para a IA voltar.");
    }
    if (/data policy|data collection|privacy/i.test(detail))
      throw new AssistantError(`Nenhum provedor do modelo "${attempt.model}" atende sem guardar os dados. Escolha outro modelo em Configurações › Assistente.`);
    if (res.status === 404 || /model/i.test(detail)) throw new AssistantError(`O modelo "${attempt.model}" não foi aceito pelo OpenRouter: ${detail}`);
    throw new AssistantError(`O OpenRouter não respondeu (${detail}). Tente de novo em instantes.`);
  }
  const choice = data.choices[0];
  const text = textOf(choice.message?.content).trim();
  if (!text) {
    console.warn("[assistant] one-shot empty reply", { model: attempt.model, finishReason: choice.finish_reason ?? null, maxTokens: attempt.maxTokens });
    throw new AssistantError(
      choice.finish_reason === "length" ? "A resposta da IA passou do tamanho permitido. Tente de novo." : "A IA não respondeu agora. Tente de novo em instantes.",
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
  if (!process.env.OPENROUTER_API_KEY) throw new AssistantError("A IA ainda não foi ligada: falta a chave do OpenRouter nas variáveis do ambiente.");
  const { model } = await assistantConfig();
  const reasoning = await modelSupportsReasoning(model);
  const deadline = AbortSignal.timeout(options.timeoutMs ?? 45000);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  const text = await call(options, { model, reasoning, maxTokens: options.maxTokens, signal, retried: false });
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
    throw new AssistantError("A IA respondeu fora do formato. Tente de novo.");
  }
  return parsed;
}
