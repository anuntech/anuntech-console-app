/**
 * The assistant orb's states and their spoken names, apart from the client
 * component (ai-orb.tsx) so server code and tests can read them too: a
 * "use client" module hands server code references, not values.
 */

/** What the assistant is doing. Screens speak in these; only the table below knows the animations. */
export const AI_ORB_STATES = [
  "idle",
  "listening",
  "thinking",
  "reasoning",
  "tool-call",
  "tool-result",
  "streaming",
  "waiting-approval",
  "error",
  "done",
] as const;

export type AiOrbState = (typeof AI_ORB_STATES)[number];

export const AI_ORB_LABELS: Record<AiOrbState, string> = {
  idle: "Assistente pronto",
  listening: "Assistente ouvindo",
  thinking: "Assistente pensando",
  reasoning: "Assistente raciocinando",
  "tool-call": "Assistente consultando o Console",
  "tool-result": "Assistente lendo o que encontrou",
  streaming: "Assistente escrevendo a resposta",
  "waiting-approval": "Assistente esperando sua confirmação",
  error: "O assistente não conseguiu terminar",
  done: "Assistente terminou",
};
