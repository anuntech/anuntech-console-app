import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { auditEvents, billingNotices, companies, invoices, user } from "@/db/schema";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { currency, dateLabel } from "../format";
import { daysOverdue } from "./billing-notice-rules";
import { paymentUrl } from "./payment-link";
import { addDays } from "./recurrence";
import { governingTerms, snapshotOf } from "../service-terms/terms";
import { visibleToClient } from "../service-terms/ticket-clock";
import { suspensionFollowUp } from "../suspensions/suspensions";
import { companyDisplayName } from "../companies/display-name";

/*
 * Overdue clients, for the team: the automatic reminders stop on the 25th
 * day, and from there the collection is a person's. Per company: what is
 * owed, how late, the last notice that went out, what the contract allows
 * (suspension) and what was agreed in the last contact. A promise to pay
 * takes the company off the queue until its date. Nothing here is sent.
 */

/** The day the automatic reminders stop (billing-notice-rules.ts). */
export const REMINDERS_END_DAY = 25;

export type CollectionCase = {
  companyId: string;
  company: string;
  /** The CNPJ or CPF, so a MEI's name is shown without the number. */
  companyDocument: string;
  /** An archived client still owing: the service ended, the money did not. */
  archived: boolean;
  invoices: { id: string; description: string; amountCents: number; dueDate: string; days: number; link: string | null }[];
  totalCents: number;
  oldestDays: number;
  /** From the conditions the client can read: suspension after these days, with notice or not, and the clause. */
  suspension: { days: number; notice: boolean; clause: string | null } | null;
  canSuspend: boolean;
  lastNotice: { at: string; channel: string; status: string } | null;
  contact: { at: string; note: string; promiseDate: string | null; who: string } | null;
  /** A promise to pay still ahead: off the queue until then. */
  waitingPromise: boolean;
  /** The text the team adapts and sends by WhatsApp or e-mail. */
  message: string;
};

export async function collectionQueue(today = saoPauloDate()): Promise<CollectionCase[]> {
  const overdue = await db
    .select({
      id: invoices.id,
      companyId: invoices.companyId,
      company: companies.name,
      companyDocument: companies.document,
      description: invoices.description,
      amountCents: invoices.amountCents,
      dueDate: invoices.dueDate,
      publicId: invoices.publicId,
      publicEnabled: invoices.publicEnabled,
      archived: companies.archived,
    })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .where(
      and(
        eq(invoices.status, "issued"),
        // Late only once the boleto stops being payable (a charge billed again carries a later date to pay).
        sql`coalesce(${invoices.bankDueDate}, ${invoices.dueDate}) < ${today}`,
        // Marked as received at Inter: the team confirms it on the invoice; nobody asks the client to pay it.
        or(isNull(invoices.bankStatus), ne(invoices.bankStatus, "MARCADO_RECEBIDO")),
      ),
    )
    .orderBy(asc(invoices.dueDate));
  if (!overdue.length) return [];
  const ids = overdue.map((i) => i.id);
  const companyIds = [...new Set(overdue.map((i) => i.companyId))];
  const [notices, contacts] = await Promise.all([
    db
      .select({ invoiceId: billingNotices.invoiceId, channel: billingNotices.channel, status: billingNotices.status, at: billingNotices.firstAttemptAt })
      .from(billingNotices)
      .where(and(inArray(billingNotices.invoiceId, ids), inArray(billingNotices.status, ["accepted", "delivered"])))
      .orderBy(desc(billingNotices.firstAttemptAt)),
    db
      .select({ companyId: auditEvents.companyId, details: auditEvents.details, at: auditEvents.createdAt, who: user.name, email: user.email })
      .from(auditEvents)
      .innerJoin(user, eq(user.id, auditEvents.actorId))
      .where(and(eq(auditEvents.action, "collection.contact"), inArray(auditEvents.companyId, companyIds)))
      .orderBy(desc(auditEvents.createdAt)),
  ]);
  const now = new Date();
  const cases: CollectionCase[] = [];
  for (const companyId of companyIds) {
    const rows = overdue.filter((i) => i.companyId === companyId);
    const company = rows[0].company;
    const companyDocument = rows[0].companyDocument;
    const archived = rows[0].archived;
    const list = rows.map((i) => ({
      id: i.id,
      description: i.description,
      amountCents: i.amountCents,
      dueDate: i.dueDate,
      days: daysOverdue(i.dueDate, today),
      link: i.publicEnabled && i.publicId ? paymentUrl(i.publicId) : null,
    }));
    const totalCents = list.reduce((sum, i) => sum + i.amountCents, 0);
    const oldestDays = Math.max(...list.map((i) => i.days));
    const terms = snapshotOf(await governingTerms(companyId, null));
    const policy = terms && visibleToClient(terms, now) ? terms.policy : null;
    const suspension = policy?.suspensionDays ? { days: policy.suspensionDays, notice: !!policy.suspensionNotice, clause: policy.clauses.suspension ?? null } : null;
    const canSuspend = !archived && !!suspension && oldestDays > suspension.days;
    const notice = notices.find((n) => rows.some((r) => r.id === n.invoiceId));
    const last = contacts.find((c) => c.companyId === companyId);
    const details = (last?.details ?? {}) as { note?: string; promiseDate?: string | null };
    const contact = last ? { at: last.at.toISOString(), note: details.note ?? "", promiseDate: details.promiseDate ?? null, who: last.who || last.email } : null;
    const waitingPromise = !!contact?.promiseDate && contact.promiseDate >= today;
    const what =
      list.length === 1
        ? `a fatura "${list[0].description}", vencida em ${dateLabel(list[0].dueDate)}, de ${currency(list[0].amountCents)}`
        : `${list.length} faturas vencidas desde ${dateLabel(list[0].dueDate)}, no total de ${currency(totalCents)}`;
    const links = list.filter((i) => i.link).map((i) => `${i.description}: ${i.link}`);
    // The suspension sentence is the one the client reads in the published conditions, nothing beyond it.
    const message = [
      `Olá, tudo bem? ${list.length === 1 ? "Consta" : "Constam"} em aberto ${what}, da ${companyDisplayName(company, companyDocument)}.`,
      links.length ? `Você pode pagar com boleto ou Pix por aqui:\n${links.join("\n")}` : "Você pode pagar com boleto ou Pix pelo Console, em Financeiro.",
      canSuspend
        ? `Pelas condições do contrato${suspension!.clause ? ` (cláusula ${suspension!.clause})` : ""}, com mais de ${suspension!.days} dias de atraso o serviço pode ser suspenso ${suspension!.notice ? "depois de um aviso" : "até o pagamento"}.`
        : null,
      "Se já pagou ou precisa combinar uma data, me responda por aqui.",
    ]
      .filter(Boolean)
      .join("\n\n");
    cases.push({ companyId, company, companyDocument, archived, invoices: list, totalCents, oldestDays, suspension, canSuspend, lastNotice: notice ? { at: notice.at?.toISOString() ?? "", channel: notice.channel, status: notice.status } : null, contact, waitingPromise, message });
  }
  return cases.sort((a, b) => b.oldestDays - a.oldestDays);
}

