/**
 * What the assistant is doing right now, in the names the orb draws
 * (components/ui/ai-orb). Pure, so the panel, the dock and the tests agree.
 */
export type AssistantActivity =
  | "idle"
  | "listening"
  | "thinking"
  | "tool-call"
  | "tool-result"
  | "streaming"
  | "waiting-approval"
  | "error"
  | "done";

/** Where a turn is, from the server's `data-phase` parts (lib/assistant/assistant-stream.ts). */
export const TURN_PHASES = ["tools", "reading", "answer"] as const;
export type TurnPhase = (typeof TURN_PHASES)[number];

/** The microphone in the composer (components/console/use-dictation). */
export type DictationActivity = "idle" | "starting" | "recording" | "transcribing" | "error";

export type ActivityInput = {
  /** A turn is running; `phase` is null until the first model round ends. */
  busy: boolean;
  phase: TurnPhase | null;
  /** A confirmed card is being carried out. */
  confirming: boolean;
  /** A card waits for the person's Confirmar or Descartar. */
  pending: boolean;
  /** How the last turn ended, until the person has seen it. */
  settled: "done" | "error" | null;
  dictation: DictationActivity;
};

const PHASE: Record<TurnPhase, AssistantActivity> = {
  tools: "tool-call",
  reading: "tool-result",
  answer: "streaming",
};

/**
 * The work shows first (a turn or a confirmed card running), then the
 * microphone, then how the last answer ended and what waits for the person.
 * Typing is not activity: the assistant is still at rest.
 */
export function assistantActivity(input: ActivityInput): AssistantActivity {
  if (input.confirming) return "tool-call";
  if (input.busy) return input.phase ? PHASE[input.phase] : "thinking";
  if (input.dictation === "starting" || input.dictation === "recording") return "listening";
  if (input.dictation === "transcribing") return "thinking";
  if (input.settled === "error") return "error";
  if (input.pending) return "waiting-approval";
  if (input.settled === "done") return "done";
  return "idle";
}

/** Whether the assistant is working, for `aria-busy` and the dock's tooltip. */
export function activityBusy(activity: AssistantActivity) {
  return activity === "thinking" || activity === "tool-call" || activity === "tool-result" || activity === "streaming";
}

/** The dock's tooltip and the button's state, in a few words. */
export const ACTIVITY_LABELS: Record<AssistantActivity, string> = {
  idle: "Assistente",
  listening: "Assistente ouvindo o microfone",
  thinking: "Assistente pensando…",
  "tool-call": "Assistente consultando o Console…",
  "tool-result": "Assistente lendo o que encontrou…",
  streaming: "Assistente escrevendo a resposta…",
  "waiting-approval": "Assistente esperando sua confirmação",
  error: "O assistente não conseguiu terminar",
  done: "Assistente terminou",
};
