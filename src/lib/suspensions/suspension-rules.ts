import { addDays } from "../billing/recurrence";

/*
 * Suspending a product or service: what the conditions allow, when, and the
 * steps that block each kind of product. Pure, so the screens, the actions and
 * the routines share it. The Console does not host the products: suspending
 * changes the state here and lists what the team does at the product (an app
 * will read the state itself once integrated; a VM or a mailbox is blocked by
 * hand, step by step). Nothing is ever deleted while suspended.
 */

export const SUSPENSION_REASONS = ["overdue", "terms", "other"] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];
export const suspensionReasonLabels: Record<SuspensionReason, string> = {
  overdue: "Atraso no pagamento",
  terms: "Descumprimento das condições de uso",
  other: "Outro motivo",
};

export const SUSPENSION_KINDS = ["app", "vm", "email", "manual"] as const;
export type SuspensionKind = (typeof SUSPENSION_KINDS)[number];
export const suspensionKindLabels: Record<SuspensionKind, string> = {
  app: "Sistema (CMS, Synova, SaaS)",
  vm: "Aplicação hospedada (Vercel, Hetzner e outros)",
  email: "Servidor de e-mail",
  manual: "Outro (passos à mão)",
};
export const suspensionKindHints: Record<SuspensionKind, string> = {
  app: "Bloqueia a área de quem administra; o site público continua no ar.",
  vm: "Na Vercel, pausar o projeto; num servidor (Hetzner e outros), snapshot e desligar. Dados, domínio e IP ficam. Nada é apagado.",
  email: "Bloqueia o envio; a caixa continua recebendo e guardando tudo.",
  manual: "A equipe segue os passos combinados para o produto.",
};

export type SuspensionStep = { key: string; label: string };

/** What the team does at the product to block it, in order. */
export const suspendSteps: Record<SuspensionKind, SuspensionStep[]> = {
  app: [{ key: "app-blocked", label: "Acesso à área administrativa bloqueado (o site público continua no ar)" }],
  vm: [
    { key: "vm-snapshot", label: "Cópia de segurança feita (snapshot do servidor ou backup do banco)" },
    { key: "vm-off", label: "Aplicação pausada ou servidor desligado, com dados, domínio e IP mantidos" },
  ],
  email: [
    { key: "email-smtp", label: "Envio (SMTP) bloqueado nas caixas, recebimento mantido" },
    { key: "email-banner", label: "Aviso de suspensão no webmail" },
  ],
  manual: [{ key: "manual-blocked", label: "Acesso bloqueado como combinado para o produto" }],
};

/** And to bring it back. */
export const liftSteps: Record<SuspensionKind, SuspensionStep[]> = {
  app: [{ key: "app-unblocked", label: "Acesso liberado" }],
  vm: [
    { key: "vm-on", label: "Aplicação ou servidor de volta e respondendo" },
  ],
  email: [
    { key: "email-smtp-on", label: "Envio liberado nas caixas" },
    { key: "email-banner-off", label: "Aviso do webmail retirado" },
  ],
  manual: [{ key: "manual-unblocked", label: "Acesso liberado" }],
};

export const suspensionKindOf = (value: string | null | undefined): SuspensionKind =>
  SUSPENSION_KINDS.includes(value as SuspensionKind) ? (value as SuspensionKind) : "manual";

export type SuspensionStage = "scheduled" | "suspended" | "settled" | "lifted";

export function suspensionStage(s: { suspendedAt: Date | string | null; settledAt: Date | string | null; liftedAt: Date | string | null }): SuspensionStage {
  if (s.liftedAt) return "lifted";
  if (!s.suspendedAt) return "scheduled";
  return s.settledAt ? "settled" : "suspended";
}

export const suspensionStageLabels: Record<SuspensionStage, string> = {
  scheduled: "Suspensão agendada",
  suspended: "Suspenso",
  settled: "Pago: reativar",
  lifted: "Reativado",
};

/** What the published conditions say about suspension, when anything. */
export type SuspensionPolicy = { days: number; notice: boolean; clause: string | null } | null;

/**
 * For late payment the conditions set the earliest day: more than `days`
 * late on the oldest overdue invoice. Without a clause there is no earliest
 * day from the contract (the team writes why).
 */
export function earliestSuspensionDate(oldestDueDate: string, policy: SuspensionPolicy) {
  return policy ? addDays(oldestDueDate, policy.days + 1) : null;
}

export type SuspensionCheck = {
  reason: SuspensionReason;
  /** The day it would be suspended ("today" suspends now). */
  date: string;
  today: string;
  policy: SuspensionPolicy;
  /** The oldest overdue invoice's due date, or null when nothing is overdue. */
  oldestDueDate: string | null;
  note: string;
  /** The day the notice went out (or goes out now), São Paulo time; null when none. */
  noticedOn: string | null;
};

/** Why it cannot be suspended on that date, or null. The messages are for the team. */
export function suspensionRefusal(c: SuspensionCheck): string | null {
  if (c.date < c.today) return "A data da suspensão não pode estar no passado.";
  if (c.date > addDays(c.today, 60)) return "Agende a suspensão para os próximos 60 dias.";
  if (c.reason === "overdue") {
    if (!c.oldestDueDate) return "Esta empresa não tem fatura vencida.";
    const earliest = earliestSuspensionDate(c.oldestDueDate, c.policy);
    if (earliest && c.date < earliest)
      return `Pelas condições, com mais de ${c.policy!.days} dias de atraso. A primeira data possível é ${earliest.split("-").reverse().join("/")}.`;
  }
  // No clause the client can read, or a reason outside the payment clause: the team writes why.
  if ((!c.policy || c.reason !== "overdue") && c.note.trim().length < 10)
    return c.policy ? "Explique o motivo em uma ou duas frases." : "Sem cláusula de suspensão publicada para este cliente. Escreva a justificativa.";
  // With notice required, it is never suspended the same day the notice goes out.
  if (c.policy?.notice && c.reason === "overdue") {
    if (!c.noticedOn) return "As condições pedem um aviso antes da suspensão.";
    if (c.date <= c.noticedOn) return "As condições pedem um aviso antes: agende para depois do dia do aviso.";
  }
  return null;
}

/** Steps done, out of the ones the kind asks for. */
export function stepsDone(steps: Record<string, unknown>, list: SuspensionStep[]) {
  return list.filter((step) => !!steps[step.key]).length;
}
