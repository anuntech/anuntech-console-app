import "server-only";
import { and, desc, eq, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { automationEvents, companies, contracts, invoices, quotes, tickets } from "@/db/schema";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "../db";
import { validDocument } from "./contact-quality";

/*
 * Records that look like tests (QA runs in production), for the team to
 * delete one by one with the screens' own rules: children first, the
 * company last. "Não é teste" keeps an item off the list for good.
 */

const TEST = sql`'(^|[^a-z])(teste?s?|qa|exemplo|example|demo|fake|dummy)([^a-z]|$)'`;
const looksTest = (column: AnyPgColumn) => sql`lower(${column}) ~ ${TEST}`;

export type CleanupItem = {
  id: string;
  kind: "company" | "ticket" | "invoice" | "contract" | "quote";
  label: string;
  detail: string;
  href: string;
  /** The company's CNPJ or CPF (the item's own, or its owner's), so a MEI's name is shown without the number. */
  document: string;
};

export async function cleanupCandidates(): Promise<CleanupItem[]> {
  const kept = db.select({ id: automationEvents.entityId }).from(automationEvents).where(eq(automationEvents.kind, "cleanup.keep"));
  const keptIds = (await kept).map((row) => row.id);
  const notKept = (column: AnyPgColumn) => (keptIds.length ? notInArray(column, keptIds) : undefined);
  const [companyRows, ticketRows, invoiceRows, contractRows, quoteRows] = await Promise.all([
    db
      .select({ id: companies.id, name: companies.name, document: companies.document, email: companies.billingEmail })
      .from(companies)
      .where(and(notKept(companies.id), or(looksTest(companies.name), sql`lower(${companies.billingEmail}) like '%@example.%'`, sql`${companies.billingEmail} like '%.invalid'`))),
    db
      .select({ id: tickets.id, subject: tickets.subject, company: companies.name, document: companies.document })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .where(and(notKept(tickets.id), looksTest(tickets.subject)))
      .orderBy(desc(tickets.createdAt))
      .limit(100),
    // Never a paid charge: those stay as the record of money received.
    db
      .select({ id: invoices.id, description: invoices.description, company: companies.name, document: companies.document, status: invoices.status })
      .from(invoices)
      .innerJoin(companies, eq(companies.id, invoices.companyId))
      .where(and(notKept(invoices.id), ne(invoices.status, "paid"), looksTest(invoices.description)))
      .limit(100),
    db
      .select({ id: contracts.id, title: contracts.title, company: companies.name, document: companies.document, status: contracts.status })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .where(and(notKept(contracts.id), inArray(contracts.status, ["draft", "cancelled"]), looksTest(contracts.title)))
      .limit(100),
    db
      .select({ id: quotes.id, title: quotes.title, company: companies.name, document: companies.document, status: quotes.status })
      .from(quotes)
      .innerJoin(companies, eq(companies.id, quotes.companyId))
      .where(and(notKept(quotes.id), inArray(quotes.status, ["draft", "cancelled", "declined"]), looksTest(quotes.title)))
      .limit(100),
  ]);
  const invalidDocs = await db
    .select({ id: companies.id, name: companies.name, document: companies.document, email: companies.billingEmail })
    .from(companies)
    .where(and(notKept(companies.id), eq(companies.archived, false)));
  const companyList = new Map(companyRows.map((c) => [c.id, c]));
  for (const c of invalidDocs) if (!validDocument(c.document) && !companyList.has(c.id)) companyList.set(c.id, c);
  return [
    ...ticketRows.map((t) => ({ id: t.id, kind: "ticket" as const, label: t.subject, detail: `Chamado · ${t.company}`, href: `/chamados/${t.id}`, document: t.document })),
    ...invoiceRows.map((i) => ({ id: i.id, kind: "invoice" as const, label: i.description, detail: `Fatura · ${i.company}`, href: `/financeiro/${i.id}`, document: i.document })),
    ...contractRows.map((c) => ({ id: c.id, kind: "contract" as const, label: c.title, detail: `Contrato · ${c.company}`, href: `/contratos/${c.id}`, document: c.document })),
    ...quoteRows.map((q) => ({ id: q.id, kind: "quote" as const, label: q.title, detail: `Orçamento · ${q.company}`, href: `/orcamentos/${q.id}`, document: q.document })),
    ...[...companyList.values()].map((c) => ({
      id: c.id,
      kind: "company" as const,
      label: c.name,
      detail: validDocument(c.document) ? `Empresa · ${c.email}` : `Empresa · documento inválido · ${c.email}`,
      href: `/empresas/${c.id}`,
      document: c.document,
    })),
  ];
}
