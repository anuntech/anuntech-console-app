import type { DecisionStep } from "@/db/schema";

/*
 * Piloto automático, the rules without a database: which decisions exist,
 * how far each may go on its own, when one expires and how it ended. The
 * queue, the events cron and the tests read the same table.
 */

/**
 * How much the Console does on its own:
 * 0 suggests, 1 prepares and waits for a click, 2 does it and says so,
 * 3 does it quietly and only records it.
 */
export type AutonomyLevel = 0 | 1 | 2 | 3;

export const LEVEL_LABELS: Record<AutonomyLevel, string> = {
  0: "Só sugere",
  1: "Prepara e pede aprovação",
  2: "Faz e avisa",
  3: "Faz e só registra",
};

export type DecisionKind = "quote.start" | "contract.upfront" | "invoice.collect";

/**
 * Every kind with its level and the most it may ever reach. Money, contracts
 * with the client and suspensions stop at 1 in code: the team always clicks
 * (memory.md, 08/10 and 20/10). `days` is how long a decision waits before
 * it expires; a collection ends with the invoice instead.
 */
export const DECISION_KINDS: Record<DecisionKind, { label: string; level: AutonomyLevel; max: AutonomyLevel; days: number; why: string }> = {
  "quote.start": {
    label: "Orçamento aceito: começar o trabalho",
    level: 1,
    max: 1,
    days: 7,
    why: "Cria projeto e contrato e prepara cobrança: o cliente vê o projeto e o contrato vai para assinatura.",
  },
  "contract.upfront": {
    label: "Contrato assinado: emitir a entrada",
    level: 1,
    max: 1,
    days: 7,
    why: "Emissão no Inter é dinheiro: sempre com o clique da equipe.",
  },
  "invoice.collect": {
    label: "Fatura vencida: cobrar o cliente",
    level: 1,
    max: 1,
    days: 30,
    why: "Mensagem de cobrança vai ao cliente: a equipe lê e envia.",
  },
};

export const decisionKinds = Object.keys(DECISION_KINDS) as DecisionKind[];

export const isDecisionKind = (value: string): value is DecisionKind => value in DECISION_KINDS;

/** A level asked for is held to what the kind allows. */
export const clampLevel = (kind: DecisionKind, wanted: number): AutonomyLevel =>
  Math.max(0, Math.min(DECISION_KINDS[kind].max, Math.trunc(wanted))) as AutonomyLevel;

/** When a decision created now stops waiting. */
export const decisionExpiry = (kind: DecisionKind, from: Date) => new Date(from.getTime() + DECISION_KINDS[kind].days * 24 * 60 * 60 * 1000);

/** Days a due invoice stays unpaid before the Console prepares the collection. */
export const COLLECT_AFTER_DAYS = 3;

/**
 * The steps after looking at the data again: a step someone finished on its
 * own screen counts as done, without who or when. Order and labels stay.
 */
export function refreshSteps(steps: DecisionStep[], doneByData: Record<string, boolean>): DecisionStep[] {
  return steps.map((step) => (step.done || !doneByData[step.key] ? step : { ...step, done: true }));
}

/** All steps done: the decision is over. */
export const allDone = (steps: DecisionStep[]) => steps.length > 0 && steps.every((step) => step.done);

/** How a finished decision ended: every step clicked in the queue, none, or some. */
export function resolutionOf(steps: DecisionStep[]): "queue" | "elsewhere" | "mixed" {
  const clicked = steps.filter((step) => step.doneBy).length;
  if (clicked === steps.length) return "queue";
  return clicked === 0 ? "elsewhere" : "mixed";
}

/** Marks one step done by someone, once. A step already done stays as it was. */
export function completeStep(steps: DecisionStep[], key: string, by: string, at: Date): DecisionStep[] {
  return steps.map((step) => (step.key !== key || step.done ? step : { ...step, done: true, doneBy: by, doneAt: at.toISOString() }));
}

export type DecisionTally = {
  created: number;
  pending: number;
  queue: number;
  elsewhere: number;
  mixed: number;
  dismissed: number;
  expired: number;
  /** Clicks per finished decision, counting every step done from the queue. */
  touchesPerDecision: number | null;
  /** Median hours from creation to the end, finished decisions only. */
  medianHours: number | null;
};

type TallyRow = {
  status: "pending" | "done" | "dismissed" | "expired";
  resolution: "queue" | "elsewhere" | "mixed" | null;
  steps: DecisionStep[];
  createdAt: Date;
  decidedAt: Date | null;
};

/** The month's numbers for the Piloto automático page. */
export function tallyDecisions(rows: TallyRow[]): DecisionTally {
  const done = rows.filter((row) => row.status === "done");
  const touches = done.reduce((sum, row) => sum + row.steps.filter((step) => step.doneBy).length, 0);
  const hours = done
    .filter((row) => row.decidedAt)
    .map((row) => (row.decidedAt!.getTime() - row.createdAt.getTime()) / 3_600_000)
    .sort((a, b) => a - b);
  const middle = hours.length ? (hours.length % 2 ? hours[(hours.length - 1) / 2] : (hours[hours.length / 2 - 1] + hours[hours.length / 2]) / 2) : null;
  return {
    created: rows.length,
    pending: rows.filter((row) => row.status === "pending").length,
    queue: done.filter((row) => row.resolution === "queue").length,
    elsewhere: done.filter((row) => row.resolution === "elsewhere").length,
    mixed: done.filter((row) => row.resolution === "mixed").length,
    dismissed: rows.filter((row) => row.status === "dismissed").length,
    expired: rows.filter((row) => row.status === "expired").length,
    touchesPerDecision: done.length ? Math.round((touches / done.length) * 10) / 10 : null,
    medianHours: middle === null ? null : Math.round(middle * 10) / 10,
  };
}
