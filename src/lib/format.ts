import { APP_LOCALE, APP_TIME_ZONE } from "./dates";
export const currency = (cents: number) =>
  new Intl.NumberFormat(APP_LOCALE, {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
export const dateLabel = (date: Date | string) =>
  new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    dateStyle: "short",
  }).format(typeof date === "string" ? new Date(date + "T12:00:00Z") : date);
/** "24 de setembro de 2026", for contract text and notices. */
export const longDateLabel = (date: Date | string) =>
  new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: typeof date === "string" ? "UTC" : APP_TIME_ZONE,
    dateStyle: "long",
  }).format(typeof date === "string" ? new Date(date + "T12:00:00Z") : date);
/** "23 set" for a civil date, where the year would only be noise. */
export const shortDateLabel = (date: string) =>
  new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  })
    .format(new Date(date + "T12:00:00Z"))
    .replace(" de ", " ")
    .replace(".", "");
export const ticketLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em atendimento",
  waiting_customer: "Aguardando cliente",
  resolved: "Resolvido",
  closed: "Encerrado",
};
export const priorityLabels: Record<string, string> = {
  normal: "Normal",
  high: "Alta",
};
// Instants (timestamps), unlike dateLabel's civil dates.
const instant = (date: Date | string) =>
  typeof date === "string" ? new Date(date) : date;
export const timeLabel = (date: Date | string) =>
  new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    timeStyle: "short",
  }).format(instant(date));
export const dateTimeLabel = (date: Date | string) =>
  `${dateLabel(instant(date))} às ${timeLabel(date)}`;
/** "há 5 min", "ontem" … up to a week; older moments read as a date. */
export function relativeLabel(
  date: Date | string,
  now: Date | string = new Date(),
) {
  const minutes = Math.round(
    (instant(now).getTime() - instant(date).getTime()) / 60000,
  );
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return dateLabel(instant(date));
}
export const fileSizeLabel = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.ceil(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || "") + (words[1]?.[0] || "")).toUpperCase() || "•";
}
export const invoiceLabels: Record<string, string> = {
  draft: "Rascunho",
  issued: "Emitida",
  paid: "Paga",
  cancelled: "Cancelada",
};
export const roleLabels: Record<string, string> = {
  manager: "Administrador",
  member: "Membro",
};
export const engagementLabels: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  completed: "Concluído",
};

export const auditLabels: Record<string, string> = {
  "contract.created": "Rascunho de contrato criado",
  "contract.draft_updated": "Rascunho de contrato atualizado",
  "contract.sent": "Contrato enviado para assinatura",
  "contract.signed": "Contrato assinado por uma das partes",
  "contract.completed": "Contrato assinado pelas duas partes",
  "contract.cancelled": "Contrato cancelado",
  "contract.reverted": "Contrato voltou para rascunho",
  "contract.amendment_created": "Aditivo criado",
  "contract.term_updated": "Vigência atualizada",
  "contract.term_amended": "Vigência alterada por aditivo",
  "contract.expiry_notice": "Aviso de vencimento enviado",
  "contract.expired_notice": "Aviso de contrato vencido enviado",
  "contract.published": "Contrato publicado para o cliente",
  "contract.unpublished": "Contrato retirado da área do cliente",
  "contract_template.created": "Modelo de contrato criado",
  "contract_template.updated": "Modelo de contrato atualizado",
  "company.created": "Empresa cadastrada",
  "company.updated": "Cadastro atualizado",
  "company.archived": "Cliente arquivado",
  "company.restored": "Cliente restaurado",
  "membership.granted": "Acesso liberado ou atualizado",
  "membership.revoked": "Acesso revogado",
  "engagement.created": "Produto ou projeto cadastrado",
  "engagement.status_changed": "Situação do produto ou projeto alterada",
  "engagement.updated": "Produto ou projeto atualizado",
  "catalog.created": "Item adicionado ao catálogo",
  "catalog.updated": "Item do catálogo atualizado",
  "task.created": "Tarefa criada",
  "task.updated": "Tarefa atualizada",
  "task.moved": "Tarefa movida no quadro",
  "task.deleted": "Tarefa excluída",
  "bookmark.created": "Bookmark adicionado",
  "bookmark.updated": "Bookmark alterado",
  "bookmark.deleted": "Bookmark removido",
  "bookmark_folder.created": "Pasta de bookmarks criada",
  "bookmark_folder.updated": "Pasta de bookmarks alterada",
  "bookmark_folder.shared": "Pasta de bookmarks compartilhada",
  "bookmark_folder.deleted": "Pasta de bookmarks excluída",
  "ticket.created": "Chamado aberto",
  "ticket.updated": "Chamado atualizado",
  "ticket.replied": "Resposta adicionada",
  "ticket.attachment_added": "Anexo adicionado",
  "invoice.bank_requested": "Emissão solicitada ao Inter",
  "invoice.bank_accepted": "Cobrança aceita pelo Inter",
  "invoice.bank_checked": "Cobrança consultada no Inter",
  "invoice.drafted": "Rascunho de fatura criado",
  "invoice.draft_updated": "Rascunho atualizado",
  "invoice.description_updated": "Descrição da fatura atualizada",
  "invoice.notice_resent": "Reenvio de aviso solicitado",
  "invoice.draft_cancelled": "Rascunho cancelado",
  "invoice.public_link_updated": "Link de pagamento alterado",
  "invoice.bank_cancelled": "Cobrança anterior cancelada no Inter",
  "invoice.bank_due_date_updated": "Vencimento ajustado pelo Inter",
  "subscription.activated": "Recorrência ativada",
  "subscription.status_changed": "Recorrência pausada ou retomada",
  "subscription.updated": "Próximas cobranças atualizadas",
  "access_notice.accepted": "Aviso de acesso aceito pelo Resend",
  "assisted.started": "Acesso assistido iniciado por um administrador",
  "assisted.ended": "Acesso assistido encerrado",
};
