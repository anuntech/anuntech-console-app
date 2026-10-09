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
  open: "Aguardando atendimento",
  in_progress: "Em atendimento",
  waiting_customer: "Aguardando cliente",
  resolved: "Resolvido",
  closed: "Encerrado",
};
/** What the client reads: the ticket waits for "você", not for "cliente". */
export const clientTicketLabels: Record<string, string> = {
  ...ticketLabels,
  waiting_customer: "Aguardando você",
};
export const priorityLabels: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  normal: "Normal",
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
  "invoice.paid_outside": "Recebimento fora do boleto confirmado",
  "collection.contact": "Contato de cobrança registrado",
  "membership.invite_resent": "Convite reenviado",
  "settings.automations_updated": "Automações atualizadas",
  "contract.signed_notice_sent": "Contrato assinado enviado ao cliente",
  "contract.reminder_sent": "Lembrete de assinatura enviado",
  "quote.reminder_sent": "Lembrete de validade do orçamento enviado",
  "ticket.client_reminded": "Cliente lembrado do que falta",
  "service_terms.created": "Condições de atendimento cadastradas",
  "service_terms.updated": "Condições de atendimento atualizadas",
  "service_terms.deactivated": "Condições de atendimento desativadas",
  "hours.logged": "Horas registradas",
  "hours.alert_sent": "Aviso do banco de horas enviado",
  "hours.overage_approved": "Horas além do banco aprovadas",
  "hours.report_sent": "Relatório de horas enviado",
  "hours.report_contested": "Relatório de horas contestado",
  "ticket.estimate_proposed": "Estimativa enviada ao cliente",
  "staff.granted": "Acesso de equipe concedido",
  "staff.revoked": "Acesso de equipe removido",
  "environment.updated": "Dados da Anuntech atualizados",
  "settings.holidays_updated": "Feriados da sede atualizados",
  "notifications.preferences_updated": "Preferências de notificação atualizadas",
  "notifications.settings": "Notificações atualizadas",
  "invoice.notice_delivery": "Entrega de aviso de cobrança conferida",
  "invoice.notice_processed": "Aviso de cobrança processado",
  "contract.created": "Rascunho de contrato criado",
  "contract.draft_updated": "Rascunho de contrato atualizado",
  "contract.sent": "Contrato enviado para assinatura",
  "contract.signed": "Contrato assinado por uma das partes",
  "contract.completed": "Contrato assinado pelas duas partes",
  "contract.cancelled": "Contrato cancelado",
  "contract.reverted": "Contrato voltou para rascunho",
  "contract.changes_requested": "Cliente pediu alterações",
  "contract.change_accepted": "Pedido de alteração aceito",
  "contract.change_declined": "Pedido de alteração recusado",
  "contract.amendment_created": "Aditivo criado",
  "contract.term_updated": "Vigência atualizada",
  "contract.term_amended": "Vigência alterada por aditivo",
  "contract.expiry_notice": "Aviso de vencimento enviado",
  "contract.expired_notice": "Aviso de contrato vencido enviado",
  "contract.deleted": "Contrato excluído",
  "quote.created": "Rascunho de orçamento criado",
  "quote.draft_updated": "Rascunho de orçamento atualizado",
  "quote.sent": "Orçamento enviado ao cliente",
  "quote.reverted": "Orçamento voltou para rascunho",
  "quote.accepted": "Orçamento aceito",
  "quote.declined": "Orçamento recusado",
  "quote.cancelled": "Orçamento cancelado",
  "quote.deleted": "Orçamento excluído",
  "assistant.settings_updated": "Assistente reconfigurado",
  "assistant.document_added": "Documento adicionado ao assistente",
  "assistant.document_removed": "Documento removido do assistente",
  "contract.published": "Contrato publicado para o cliente",
  "contract.unpublished": "Contrato retirado da área do cliente",
  "contract_template.created": "Modelo de contrato criado",
  "contract_template.updated": "Modelo de contrato atualizado",
  "company.created": "Empresa cadastrada",
  "company.updated": "Cadastro atualizado",
  "company.archived": "Cliente arquivado",
  "company.restored": "Cliente restaurado",
  "company.deleted": "Empresa excluída",
  "membership.granted": "Acesso liberado ou atualizado",
  "membership.revoked": "Acesso revogado",
  "engagement.created": "Produto ou projeto cadastrado",
  "engagement.status_changed": "Situação do produto ou projeto alterada",
  "engagement.updated": "Produto ou projeto atualizado",
  "engagement.deleted": "Produto ou projeto excluído",
  "catalog.created": "Item adicionado ao catálogo",
  "catalog.updated": "Item do catálogo atualizado",
  "task.created": "Tarefa criada",
  "task.updated": "Tarefa atualizada",
  "task.moved": "Tarefa movida no quadro",
  "task.deleted": "Tarefa excluída",
  "task.commented": "Comentário em tarefa",
  "task.comment_edited": "Comentário de tarefa editado",
  "task.comment_deleted": "Comentário de tarefa excluído",
  "bookmark.created": "Bookmark adicionado",
  "bookmark.updated": "Bookmark alterado",
  "bookmark.deleted": "Bookmark excluído",
  "bookmark_folder.created": "Pasta de bookmarks criada",
  "bookmark_folder.updated": "Pasta de bookmarks alterada",
  "bookmark_folder.shared": "Pasta de bookmarks compartilhada",
  "bookmark_folder.deleted": "Pasta de bookmarks excluída",
  "ticket.created": "Chamado aberto",
  "ticket.deleted": "Chamado excluído",
  "ticket.updated": "Chamado atualizado",
  "ticket.replied": "Resposta adicionada",
  "ticket.attachment_added": "Anexo adicionado",
  "invoice.bank_requested": "Emissão solicitada ao Inter",
  "invoice.deleted": "Rascunho de fatura excluído",
  "invoice.bank_accepted": "Cobrança aceita pelo Inter",
  "invoice.bank_checked": "Cobrança consultada no Inter",
  "invoice.fiscal_recorded": "Nota fiscal registrada pela equipe",
  "invoice.drafted": "Rascunho de fatura criado",
  "invoice.draft_updated": "Rascunho atualizado",
  "invoice.description_updated": "Descrição da fatura atualizada",
  "invoice.notice_resent": "Reenvio de aviso solicitado",
  "invoice.draft_cancelled": "Rascunho cancelado",
  "invoice.public_link_updated": "Link de pagamento alterado",
  "invoice.bank_cancelled": "Cobrança anterior cancelada no Inter",
  "invoice.bank_cancel_requested": "Cancelamento pedido ao Inter",
  "invoice.debt_closed": "Dívida encerrada sem nova cobrança",
  "invoice.bank_due_date_updated": "Vencimento ajustado pelo Inter",
  "subscription.activated": "Recorrência ativada",
  "subscription.status_changed": "Recorrência pausada ou retomada",
  "subscription.updated": "Próximas cobranças atualizadas",
  "access_notice.accepted": "Aviso de acesso aceito pelo Resend",
  "assisted.started": "Acesso assistido iniciado por um administrador",
  "assisted.ended": "Acesso assistido encerrado",
};

/**
 * A deadline as people say it: "ter., 13/10, 12h" or "ter., 13/10, 12h30",
 * with "hoje" and "amanhã" when close. São Paulo time.
 */
export function dueLabel(date: Date | string, now: Date | string = new Date()) {
  const at = typeof date === "string" ? new Date(date) : date;
  const day = (d: Date) => new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const hour = `${Number(parts.hour)}h${parts.minute === "00" ? "" : parts.minute}`;
  const today = typeof now === "string" ? new Date(now) : now;
  if (day(at) === day(today)) return `hoje, ${hour}`;
  if (day(at) === day(new Date(today.getTime() + 86400000))) return `amanhã, ${hour}`;
  const weekday = new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIME_ZONE, weekday: "short" }).format(at);
  const date2 = new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIME_ZONE, day: "2-digit", month: "2-digit" }).format(at);
  return `${weekday} ${date2}, ${hour}`;
}
