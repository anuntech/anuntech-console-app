import "server-only";

export type GatewayModel = {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  /** US$ per million tokens; null when the model is free or unpriced. */
  promptPerMillion: number | null;
  completionPerMillion: number | null;
  free: boolean;
  /** Takes a reasoning budget (thinking). */
  reasoning: boolean;
};

/** Ids we suggest first when they exist in the live list: capable with tools, sane prices, private providers. */
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
  name?: string;
  owned_by?: string;
  type?: string;
  context_window?: number;
  tags?: string[];
  reasoning_options?: unknown[];
  pricing?: { input?: string; output?: string };
  /** Whether any, some or none of the providers keep nothing (not in the documented schema). */
  zdr?: string;
};

const perMillion = (value?: string) => {
  const n = Number(String(value ?? "").replace(/^\$/, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1_000_000 * 100) / 100 : null;
};

/** An id as the Gateway writes them ("creator/model-1.5"); OpenRouter aliases (~, :free) never are. */
export const gatewayModelId = (id: string) => /^[\w.-]+\/[\w.-]+$/u.test(id);

/**
 * The language models the Gateway offers that can call tools and have at
 * least one provider that keeps nothing, refreshed hourly from its public
 * catalog. An empty list means the fetch failed; the settings page then falls
 * back to a plain field. A failure is remembered for a few minutes, so a turn
 * never waits on a catalog that is down.
 */
let cached: { at: number; ttl: number; models: GatewayModel[] } | null = null;
const TTL_MS = 60 * 60 * 1000;
const FAILED_TTL_MS = 5 * 60 * 1000;

export async function gatewayModels(): Promise<GatewayModel[]> {
  if (cached && Date.now() - cached.at < cached.ttl) return cached.models;
  const failed = (detail: string) => {
    console.warn("[assistant] Gateway models unavailable", detail);
    cached = { at: Date.now(), ttl: FAILED_TTL_MS, models: [] };
    return [];
  };
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return failed(`HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Raw[] };
    const models = (data.data ?? [])
      // No private provider: the request would be refused, so the model is never offered.
      .filter((m) => m.type === "language" && m.tags?.includes("tool-use") && m.zdr !== "none" && gatewayModelId(m.id))
      .map((m) => {
        const promptPerMillion = perMillion(m.pricing?.input);
        const completionPerMillion = perMillion(m.pricing?.output);
        return {
          id: m.id,
          name: m.name || m.id.split("/")[1],
          provider: m.owned_by || m.id.split("/")[0],
          contextLength: m.context_window ?? 0,
          promptPerMillion,
          completionPerMillion,
          free: !promptPerMillion && !completionPerMillion,
          reasoning: !!m.tags?.includes("reasoning") || !!m.reasoning_options?.length,
        };
      })
      .sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
    if (!models.length) return failed("empty list");
    cached = { at: Date.now(), ttl: TTL_MS, models };
    return models;
  } catch (error) {
    return failed(error instanceof Error ? error.message : "unknown");
  }
}

/** Whether a model takes a reasoning budget; unknown models are treated as not. */
export async function modelSupportsReasoning(id: string) {
  const models = await gatewayModels();
  return models.find((m) => m.id === id)?.reasoning ?? false;
}

/**
 * The model a call uses: the one saved in Configurações › Assistente when
 * the Gateway offers it with a private provider, else the default. A saved
 * OpenRouter id (an alias, a ":free" variant, a model the Gateway does not
 * have) falls back instead of failing every call. Without the catalog, the
 * saved id goes as it is and the Gateway judges it.
 */
export async function usableModel(saved: string | null | undefined, fallback: string) {
  const id = saved?.trim();
  if (!id || !gatewayModelId(id)) return fallback;
  const models = await gatewayModels();
  if (models.length && !models.some((m) => m.id === id)) {
    console.warn("[assistant] saved model not offered by the Gateway", { model: id, using: fallback });
    return fallback;
  }
  return id;
}
