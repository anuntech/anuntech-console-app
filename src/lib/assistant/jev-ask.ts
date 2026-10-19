import { experimental_decide as decide, Experimental_DecisionRefusalError, gateway } from "ai";
import { PRIVATE_GATEWAY } from "../ai/gateway-env";

/*
 * One question round with Jev through the AI Gateway (jev.ts says what is
 * asked and why). No server-only import, so the contract test runs it
 * against the Gateway stand-in.
 */

export type JevQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "boolean"; instructions: string };
export type JevAnswer = { type: "choice"; choice: string; confidence: number } | { type: "boolean"; probability: number };
export type JevState = Record<string, string | number | boolean | null>;

const JEV_MODEL = process.env.ASSISTANT_JEV_MODEL || "typesafe-ai/jev";

/**
 * A choice's confidence: Jev's own statistic when it comes back (TypeSafe sends
 * it in the provider metadata, keyed by question; it is what the 0.9 and 0.75
 * thresholds were set on), else the probability of the option it chose, else 0.
 */
function confidenceOf(id: string, answer: { choice: string; probabilities?: Record<string, number> }, metadata: unknown) {
  const own = (metadata as { typesafe?: { confidence?: Record<string, unknown> } } | undefined)?.typesafe?.confidence?.[id];
  if (typeof own === "number" && Number.isFinite(own)) return own;
  return answer.probabilities?.[answer.choice] ?? 0;
}

export async function askJev(state: JevState, questions: Record<string, JevQuestion>): Promise<Record<string, JevAnswer> | null> {
  // Both tries share the 6 seconds.
  const deadline = AbortSignal.timeout(6000);
  const once = (asked: Record<string, JevQuestion>) =>
    decide({
      model: gateway.decisionModel(JEV_MODEL),
      state,
      questions: asked,
      // Private like every call, and only TypeSafe's own endpoint: another host serves the same model
      // without the zero-retention promise.
      providerOptions: { gateway: { ...PRIVATE_GATEWAY, only: ["typesafe-ai"] } },
      maxRetries: 0,
      abortSignal: deadline,
    });
  try {
    let result: Awaited<ReturnType<typeof once>>;
    try {
      result = await once(questions);
    } catch (error) {
      // The SDK drops every answer when Jev refuses one question: ask once more without the refused ones.
      if (!Experimental_DecisionRefusalError.isInstance(error)) throw error;
      const rest = Object.fromEntries(Object.entries(questions).filter(([id]) => !error.questionIds.includes(id)));
      if (!Object.keys(rest).length) throw error;
      result = await once(rest);
    }
    const read: Record<string, JevAnswer> = {};
    for (const [id, answer] of Object.entries(result.answers)) {
      if (answer.type === "choice") read[id] = { type: "choice", choice: answer.choice, confidence: confidenceOf(id, answer, result.providerMetadata) };
      else if (answer.type === "boolean") read[id] = { type: "boolean", probability: answer.probability };
    }
    return read;
  } catch (error) {
    // Only what kind of failure: the error's cause carries the request, client text included.
    const status = (error as { statusCode?: unknown }).statusCode;
    const cause = (error as { cause?: unknown }).cause;
    console.warn("[assistant] Jev unavailable", {
      name: error instanceof Error ? error.name : "unknown",
      status: typeof status === "number" ? status : undefined,
      cause: cause instanceof Error ? cause.name : undefined,
    });
    return null;
  }
}

/**
 * The areas a message needs: those Jev said yes to (0.3 or more), and those
 * it refused to answer. A refused question is no opinion, not a "no": dropping
 * its area would take tools away from the turn.
 */
export function neededAreas<T extends string>(answers: Record<string, JevAnswer>, keys: readonly T[]): T[] {
  return keys.filter((key) => {
    const answer = answers[`area_${key}`];
    return !answer || (answer.type === "boolean" && answer.probability >= 0.3);
  });
}
