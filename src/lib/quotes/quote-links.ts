import "server-only";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { automationEvents, contracts, engagements, invoices, tickets } from "@/db/schema";
import { db } from "../db";

/**
 * What an accepted proposal already became: its contract (the latest that
 * is not cancelled), the project built from it, the down payment and balance
 * charges (prepared from it, found through their automation events) and the
 * request it answers. The quote page and the project journey read it here.
 */
export async function quoteLinks(quote: { id: string; status: string; ticketId: string | null }) {
  const accepted = quote.status === "accepted";
  const [[contract], [project], charges, [ticket]] = await Promise.all([
    accepted
      ? db
          .select({ id: contracts.id, title: contracts.title, status: contracts.status, signedAt: contracts.signedAt, documentHash: contracts.documentHash })
          .from(contracts)
          .where(and(eq(contracts.quoteId, quote.id), ne(contracts.status, "cancelled")))
          .orderBy(desc(contracts.createdAt))
          .limit(1)
      : Promise.resolve([]),
    accepted
      ? db
          .select({ id: engagements.id, name: engagements.name, status: engagements.status, url: engagements.url })
          .from(engagements)
          .where(eq(engagements.quoteId, quote.id))
          .limit(1)
      : Promise.resolve([]),
    accepted
      ? db
          .select({ kind: automationEvents.kind, details: automationEvents.details })
          .from(automationEvents)
          .where(and(eq(automationEvents.entityId, quote.id), inArray(automationEvents.kind, ["quote.upfront", "quote.balance"])))
      : Promise.resolve([]),
    quote.ticketId
      ? db.select({ id: tickets.id, subject: tickets.subject, status: tickets.status }).from(tickets).where(eq(tickets.id, quote.ticketId))
      : Promise.resolve([]),
  ]);
  const invoiceOf = (kind: string) => String(charges.find((c) => c.kind === kind)?.details?.invoiceId ?? "") || null;
  const upfrontInvoiceId = invoiceOf("quote.upfront");
  const balanceInvoiceId = invoiceOf("quote.balance");
  const ids = [upfrontInvoiceId, balanceInvoiceId].filter((id): id is string => !!id);
  const states = ids.length
    ? await db.select({ id: invoices.id, status: invoices.status, amountCents: invoices.amountCents }).from(invoices).where(inArray(invoices.id, ids))
    : [];
  const invoice = (id: string | null) => states.find((row) => row.id === id) ?? null;
  return {
    contract: contract ?? null,
    project: project ?? null,
    upfrontInvoiceId,
    balanceInvoiceId,
    upfront: invoice(upfrontInvoiceId),
    balance: invoice(balanceInvoiceId),
    ticket: ticket ?? null,
  };
}
