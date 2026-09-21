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
export const ticketLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em atendimento",
  waiting_customer: "Aguardando cliente",
  resolved: "Resolvido",
  closed: "Encerrado",
};
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
  "contract.published": "Contrato publicado para o cliente",
  "contract.unpublished": "Contrato retirado da área do cliente",
  "company_invite.created": "Link de cadastro criado",
  "company_invite.revoked": "Link de cadastro cancelado",
  "company.created": "Empresa cadastrada",
  "company.updated": "Cadastro atualizado",
  "company.archived": "Cliente arquivado",
  "company.restored": "Cliente restaurado",
  "membership.granted": "Acesso liberado ou atualizado",
  "membership.revoked": "Acesso revogado",
  "engagement.created": "Produto ou projeto cadastrado",
  "engagement.status_changed": "Situação do produto ou projeto alterada",
  "bookmark.created": "Bookmark adicionado",
  "bookmark.deleted": "Bookmark removido",
  "ticket.created": "Chamado aberto",
  "ticket.updated": "Chamado atualizado",
  "ticket.replied": "Resposta adicionada",
  "ticket.attachment_added": "Anexo adicionado",
  "invoice.bank_requested": "Emissão solicitada ao Inter",
  "invoice.bank_accepted": "Cobrança aceita pelo Inter",
  "invoice.bank_checked": "Cobrança consultada no Inter",
  "invoice.drafted": "Rascunho de fatura criado",
  "invoice.draft_updated": "Rascunho atualizado",
  "invoice.draft_cancelled": "Rascunho cancelado",
  "access_notice.accepted": "Aviso de acesso aceito pelo Resend",
  "assisted.started": "Acesso assistido iniciado por um administrador",
  "assisted.ended": "Acesso assistido encerrado",
};
