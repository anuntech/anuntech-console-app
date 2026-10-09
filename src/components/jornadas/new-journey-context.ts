import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { companies, quotes, tickets } from "@/db/schema";
import { db } from "@/lib/db";
import { quoteNumberLabel } from "@/lib/quotes/quote-model";
import { journeyStaff } from "@/lib/journeys/journey-queries";
import type { NewJourneyContext } from "./new-journey";

const uuid = (value: unknown) => (typeof value === "string" && /^[0-9a-f-]{36}$/.test(value) ? value : "");

/** What the form starts with: `?companyId=`, `?orcamento=` (a proposal) or `?chamado=` (a request), and `?titulo=`. */
export async function newJourneyContext(params: Record<string, string | string[] | undefined>, me: string): Promise<NewJourneyContext> {
  const [list, staff, [quote], [ticket]] = await Promise.all([
    db.select({ id: companies.id, name: companies.name, document: companies.document }).from(companies).where(eq(companies.archived, false)).orderBy(asc(companies.name)),
    journeyStaff(),
    uuid(params.orcamento)
      ? db.select({ id: quotes.id, title: quotes.title, companyId: quotes.companyId, year: quotes.year, seq: quotes.seq, ticketId: quotes.ticketId }).from(quotes).where(eq(quotes.id, uuid(params.orcamento)))
      : Promise.resolve([]),
    uuid(params.chamado)
      ? db.select({ id: tickets.id, subject: tickets.subject, companyId: tickets.companyId }).from(tickets).where(and(eq(tickets.id, uuid(params.chamado))))
      : Promise.resolve([]),
  ]);
  const companyId = quote?.companyId ?? ticket?.companyId ?? (list.some((c) => c.id === uuid(params.companyId)) ? uuid(params.companyId) : "");
  const title = typeof params.titulo === "string" ? params.titulo.slice(0, 160) : quote?.title ?? ticket?.subject ?? "";
  return {
    companies: list,
    staff,
    me,
    companyId,
    quote: quote ? { id: quote.id, label: `${quoteNumberLabel(quote.year, quote.seq)} · ${quote.title}` } : null,
    ticket: ticket && (!quote || quote.companyId === ticket.companyId) ? { id: ticket.id, label: ticket.subject } : null,
    title,
  };
}
