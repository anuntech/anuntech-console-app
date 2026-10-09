import "server-only";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { contractSignatures, engagements, journeySteps, journeys, quotes, subscriptions, tasks, tickets } from "@/db/schema";
import { db } from "../db";
import { companySetupFacts } from "../companies/onboarding";
import { quoteLinks } from "../quotes/quote-links";
import { quoteNumberLabel, quoteTotals } from "../quotes/quote-model";
import { saoPauloDate } from "../dates";
import { emptyFacts, journeyBriefingSchema, type JourneyBriefing, type JourneyFacts, type StoredStep } from "./journey-model";

/*
 * What the Console already knows about a journey's records, for the steps
 * that tick themselves. Read only.
 */

export type JourneyRow = typeof journeys.$inferSelect;

/** The saved briefing, or null; a briefing saved by an older shape reads with its defaults. */
export function readBriefing(raw: unknown): JourneyBriefing | null {
  if (!raw) return null;
  const parsed = journeyBriefingSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Cards the proposal adds to every board ("Acessos" and "Reunião de início", in quote-handoff.ts), done or not. */
async function boardFacts(engagementId: string) {
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
      review: sql<number>`count(*) filter (where ${tasks.status} = 'review')::int`,
      access: sql<boolean>`bool_or(${tasks.status} = 'done' and lower(${tasks.title}) = 'acessos')`,
      kickoff: sql<boolean>`bool_or(${tasks.status} = 'done' and lower(${tasks.title}) = 'reunião de início')`,
    })
    .from(tasks)
    .where(eq(tasks.engagementId, engagementId));
  return {
    total: counts?.total ?? 0,
    done: counts?.done ?? 0,
    review: counts?.review ?? 0,
    accessDone: !!counts?.access,
    kickoffDone: !!counts?.kickoff,
  };
}

export async function journeyFacts(journey: JourneyRow): Promise<JourneyFacts> {
  const facts = emptyFacts();
  const today = saoPauloDate();
  const [setup, [quote], [ticket]] = await Promise.all([
    journey.companyId ? companySetupFacts(journey.companyId) : null,
    journey.quoteId ? db.select().from(quotes).where(eq(quotes.id, journey.quoteId)) : Promise.resolve([]),
    journey.ticketId
      ? db.select({ id: tickets.id, subject: tickets.subject, status: tickets.status }).from(tickets).where(eq(tickets.id, journey.ticketId))
      : Promise.resolve([]),
  ]);
  if (setup)
    facts.company = {
      id: setup.company.id,
      name: setup.company.name,
      archived: setup.company.archived,
      billingReady: setup.billingReady,
      manager: setup.manager,
      managerSignedIn: setup.managerSignedIn,
      terms: setup.terms,
    };
  if (ticket) facts.ticket = ticket;
  let projectId = journey.engagementId;
  if (quote) {
    // A proposal taken back to draft keeps its old publication; the draft being edited is what counts.
    const content = quote.status !== "draft" && quote.publication ? quote.publication : quote.content;
    const totals = quoteTotals(content);
    facts.quote = {
      id: quote.id,
      number: quoteNumberLabel(quote.year, quote.seq),
      title: quote.title,
      status: quote.status,
      phases: totals.phases,
      tasks: totals.tasks,
      // What sending asks for (quote-actions.ts sendQuote).
      complete: content.phases.length > 0 && content.hourlyRateCents > 0 && !!quote.validUntil && quote.validUntil >= today,
      upfrontCents: totals.upfrontCents,
      balanceCents: totals.balanceCents,
      validUntil: quote.validUntil,
      publishedAt: quote.publishedAt?.toISOString() ?? null,
      decidedAt: quote.decidedAt?.toISOString() ?? null,
    };
    const links = await quoteLinks(quote);
    if (!facts.ticket && links.ticket) facts.ticket = links.ticket;
    if (links.contract) {
      const [client] = links.contract.documentHash
        ? await db
            .select({ id: contractSignatures.id })
            .from(contractSignatures)
            .where(
              and(
                eq(contractSignatures.contractId, links.contract.id),
                eq(contractSignatures.party, "client"),
                eq(contractSignatures.documentHash, links.contract.documentHash),
              ),
            )
            .limit(1)
        : [];
      facts.contract = {
        id: links.contract.id,
        title: links.contract.title,
        status: links.contract.status,
        signedAt: links.contract.signedAt?.toISOString() ?? null,
        clientSigned: !!client,
      };
    }
    facts.upfront = links.upfront;
    facts.balance = links.balance;
    projectId ??= links.project?.id ?? null;
  }
  const [project, hosting] = await Promise.all([
    projectId
      ? db
          .select({ id: engagements.id, name: engagements.name, status: engagements.status, url: engagements.url })
          .from(engagements)
          .where(eq(engagements.id, projectId))
          .then((rows) => rows[0] ?? null)
      : null,
    journey.hostingEngagementId
      ? db
          .select({ id: engagements.id, name: engagements.name, subscriptionId: engagements.subscriptionId })
          .from(engagements)
          .where(eq(engagements.id, journey.hostingEngagementId))
          .then((rows) => rows[0] ?? null)
      : null,
  ]);
  if (project) facts.project = { ...project, ...(await boardFacts(project.id)) };
  if (hosting) {
    // Linked either way: the catalog writes engagements.subscription_id, Nova cobrança only subscriptions.engagement_id.
    const [sub] = await db
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(or(hosting.subscriptionId ? eq(subscriptions.id, hosting.subscriptionId) : sql`false`, eq(subscriptions.engagementId, hosting.id)))
      .orderBy(sql`case ${subscriptions.status} when 'active' then 0 when 'paused' then 1 when 'draft' then 2 else 3 end`)
      .limit(1);
    facts.hosting = { id: hosting.id, name: hosting.name, subscription: sub?.status ?? null };
  }
  return facts;
}

const stored = (row: typeof journeySteps.$inferSelect): StoredStep => ({
    key: row.key,
    title: row.title,
    stage: row.stage,
    status: row.status,
    note: row.note,
    url: row.url,
    value: row.value,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    assigneeId: row.assigneeId,
    doneBy: row.doneBy,
    doneAt: row.doneAt?.toISOString() ?? null,
    aiText: row.aiDraft?.text ?? null,
  });

/** The journey's marked steps, in the shape the model resolves. */
export async function journeyRows(journeyId: string): Promise<StoredStep[]> {
  const rows = await db.select().from(journeySteps).where(eq(journeySteps.journeyId, journeyId)).orderBy(asc(journeySteps.createdAt));
  return rows.map(stored);
}

/** Journeys of several ids at once, for the list (facts per journey, in parallel). */
export async function journeysFacts(rows: JourneyRow[]) {
  return new Map(await Promise.all(rows.map(async (row) => [row.id, await journeyFacts(row)] as const)));
}

/** Rows of several journeys at once, for the list. */
export async function journeysRows(ids: string[]) {
  const rows = ids.length ? await db.select().from(journeySteps).where(inArray(journeySteps.journeyId, ids)) : [];
  const byJourney = new Map<string, StoredStep[]>();
  for (const row of rows) {
    const list = byJourney.get(row.journeyId) ?? [];
    list.push(stored(row));
    byJourney.set(row.journeyId, list);
  }
  return byJourney;
}