/** Charges Inter shows as marked received (outside the boleto): the team confirms each on its invoice. */
export async function markedReceived() {
  return db
    .select({ id: invoices.id, description: invoices.description, company: companies.name, companyDocument: companies.document, amountCents: invoices.amountCents, dueDate: invoices.dueDate })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .where(and(eq(invoices.status, "issued"), eq(invoices.bankStatus, "MARCADO_RECEBIDO")))
    .orderBy(asc(invoices.dueDate));
}

/** For the digest and the Painel: clients past the automatic reminders, with no promise ahead; charges Inter shows as marked received. */
export async function collectionFollowUp(today = saoPauloDate()) {
  const [queue, marked, suspensions, fiscal] = await Promise.all([
    collectionQueue(today),
    markedReceived(),
    suspensionFollowUp(today),
    // Paid by clients set to get an invoice (NFS-e): the queue to issue by hand until Focus is connected.
    db
      .select({ id: invoices.id, description: invoices.description, company: companies.name, companyDocument: companies.document, amountCents: invoices.amountCents })
      .from(invoices)
      .innerJoin(companies, eq(companies.id, invoices.companyId))
      // Paid in the last 60 days (a charge billed again is paid long after its due date); older ones were settled before this list existed.
      .where(
        and(
          eq(invoices.status, "paid"),
          eq(companies.autoIssueNfse, true),
          inArray(invoices.fiscalStatus, ["not_requested", "error"]),
          or(
            gte(invoices.dueDate, addDays(today, -60)),
            sql`exists (select 1 from ${auditEvents} a where a.entity_id = ${invoices.id} and a.created_at >= now() - interval '60 days'
              and (a.action = 'invoice.paid_outside' or (a.action = 'invoice.bank_checked' and a.details->>'status' = 'RECEBIDO')))`,
          ),
        ),
      ),
  ]);
  const cases = queue.filter((c) => c.oldestDays > REMINDERS_END_DAY && !c.waitingPromise);
  const groups = [
    ...suspensions,
    {
      key: "marked-received",
      title: "Marcadas como recebidas no Inter, fora do boleto: confirme o pagamento",
      items: marked.map((i) => ({ line: `${companyDisplayName(i.company, i.companyDocument)} · ${i.description} · ${currency(i.amountCents)}`, href: `/financeiro/${i.id}` })),
    },
    {
      key: "fiscal-queue",
      title: "Notas fiscais a emitir (clientes com nota automática, faturas pagas); emitida por fora, registre na fatura",
      items: fiscal.map((i) => ({ line: `${companyDisplayName(i.company, i.companyDocument)} · ${i.description} · ${currency(i.amountCents)}`, href: `/financeiro/${i.id}` })),
    },
  ].filter((group) => group.items.length);
  return cases.length
    ? [
        ...groups,
        {
          key: "collections",
          title: `Clientes com atraso de mais de ${REMINDERS_END_DAY} dias, sem data de pagamento combinada`,
          items: cases.map((c) => ({
            line: `${companyDisplayName(c.company, c.companyDocument)} · ${currency(c.totalCents)} · ${c.oldestDays} dias${c.archived ? " · cliente arquivado" : c.canSuspend ? ` · suspensão possível ${c.suspension!.notice ? "depois de um aviso" : "até o pagamento"}` : ""}`,
            href: "/financeiro/atrasos",
          })),
        },
      ]
    : groups;
}
