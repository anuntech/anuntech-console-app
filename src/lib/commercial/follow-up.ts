import "server-only";
import { and, asc, eq, gte, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { companies, contractSignatures, contracts, engagements, memberships, quotes, subscriptions, tasks } from "@/db/schema";
import { governingTerms, loadCalendar, snapshotOf } from "../service-terms/terms";
import { addBusinessMinutes } from "../service-terms/business-calendar";
import { BUSINESS_DAY_MINUTES } from "../service-terms/terms-model";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { dateLabel } from "../format";
import { addDays } from "../billing/recurrence";
import { quoteNumberLabel } from "../quotes/quote-model";
import { mapLimit, READ_LANES } from "../concurrency";

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
  const [expiring, expired, noValidity, acceptedAlone, stalled, awaitingUs, backlog, reviews, noManager, problems] = await Promise.all([
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
          sql`not exists (select 1 from ${contracts} c where c.status <> 'cancelled' and (c.quote_id = ${quotes.id} or (c.quote_id is null and c.kind = 'contract' and c.company_id = ${quotes.companyId} and c.created_at >= ${quotes.decidedAt})))`,
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
    // Deliveries in Revisão; the test window of the conditions that govern each project is applied below, in business days.
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        project: engagements.name,
        projectId: engagements.id,
        companyId: tasks.companyId,
        company: companies.name,
        reviewSince: tasks.reviewSince,
      })
      .from(tasks)
      .innerJoin(engagements, eq(engagements.id, tasks.engagementId))
      .innerJoin(companies, eq(companies.id, tasks.companyId))
      .where(and(eq(tasks.status, "review"), isNotNull(tasks.reviewSince)))
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
    // The client pointed out a problem in a delivery this week and the card is still back in progress.
    db
      .select({ id: tasks.id, title: tasks.title, project: engagements.name, projectId: engagements.id, company: companies.name })
      .from(tasks)
      .innerJoin(engagements, eq(engagements.id, tasks.engagementId))
      .innerJoin(companies, eq(companies.id, tasks.companyId))
      .where(
        and(
          eq(tasks.status, "in_progress"),
          sql`exists (select 1 from console_audit_events a where a.entity_id = ${tasks.id} and a.action = 'task.review_failed' and a.created_at >= now() - interval '7 days')`,
        ),
      )
      .orderBy(asc(tasks.updatedAt)),
  ]);
  // The board's own rule (projetos/[id]/page.tsx): the conditions that govern the project, never for a person client.
  const now = new Date();
  const calendar = reviews.length ? await loadCalendar() : null;
  // One read of the conditions per project, a few side by side.
  const projects = [...new Map(reviews.map((task) => [task.projectId, task.companyId])).entries()];
  const governing = await mapLimit(projects, READ_LANES, ([projectId, companyId]) => governingTerms(companyId, projectId));
  const windows = new Map<string, number | null>(
    projects.map(([projectId], i) => {
      const terms = snapshotOf(governing[i]);
      return [projectId, terms && !terms.personClient ? (terms.policy.testDays ?? null) : null];
    }),
  );
  const overdueReviews: (typeof reviews[number] & { testDays: number })[] = [];
  for (const task of reviews) {
    const testDays = windows.get(task.projectId);
    if (testDays && calendar && addBusinessMinutes(task.reviewSince!, testDays * BUSINESS_DAY_MINUTES, calendar) < now)
      overdueReviews.push({ ...task, testDays });
  }
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
      key: "review-problems",
      title: "Problemas apontados pelo cliente em entregas",
      items: problems.map((t) => ({ line: `${t.company} · ${t.project} · ${t.title}`, href: `/projetos/${t.projectId}` })),
    },
    {
      key: "reviews-overdue",
      title: "Entregas em Revisão com o prazo de teste vencido",
      items: overdueReviews.map((t) => ({
        line: `${t.company} · ${t.project} · ${t.title} · ${t.testDays === 1 ? "1 dia útil" : `${t.testDays} dias úteis`} de teste`,
        href: `/projetos/${t.projectId}`,
      })),
    },
  ];
  return groups.filter((group) => group.items.length);
}
