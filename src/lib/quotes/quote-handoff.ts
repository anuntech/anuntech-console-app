import { addDays } from "../billing/recurrence";
import { currency, longDateLabel } from "../format";
import { quoteNumberLabel, quoteTotals, taskCode, totalWeeks, weeksLabel, type QuoteContent } from "./quote-model";

/*
 * What an accepted proposal hands to the next steps: the contract's open
 * fields, the up-front and balance charges, the project's first board.
 * Pure: the actions, the screens and the tests share it. Nothing here is
 * saved or sent; each step is a draft the team reviews.
 */

export type HandoffQuote = {
  year: number;
  seq: number;
  title: string;
  content: QuoteContent;
  publishedAt: Date | null;
  createdAt: Date;
};

const hours = (min: number, max: number) => (min === max ? `${max} horas` : `${min} a ${max} horas`);

/** Phases with their description and every task with its code, one per line. */
function scopeText(content: QuoteContent) {
  return content.phases
    .flatMap((phase, p) => [
      `Fase ${p + 1}, ${phase.name}${phase.description ? `: ${phase.description.replace(/\s*\n+\s*/g, " ")}` : "."}`,
      ...phase.tasks.map((task, t) => `${taskCode(p, t)} ${task.title}${task.description ? `: ${task.description.replace(/\s*\n+\s*/g, " ")}` : ""}`),
    ])
    .join("\n");
}

const deliverablesText = (content: QuoteContent) =>
  content.phases.flatMap((phase, p) => phase.tasks.map((task, t) => `${taskCode(p, t)} ${task.title}`)).join("\n");

const timelineText = (content: QuoteContent) =>
  content.phases
    .filter((phase) => phase.weeks)
    .map((phase) => `Fase ${content.phases.indexOf(phase) + 1}, ${phase.name}: ${weeksLabel(phase.weeks)}`)
    .join("\n");

/**
 * Values for a contract's {{placeholders}}, by meaning: the templates name
 * the same thing in different ways ({{escopo}}, {{escopo_funcional}}), so
 * each key is matched by the words in it. Only keys asked for, and only
 * values the proposal has.
 */
export function quoteContractValues(quote: HandoffQuote, keys: string[]): Record<string, string> {
  const content = quote.content;
  const totals = quoteTotals(content);
  const weeks = totalWeeks(content.phases);
  const value = (key: string): string => {
    if (/proposta/.test(key) && /numero/.test(key)) return quoteNumberLabel(quote.year, quote.seq);
    if (/proposta/.test(key) && /data/.test(key)) return longDateLabel(quote.publishedAt ?? quote.createdAt);
    if (/valor_hora|valores_hora/.test(key)) return content.hourlyRateCents ? currency(content.hourlyRateCents) : "";
    if (/entrada/.test(key)) return totals.upfrontCents ? `${currency(totals.upfrontCents)} (${content.upfrontPercent}% do total)` : "";
    if (/saldo/.test(key)) return totals.balanceCents ? currency(totals.balanceCents) : "";
    // Not the bare {{valor}}: in the Console's own variables it is the linked item's price per period.
    if (/^valor_total$|valor_do_projeto|valor_global/.test(key)) return totals.totalCents ? currency(totals.totalCents) : "";
    // Narrow on purpose: support templates also speak of hours and deadlines ({{horas_mensais}}, {{prazo_de_resposta}}).
    if (/estimativa|^horas$|horas_estimadas|total_de_horas/.test(key)) return totals.hoursMax ? hours(totals.hoursMin, totals.hoursMax) : "";
    if (/escopo/.test(key)) return scopeText(content);
    if (/entregaveis/.test(key)) return deliverablesText(content);
    if (/tecnologias|stack/.test(key)) return content.stack.join(", ");
    if (/cronograma|fases/.test(key)) return timelineText(content);
    if (/^prazo$|prazo_de_entrega|prazo_total|prazo_do_projeto|duracao/.test(key)) return weeks ? weeksLabel(weeks) : "";
    if (/objetivo|contexto|resumo/.test(key)) return content.summary.trim();
    return "";
  };
  const out: Record<string, string> = {};
  for (const key of keys) {
    const filled = value(key);
    if (filled) out[key] = filled;
  }
  return out;
}

export type QuoteChargePart = "upfront" | "balance";

/** The entrada or the saldo as a one-time charge: amount, description and a suggested due date. */
export function quoteCharge(quote: HandoffQuote, part: QuoteChargePart, today: string) {
  const totals = quoteTotals(quote.content);
  const number = quoteNumberLabel(quote.year, quote.seq);
  const weeks = totalWeeks(quote.content.phases);
  return part === "upfront"
    ? { description: `Entrada do orçamento ${number}, ${quote.title}`, amountCents: totals.upfrontCents, dueDate: addDays(today, 7) }
    : {
        description: `Saldo do orçamento ${number}, ${quote.title}`,
        amountCents: totals.balanceCents,
        // At the end of the timeline when the proposal has one; the team adjusts it to the delivery.
        dueDate: addDays(today, weeks ? Math.max(7, weeks * 7) : 30),
      };
}

export type BoardTask = { title: string; description: string; labels: string[] };

/** Cards per proposal at most; a longer one is cut and the screen says so. */
export const BOARD_LIMIT = 300;

/**
 * The project's first board: the two steps every project starts with, then
 * one card per task in A fazer, with its code and its phase as the label.
 */
export function quoteBoardTasks(content: QuoteContent): BoardTask[] {
  const start: BoardTask[] = [
    { title: "Acessos", description: "O que a equipe precisa do cliente para começar: contas, ambientes e contatos. Pedido por chamado.", labels: ["Início"] },
    { title: "Reunião de início", description: "Marcada depois do contrato assinado, da entrada paga e dos acessos.", labels: ["Início"] },
  ];
  const tasks = content.phases.flatMap((phase, p) =>
    phase.tasks.map((task, t) => ({
      title: `${taskCode(p, t)} ${task.title}`.slice(0, 160),
      description: task.description,
      labels: [phase.name.slice(0, 40)],
    })),
  );
  return [...start, ...tasks].slice(0, BOARD_LIMIT);
}
