import type { ContractKind, ContractStatus } from "./contracts/contract-table";
import { quoteExpired, type QuoteStatus } from "./quotes/quote-model";
/*
 * When a record may be deleted for good. Pure (no database, no server code),
 * so pages can hide the option, server actions can refuse with the same rule,
 * and tests import it directly. Who may delete (Anuntech staff) is checked by
 * each action; these only say whether the record's state allows it.
 */

/* ---------- chamados ---------- */

const TICKET_STATES = ["open", "in_progress", "waiting_customer", "resolved", "closed"];

/** A ticket can go in any state; its conversation, files and notices go with it. */
export function canDeleteTicket(status: string) {
  return TICKET_STATES.includes(status);
}

/* ---------- faturas ---------- */

export const INVOICE_DELETE_REFUSAL =
  "Só faturas em rascunho que nunca foram enviadas ao Inter podem ser excluídas.";

/**
 * Every column that proves an invoice reached the Inter (or came back from
 * it). `publishInvoice` stamps `bankRequest`/`bankBase`/`bankStatus` before it
 * calls the bank and keeps them even when the call fails; a reissue clears the
 * bank columns but keeps `publicId`, which only an issued charge receives.
 */
export type InvoiceDeletionInput = {
  status: string;
  fiscalStatus: string;
  /*
   * The rest are traces: any value but null, undefined or false means the
   * invoice went to the bank. A list may pass `true`/`false` for the heavy
   * columns instead of their content.
   */
  bankRequest: unknown;
  providerId: unknown;
  bankBase: unknown;
  bankStatus: unknown;
  bankCheckedAt: unknown;
  boletoLine: unknown;
  pixCopyPaste: unknown;
  boletoUrl: unknown;
  boletoPdf: unknown;
  publicId: unknown;
  fiscalUrl: unknown;
};

/**
 * Audit actions that mean the invoice talked to the Inter at some point. The
 * server checks the history too, since a reissue resets the bank columns.
 */
export const INVOICE_BANK_EVENTS = [
  "invoice.bank_requested",
  "invoice.bank_accepted",
  "invoice.bank_checked",
  "invoice.bank_cancelled",
  "invoice.bank_due_date_updated",
];

/** The reason an invoice cannot be deleted, or null when it can. */
export function invoiceDeletionBlock(invoice: InvoiceDeletionInput): string | null {
  // "cancelled" here can only be a cancelled draft: the fields below rule out a charge cancelled at the bank.
  if (invoice.status !== "draft" && invoice.status !== "cancelled") return INVOICE_DELETE_REFUSAL;
  const traces = [
    invoice.bankRequest,
    invoice.providerId,
    invoice.bankBase,
    invoice.bankStatus,
    invoice.bankCheckedAt,
    invoice.boletoLine,
    invoice.pixCopyPaste,
    invoice.boletoUrl,
    invoice.boletoPdf,
    invoice.publicId,
    invoice.fiscalUrl,
  ];
  if (traces.some((value) => value !== null && value !== undefined && value !== false))
    return INVOICE_DELETE_REFUSAL;
  if (invoice.fiscalStatus !== "not_requested") return INVOICE_DELETE_REFUSAL;
  return null;
}

/** A draft (or a cancelled draft) that never reached the bank nor asked for a nota fiscal. */
export function canDeleteDraftInvoice(invoice: InvoiceDeletionInput) {
  return invoiceDeletionBlock(invoice) === null;
}

/* ---------- documents: quotes and contracts ---------- */

/*
 * When a proposal or a contract may be deleted for good. Pure, so the
 * pages can hide the option and the server actions can refuse with the
 * same rule; tests import it without a database.
 */

export const QUOTE_DELETE_REFUSAL = "Cancele o orçamento antes de excluir: ele ainda está com o cliente.";

/**
 * Everything except a proposal still waiting for the client's answer:
 * drafts, cancelled, accepted, declined and expired ones (sent, past their
 * validity, so the client can no longer answer). Without `validity` a sent
 * proposal is treated as still open. The answer of an accepted or declined
 * one goes into the audit log before the row is deleted.
 */
