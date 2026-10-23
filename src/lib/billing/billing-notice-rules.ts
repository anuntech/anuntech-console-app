import { currency, dateLabel } from "../format";
export type BillingNoticeKind =
  | "initial"
  /** Sent again by the team from the invoice; worded for the invoice's situation that day (`messageKind`). */
  | "resend"
  | "due"
  | "overdue_5"
  | "overdue_10"
  | "overdue_15"
  | "overdue_20"
  | "overdue_25";
export const billingTemplates = {
  initial: {
    id: "b65a086f-4940-4843-8d38-87ed309c3348",
    internalName: "e336c_cobrancaativa",
  },
  due: {
    id: "610a0f14-acba-497e-9a10-9ef4761d2d30",
    internalName: "fa62f_cobrancaativavencehoje",
  },
  overdue: {
    id: "9b9af453-4926-4091-b2e2-bf92d8ca5362",
    internalName: "f34d0_cobrancaativaatrasada",
  },
} as const;
export const billingSender = "551151073435";
export const billingChannelId = "6a2255af-e178-496c-b846-789a961ffb25";
export function daysOverdue(due: string, today: string) {
  return Math.round(
    (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${due}T12:00:00Z`)) /
      86400000,
  );
}
// Recover the current reminder after downtime, without sending an old backlog.
export function reminderKind(
  due: string,
  today: string,
): BillingNoticeKind | null {
  const days = daysOverdue(due, today);
  if (days === 0) return "due";
  if (days < 5 || days >= 30) return null;
  return `overdue_${Math.floor(days / 5) * 5}` as BillingNoticeKind;
}
export function noticeIsCurrent(
  kind: BillingNoticeKind,
  due: string,
  today: string,
) {
  // A resend is the team's call on the day: always current.
  if (kind === "resend") return true;
  return kind === "initial" ? today < due : kind === reminderKind(due, today);
}
/**
 * The wording a resend takes: the new-invoice message before the payable
 * date, "due today" on it, and the overdue one after (the e-mail and the
 * WhatsApp count the days from the due date themselves).
 */
export function messageKind(
  kind: BillingNoticeKind,
  i: { dueDate: string; bankDueDate?: string | null },
  today: string,
): Exclude<BillingNoticeKind, "resend"> {
  if (kind !== "resend") return kind;
  const payable = payableUntil(i);
  if (today < payable) return "initial";
  if (today === payable) return "due";
  return daysOverdue(i.dueDate, today) > 0 ? "overdue_5" : "due";
}
/** The date the boleto/Pix can be paid until: the bank's date when the obligation is already past due. */
export function payableUntil(i: { dueDate: string; bankDueDate?: string | null }) {
  return i.bankDueDate ?? i.dueDate;
}
/**
 * Which date a notice is judged against: the payable date for the first
 * notice and for "due today", the real due date for arrears.
 */
export function noticeDate(kind: BillingNoticeKind, i: { dueDate: string; bankDueDate?: string | null }) {
  return kind === "initial" || kind === "due" ? payableUntil(i) : i.dueDate;
}
/** The reminder an invoice calls for today: "due" on the payable date, arrears counted from the real due date. */
export function reminderKindFor(
  i: { dueDate: string; bankDueDate?: string | null },
  today: string,
): BillingNoticeKind | null {
  if (payableUntil(i) === today) return "due";
  const kind = reminderKind(i.dueDate, today);
  return kind === "due" && i.bankDueDate ? null : kind;
}
/**
 * A due date in the past is allowed for debts brought in from elsewhere,
 * as long as the bank gets a future date to put on the boleto. A
 * recurrence, though, always starts in the future.
 */
export function resolveBankDueDate(
  input: { dueDate: string; bankDueDate: string; recurring: boolean },
  today: string,
): { bankDueDate: string | null } | { error: string } {
  if (input.dueDate > today) return { bankDueDate: null };
  if (input.recurring) return { error: "Para uma recorrência, escolha um primeiro vencimento a partir de amanhã." };
  if (!input.bankDueDate)
    return { error: "O vencimento já passou. Informe até quando o boleto e o Pix podem ser pagos." };
  if (input.bankDueDate <= today) return { error: "A data para pagar precisa ser a partir de amanhã." };
  return { bankDueDate: input.bankDueDate };
}
export function billingWhatsappParameters(data: {
  name: string;
  description: string;
  amountCents: number;
  dueDate: string;
  /** When the boleto's date differs from the due date, the message names the payable one. */
  payUntil?: string;
  publicId: string;
  today: string;
  kind: BillingNoticeKind;
}) {
  const parameters: Record<string, string> = {
    "[nome]": data.name,
    "[produto_ou_serviço]": data.description,
    "[valor]": currency(data.amountCents),
    "[id_fatura]": data.publicId,
  };
  if (data.kind === "initial")
    parameters["[vencimento]"] = dateLabel(data.payUntil ?? data.dueDate);
  if (data.kind.startsWith("overdue_"))
    parameters["[dias_em_atraso]"] = String(
      daysOverdue(data.dueDate, data.today),
    );
  return parameters;
}

export const noticeChannelLabels: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
};
/** How each delivery state reads in the Console. */
export const noticeStatusLabels: Record<string, string> = {
  waiting: "Agendado",
  pending: "Na fila",
  sending: "Enviando",
  accepted: "Aceito pelo provedor",
  delivered: "Entregue",
  failed: "Falhou",
  expired: "Prazo encerrado",
  skipped: "Interrompido",
  uncertain: "Sem confirmação",
};
export function noticeKindLabel(kind: string) {
  if (kind === "initial") return "Nova cobrança";
  if (kind === "resend") return "Reenvio da cobrança";
  if (kind === "due") return "Vence hoje";
  return `${kind.replace("overdue_", "")} dias de atraso`;
}
