import { formatPhone } from "../companies/company-input";
import { auditLabels } from "../format";

/*
 * How Configurações → Notificações names a notice that went out: its
 * situation, who received it and what moved. No database here, so the web
 * page, the app's procedure and the tests share it.
 */

export const NOTICE_HISTORY_PAGE_SIZE = 20;

export const noticeStatusLabels: Record<string, string> = {
  waiting: "Agendado",
  pending: "Na fila",
  processing: "Enviando",
  sending: "Enviando",
  accepted: "Aceito pelo provedor",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  uncertain: "Sem confirmação",
  cancelled: "Não enviado",
  skipped: "Não enviado",
  expired: "Prazo encerrado",
};

/** The tone of a situation: green when it arrived, red when it failed, amber when nobody knows. */
export type NoticeTone = "good" | "info" | "danger" | "attention" | "neutral";
const tones: Record<string, NoticeTone> = {
  delivered: "good",
  read: "good",
  sent: "good",
  accepted: "info",
  sending: "info",
  processing: "info",
  failed: "danger",
  uncertain: "attention",
  expired: "attention",
};
export const noticeTone = (status: string): NoticeTone => tones[status] ?? "neutral";
export const noticeStatusLabel = (status: string) => noticeStatusLabels[status] || status;

/** "5511987650002" → "(11) 98765-0002"; e-mails and foreign numbers as stored. */
export function noticeDestinationLabel(channel: string, destination: string) {
  const digits = destination.replace(/\D/g, "");
  return channel !== "email" && /^55\d{10,11}$/.test(digits) ? formatPhone(digits.slice(2)) : destination;
}

/** An address or a number already says the channel; the channel's name only stands in for a missing one. */
export const noticeRecipient = (channel: string, destination: string) =>
  destination ? noticeDestinationLabel(channel, destination) : channel === "email" ? "E-mail" : "WhatsApp";

/** What moved: "Financeiro" for a billing notice, else the audit action's name. */
export const noticeActionLabel = (action: string) =>
  action === "billing.notice" ? "Financeiro" : auditLabels[action] || action;

/** The page asked for (the web's ?page=, the app's number), within the pages there are. */
export function noticeHistoryPage(requested: unknown, total: number) {
  const pageCount = Math.max(1, Math.ceil(total / NOTICE_HISTORY_PAGE_SIZE));
  const raw =
    typeof requested === "string" && /^[1-9]\d{0,6}$/.test(requested)
      ? Number(requested)
      : typeof requested === "number" && Number.isInteger(requested) && requested >= 1
        ? requested
        : 1;
  return { page: Math.min(raw, pageCount), pageCount };
}
