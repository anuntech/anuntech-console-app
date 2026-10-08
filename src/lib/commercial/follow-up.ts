import "server-only";
import { and, asc, eq, gte, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { companies, contractSignatures, contracts, engagements, memberships, quotes, serviceTerms, subscriptions, tasks } from "@/db/schema";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { dateLabel } from "../format";
import { addDays } from "../billing/recurrence";
import { quoteNumberLabel } from "../quotes/quote-model";

/*
 * Sales and project work that waits on someone, for the morning digest and
 * the team's overview. Read only: it lists and links, nothing goes to the
 * client. The limits are choices, kept here to revise in one place.
 */
export const FOLLOW_UP = {
  /** A proposal without an answer this close to its validity. */
  quoteExpiringDays: 3,
  /** Expired proposals still worth a call. */
  quoteExpiredWindowDays: 30,
  /** A proposal sent with no validity date, still unanswered. */
  quoteNoValidityDays: 14,
  /** Accepted, and no contract yet. */
  acceptedNoContractDays: 3,
  /** Sent for signature, and the client has not signed. */
  contractStalledDays: 7,
  /** A client's request still in the Backlog. */
  backlogDays: 2,
} as const;

export type FollowUpItem = { line: string; href: string };
export type FollowUpGroup = { key: string; title: string; items: FollowUpItem[] };

const ago = (days: number) => sql`now() - make_interval(days => ${days})`;
const quoteLabel = (q: { year: number; seq: number; title: string }) => `Orçamento ${quoteNumberLabel(q.year, q.seq)} · ${q.title}`;

export async function commercialFollowUp(today = saoPauloDate()): Promise<FollowUpGroup[]> {
  const [expiring, expired, noValidity, acceptedAlone, stalled, awaitingUs, backlog, reviews, noManager] = await Promise.all([
    db
      .select({ id: quotes.id, year: quotes.year, seq: quotes.seq, title: quotes.title, company: companies.name, validUntil: quotes.validUntil })
      .from(quotes)
      .innerJoin(companies, eq(companies.id, quotes.companyId))
      .where(and(eq(quotes.status, "sent"), gte(quotes.validUntil, today), lte(quotes.validUntil, addDays(today, FOLLOW_UP.quoteExpiringDays))))
      .orderBy(asc(quotes.validUntil)),
    db
      .select({ id: quotes.id, year: quotes.year, seq: quotes.seq, title: quotes.title, company: companies.name, validUntil: quotes.validUntil })
      .from(quotes)
      .innerJoin(companies, eq(companies.id, quotes.companyId))
      .where(and(eq(quotes.status, "sent"), lt(quotes.validUntil, today), gte(quotes.validUntil, addDays(today, -FOLLOW_UP.quoteExpiredWindowDays))))
      .orderBy(asc(quotes.validUntil)),
    db
      .select({ id: quotes.id, year: quotes.year, seq: quotes.seq, title: quotes.title, company: companies.name, sentAt: quotes.publishedAt })
      .from(quotes)
      .innerJoin(companies, eq(companies.id, quotes.companyId))
      .where(and(eq(quotes.status, "sent"), isNull(quotes.validUntil), lt(quotes.publishedAt, ago(FOLLOW_UP.quoteNoValidityDays))))
      .orderBy(asc(quotes.publishedAt)),
    // A contract counts when it formalizes this proposal, or was created for the company after the acceptance.
    db
      .select({ id: quotes.id, year: quotes.year, seq: quotes.seq, title: quotes.title, company: companies.name, decidedAt: quotes.decidedAt })
      .from(quotes)
      .innerJoin(companies, eq(companies.id, quotes.companyId))
      .where(
        and(
          eq(quotes.status, "accepted"),
          lt(quotes.decidedAt, ago(FOLLOW_UP.acceptedNoContractDays)),
          gte(quotes.decidedAt, ago(90)),
          sql`not exists (select 1 from ${contracts} c where c.status <> 'cancelled' and (c.quote_id = ${quotes.id} or (c.company_id = ${quotes.companyId} and c.created_at >= ${quotes.decidedAt})))`,
        ),
      )
      .orderBy(asc(quotes.decidedAt)),
    db
      .select({ id: contracts.id, title: contracts.title, company: companies.name, sentAt: contracts.publishedAt })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .where(
        and(
          eq(contracts.status, "sent"),
          lt(contracts.publishedAt, ago(FOLLOW_UP.contractStalledDays)),
          sql`not exists (select 1 from ${contractSignatures} s where s.contract_id = ${contracts.id} and s.document_hash = ${contracts.documentHash} and s.party = 'client')`,
        ),
      )
      .orderBy(asc(contracts.publishedAt)),
    db
      .select({ id: contracts.id, title: contracts.title, company: companies.name, signedAt: contractSignatures.signedAt })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .innerJoin(
        contractSignatures,
        and(eq(contractSignatures.contractId, contracts.id), eq(contractSignatures.documentHash, contracts.documentHash), eq(contractSignatures.party, "client")),
      )
      .where(
        and(
          eq(contracts.status, "sent"),
          sql`not exists (select 1 from ${contractSignatures} s where s.contract_id = ${contracts.id} and s.document_hash = ${contracts.documentHash} and s.party = 'anuntech')`,
        ),
      )
      .orderBy(asc(contractSignatures.signedAt)),
    db
      .select({ id: tasks.id, title: tasks.title, project: engagements.name, projectId: engagements.id, company: companies.name, createdAt: tasks.createdAt })
      .from(tasks)
      .innerJoin(engagements, eq(engagements.id, tasks.engagementId))
      .innerJoin(companies, eq(companies.id, tasks.companyId))
      .where(and(eq(tasks.requested, true), eq(tasks.status, "backlog"), lt(tasks.createdAt, ago(FOLLOW_UP.backlogDays))))
      .orderBy(asc(tasks.createdAt)),
    // Deliveries waiting longer than the test window the company's confirmed conditions give the client.
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        project: engagements.name,
        projectId: engagements.id,
        company: companies.name,
        reviewSince: tasks.reviewSince,
        testDays: sql<number>`(${serviceTerms.policy}->>'testDays')::int`,
      })
      .from(tasks)
      .innerJoin(engagements, eq(engagements.id, tasks.engagementId))
      .innerJoin(companies, eq(companies.id, tasks.companyId))
      .innerJoin(
        serviceTerms,
        and(
          eq(serviceTerms.companyId, tasks.companyId),
          eq(serviceTerms.active, true),
          isNotNull(serviceTerms.verifiedAt),
          sql`(${serviceTerms.engagementId} is null or ${serviceTerms.engagementId} = ${tasks.engagementId})`,
          sql`(${serviceTerms.policy}->>'testDays') is not null`,
        ),
      )
      .where(
        and(
          eq(tasks.status, "review"),
          isNotNull(tasks.reviewSince),
          sql`${tasks.reviewSince} < now() - make_interval(days => (${serviceTerms.policy}->>'testDays')::int)`,
        ),
      )
      .orderBy(asc(tasks.reviewSince)),
    // Only an Administrador signs, answers a proposal or sees the invoices: a client with something open and nobody to act on it.
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(
        and(
          eq(companies.archived, false),
          sql`not exists (select 1 from ${memberships} m where m.company_id = ${companies.id} and m.role = 'manager' and m.active)`,
          sql`(exists (select 1 from ${contracts} c where c.company_id = ${companies.id} and c.status in ('sent', 'in_review'))
            or exists (select 1 from ${quotes} q where q.company_id = ${companies.id} and q.status = 'sent')
            or exists (select 1 from ${subscriptions} s where s.company_id = ${companies.id} and s.status = 'active'))`,
        ),
      )
      .orderBy(asc(companies.name)),
  ]);
  const seenReview = new Set<string>();
  const groups: FollowUpGroup[] = [
    {
      key: "awaiting-anuntech",
      title: "Assinados pelo cliente, falta a Anuntech",
      items: awaitingUs.map((c) => ({ line: `${c.company} · ${c.title}`, href: `/contratos/${c.id}` })),
    },
    {
      key: "no-manager",
      title: "Clientes sem Administrador no Console",
      items: noManager.map((c) => ({ line: `${c.name} · ninguém para assinar, responder ou ver as faturas`, href: `/empresas/${c.id}` })),
    },
    {
      key: "quotes-expiring",
      title: `Orçamentos sem resposta que vencem em até ${FOLLOW_UP.quoteExpiringDays} dias`,
      items: expiring.map((q) => ({ line: `${q.company} · ${quoteLabel(q)} · vale até ${dateLabel(q.validUntil!)}`, href: `/orcamentos/${q.id}` })),
    },
    {
      key: "quotes-expired",
      title: "Orçamentos que expiraram sem resposta",
      items: expired.map((q) => ({ line: `${q.company} · ${quoteLabel(q)} · expirou em ${dateLabel(q.validUntil!)}`, href: `/orcamentos/${q.id}` })),
    },
    {
      key: "quotes-no-validity",
      title: `Orçamentos sem validade e sem resposta há mais de ${FOLLOW_UP.quoteNoValidityDays} dias`,
      items: noValidity.map((q) => ({ line: `${q.company} · ${quoteLabel(q)}`, href: `/orcamentos/${q.id}` })),
    },
    {
      key: "accepted-no-contract",
      title: "Orçamentos aceitos sem contrato",
      items: acceptedAlone.map((q) => ({ line: `${q.company} · ${quoteLabel(q)}`, href: `/orcamentos/${q.id}` })),
    },
    {
      key: "contracts-stalled",
      title: `Contratos sem assinatura do cliente há mais de ${FOLLOW_UP.contractStalledDays} dias`,
      items: stalled.map((c) => ({ line: `${c.company} · ${c.title}`, href: `/contratos/${c.id}` })),
    },
    {
      key: "backlog-requests",
      title: "Pedidos do cliente parados no Backlog",
      items: backlog.map((t) => ({ line: `${t.company} · ${t.project} · ${t.title}`, href: `/projetos/${t.projectId}` })),
    },
    {
      key: "reviews-overdue",
      title: "Entregas em Revisão com o prazo de teste vencido",
      items: reviews
        .filter((t) => !seenReview.has(t.id) && !!seenReview.add(t.id))
        .map((t) => ({ line: `${t.company} · ${t.project} · ${t.title} · ${t.testDays === 1 ? "1 dia" : `${t.testDays} dias`} de teste`, href: `/projetos/${t.projectId}` })),
    },
  ];
  return groups.filter((group) => group.items.length);
}
