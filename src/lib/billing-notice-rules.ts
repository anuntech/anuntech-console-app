import { currency, dateLabel } from "./format";
export type BillingNoticeKind =
  | "initial"
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
  return kind === "initial" ? today < due : kind === reminderKind(due, today);
}
export function billingWhatsappParameters(data: {
  name: string;
  description: string;
  amountCents: number;
  dueDate: string;
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
    parameters["[vencimento]"] = dateLabel(data.dueDate);
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
  if (kind === "due") return "Vence hoje";
  return `${kind.replace("overdue_", "")} dias de atraso`;
}
