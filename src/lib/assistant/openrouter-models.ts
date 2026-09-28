import "server-only";

export type OpenRouterModel = {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  /** US$ per million tokens; null when the model is free or unpriced. */
  promptPerMillion: number | null;
  completionPerMillion: number | null;
  free: boolean;
  /** Accepts the `reasoning` parameter (thinking budget). */
  reasoning: boolean;
};

/** Ids we suggest first when they exist in the live list: capable with tools, sane prices. */
export const SUGGESTED_MODEL_IDS = [
  "anthropic/claude-sonnet-5",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5.6-luna",
  "openai/gpt-4.1-mini",
  "google/gemini-3.8-flash",
  "google/gemini-2.5-flash",
];

type Raw = {
  id: string;
  name: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
};

const perMillion = (value?: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1_000_000 * 100) / 100 : null;
};

/**
 * The models OpenRouter offers that can call tools, refreshed hourly.
 * Batch variants are left out (they are not for chat). An empty list means
 * the fetch failed; the settings page then falls back to a plain field.
 */
let cached: { at: number; models: OpenRouterModel[] } | null = null;
const TTL_MS = 60 * 60 * 1000;

export async function openRouterModels(): Promise<OpenRouterModel[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.models;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[assistant] OpenRouter models: HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { data?: Raw[] };
    const models = (data.data ?? [])
      .filter((m) => m.supported_parameters?.includes("tools") && !m.id.endsWith(":batch"))
      .map((m) => {
        const [providerPart, ...rest] = m.name.includes(": ") ? m.name.split(": ") : [m.id.split("/")[0], m.name];
        return {
          id: m.id,
          name: rest.join(": ") || m.name,
          provider: providerPart,
          contextLength: m.context_length ?? 0,
          promptPerMillion: perMillion(m.pricing?.prompt),
          completionPerMillion: perMillion(m.pricing?.completion),
          free: m.id.endsWith(":free") || (!perMillion(m.pricing?.prompt) && !perMillion(m.pricing?.completion)),
          reasoning: !!m.supported_parameters?.includes("reasoning"),
        };
      })
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
    cached = { at: Date.now(), models };
    return models;
  } catch (error) {
    console.warn("[assistant] OpenRouter models unavailable", error instanceof Error ? error.message : error);
    return [];
  }
}

/** Whether a model takes a reasoning budget; unknown models are treated as not. */
export async function modelSupportsReasoning(id: string) {
  const models = await openRouterModels();
  return models.find((m) => m.id === id)?.reasoning ?? false;
}