export function canDeleteQuote(status: QuoteStatus, validity?: { validUntil: string | null; today: string }) {
  if (status === "sent") return !!validity && quoteExpired(status, validity.validUntil, validity.today);
  return status === "draft" || status === "cancelled" || status === "accepted" || status === "declined";
}

/** The reason a proposal cannot be deleted, or null when it can. */
export function quoteDeletionBlock(status: QuoteStatus, validity?: { validUntil: string | null; today: string }): string | null {
  return canDeleteQuote(status, validity) ? null : QUOTE_DELETE_REFUSAL;
}

export type ContractDeletionInput = {
  status: ContractStatus;
  /** Every signature on record for the contract, on any version. */
  signatures: number;
  /** Amendments pointing at it, cancelled ones included. */
  amendments: number;
  kind?: ContractKind;
};

/** The reason a contract or amendment cannot be deleted, or null when it can. */
export function contractDeletionBlock({ status, signatures, amendments, kind = "contract" }: ContractDeletionInput): string | null {
  const noun = kind === "amendment" ? "aditivo" : "contrato";
  if (status === "signed") return `Um ${noun} assinado não pode ser excluído.`;
  if (status === "sent") return `Este ${noun} está aguardando assinatura; cancele-o antes de excluir.`;
  if (status !== "draft" && status !== "cancelled") return `Só rascunhos e ${noun}s cancelados podem ser excluídos.`;
  if (signatures > 0) return `Este ${noun} já recebeu assinatura, que fica como registro; ele não pode ser excluído.`;
  if (amendments > 0) return "Este contrato tem aditivos e não pode ser excluído.";
  return null;
}

/** Drafts and cancelled contracts with no signature on any version and no amendments. */
export function canDeleteContract(input: ContractDeletionInput) {
  return contractDeletionBlock(input) === null;
}

/** What the confirmation says about the client's answer, when the proposal has one. */
export function quoteDecisionNotice(status: QuoteStatus): string | null {
  if (status === "accepted")
    return "O registro do aceite do cliente sai do orçamento e fica guardado no histórico de auditoria.";
  if (status === "declined")
    return "O registro da recusa do cliente sai do orçamento e fica guardado no histórico de auditoria.";
  return null;
}

/* ---------- records: projects, products and companies ---------- */

/*
 * When a project, product/service or company may be deleted for good. Pure
 * (no database, no server code), so pages can hide the option, the server
 * actions refuse with the same rule, and tests import it directly. Who may
 * delete (Anuntech staff) is checked by each action; these only say whether
 * what points at the record allows it.
 */

/** Records that point at a project, product or service and keep it from being deleted. */
export type EngagementLinks = {
  invoices: number;
  /** Recurrences pointing at it, plus the one it points at, if any. */
  subscriptions: number;
  contracts: number;
};

/** Records that point at a company and keep it from being deleted. */
export type CompanyLinks = EngagementLinks & { quotes: number };

export const ENGAGEMENT_DELETE_REFUSAL =
  "Tem faturas ou contratos ligados; arquive ou conclua em vez de excluir.";
export const COMPANY_DELETE_REFUSAL =
  "Tem faturas, contratos ou orçamentos; arquive em vez de excluir.";

const none = (counts: number[]) => counts.every((n) => n === 0);

/**
 * Money and signatures keep their record: a project, product or service goes
 * only when no invoice, recurrence or contract points at it. Unknown links
 * (not loaded) never allow it.
 */
export function canDeleteEngagement(links: EngagementLinks | null | undefined) {
  return !!links && none([links.invoices, links.subscriptions, links.contracts]);
}

/** A company goes only when it never had an invoice, recurrence, contract or proposal. */
export function canDeleteCompany(links: CompanyLinks | null | undefined) {
  return (
    !!links &&
    none([links.invoices, links.subscriptions, links.contracts, links.quotes])
  );
}
