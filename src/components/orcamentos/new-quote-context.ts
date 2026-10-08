import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { messages, tickets } from "@/db/schema";
import { db } from "@/lib/db";
import { accessibleCompanies, requireAdmin } from "@/lib/access/access";
import type { NewQuoteData } from "./quote-sheet";

export type NewQuoteSearchParams = Promise<{ companyId?: string; titulo?: string; chamado?: string }>;

/** Clients a proposal can be for, and a preselected one (from the company page). */
export async function newQuoteContext(searchParams: NewQuoteSearchParams): Promise<NewQuoteData> {
  const actor = await requireAdmin();
  const { companyId, titulo, chamado } = await searchParams;
  // From a client's request: the ticket stays linked and its description starts the summary.
  const [ticket] =
    chamado && /^[0-9a-f-]{36}$/.test(chamado)
      ? await db
          .select({ id: tickets.id, subject: tickets.subject, companyId: tickets.companyId })
          .from(tickets)
          .where(and(eq(tickets.id, chamado), companyId && /^[0-9a-f-]{36}$/.test(companyId) ? eq(tickets.companyId, companyId) : undefined))
      : [];
  const [first] = ticket
    ? await db.select({ body: messages.body }).from(messages).where(eq(messages.ticketId, ticket.id)).orderBy(asc(messages.createdAt)).limit(1)
    : [];
  // Archived clients stay out of the picker unless asked for by id.
  const companies = (await accessibleCompanies(actor))
    .filter((c) => !c.archived || c.id === companyId)
    .map((c) => ({ id: c.id, name: c.name, document: c.document }));
  return {
    companies,
    companyId: companies.some((c) => c.id === companyId) ? companyId : undefined,
    // From a client's request ("App ou projeto novo"): the ticket's subject as a starting title.
    title: (titulo ?? ticket?.subject)?.slice(0, 160),
    ticket: ticket && companies.some((c) => c.id === ticket.companyId) ? { id: ticket.id, subject: ticket.subject } : undefined,
    summary: ticket ? first?.body?.trim().slice(0, 4000) : undefined,
  };
}
