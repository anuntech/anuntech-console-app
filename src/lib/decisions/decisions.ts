import "server-only";
import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { auditEvents, automationEvents, companies, contracts, decisions, engagements, invoices, quotes, type DecisionStep } from "@/db/schema";
import { db } from "../db";
import type { FollowUpGroup } from "../commercial/follow-up";
import { allDone, decisionExpiry, refreshSteps, resolutionOf, tallyDecisions, type DecisionKind } from "./decision-rules";
import { mapLimit, READ_LANES } from "../concurrency";

export type Decision = typeof decisions.$inferSelect;

/**
 * Opens a decision once per kind and record: a second event about the same
 * thing (the cron running again) finds it there and changes nothing.
 */
export async function openDecision(input: {
  kind: DecisionKind;
  entityId: string;
  companyId: string | null;
  eventId?: string | null;
  title: string;
  reason: string;
  details?: { label: string; value: string }[];
  steps: DecisionStep[];
  draft?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [row] = await db
    .insert(decisions)
    .values({
      kind: input.kind,
      entityId: input.entityId,
      companyId: input.companyId,
      eventId: input.eventId ?? null,
      title: input.title,
      reason: input.reason,
      details: input.details ?? [],
      steps: input.steps,
      draft: input.draft ?? null,
      level: 1,
      expiresAt: decisionExpiry(input.kind, now),
    })
    .onConflictDoNothing({ target: [decisions.kind, decisions.entityId] })
    .returning({ id: decisions.id });
  return row?.id ?? null;
}

/**
 * What the data already says about each step, by kind: a project created
 * from the proposal's screen, a contract started from Contratos, the
 * collection logged in Atrasos. The queue never asks for what is done.
 * `gone` means the decision no longer applies (the proposal went back to
 * draft, the invoice was paid), with the sentence the history keeps.
 */
async function facts(decision: Decision): Promise<{ done: Record<string, boolean>; gone: string | null }> {
  if (decision.kind === "quote.start") {
    const [q] = await db.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, decision.entityId));
    if (!q || q.status !== "accepted") return { done: {}, gone: "O orçamento deixou de estar aceito." };
    const [[project], [contract], [upfront]] = await Promise.all([
      db.select({ id: engagements.id }).from(engagements).where(eq(engagements.quoteId, decision.entityId)).limit(1),
      db
        .select({ id: contracts.id })
        .from(contracts)
        .where(and(eq(contracts.quoteId, decision.entityId), ne(contracts.status, "cancelled")))
        .limit(1),
      db
        .select({ id: automationEvents.id })
        .from(automationEvents)
        .where(and(eq(automationEvents.kind, "quote.upfront"), eq(automationEvents.entityId, decision.entityId)))
        .limit(1),
    ]);
    return { done: { project: !!project, contract: !!contract, upfront: !!upfront }, gone: null };
  }
  if (decision.kind === "contract.upfront") {
    const [c] = await db.select({ status: contracts.status, quoteId: contracts.quoteId }).from(contracts).where(eq(contracts.id, decision.entityId));
    if (!c || c.status === "cancelled" || !c.quoteId) return { done: {}, gone: "O contrato foi cancelado." };
    const [prepared] = await db
      .select({ details: automationEvents.details })
      .from(automationEvents)
      .where(and(eq(automationEvents.kind, "quote.upfront"), eq(automationEvents.entityId, c.quoteId)));
    const invoiceId = (prepared?.details as { invoiceId?: string } | null)?.invoiceId;
    const [invoice] = invoiceId ? await db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, invoiceId)) : [];
    return { done: { issue: invoice?.status === "issued" || invoice?.status === "paid" }, gone: null };
  }
  if (decision.kind === "invoice.collect") {
    const companyId = decision.companyId!;
    const [[open], [contact]] = await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(invoices)
        .where(and(eq(invoices.companyId, companyId), eq(invoices.status, "issued"), lt(sql`coalesce(${invoices.bankDueDate}, ${invoices.dueDate})`, sql`(now() at time zone 'America/Sao_Paulo')::date`))),
      db
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(and(eq(auditEvents.action, "collection.contact"), eq(auditEvents.companyId, companyId), gte(auditEvents.createdAt, decision.createdAt)))
        .limit(1),
    ]);
    if (!open.n) return { done: {}, gone: "As faturas vencidas foram pagas ou encerradas." };
    return { done: { contact: !!contact }, gone: null };
  }
  return { done: {}, gone: null };
}

/**
 * Looks at the data again: steps done elsewhere tick, a decision with every
 * step done closes, one that no longer applies closes as dismissed, one past
 * its date expires. Returns the row as it is now.
 */
export async function settleDecision(decision: Decision, now = new Date()): Promise<Decision> {
  if (decision.status !== "pending") return decision;
  const { done, gone } = await facts(decision);
  if (gone) {
    const [row] = await db
      .update(decisions)
      .set({ status: "dismissed", dismissReason: gone, decidedAt: now })
      .where(and(eq(decisions.id, decision.id), eq(decisions.status, "pending")))
      .returning();
    return row ?? decision;
  }
  const steps = refreshSteps(decision.steps, done);
  if (allDone(steps)) {
    const [row] = await db
      .update(decisions)
      .set({ steps, status: "done", resolution: resolutionOf(steps), decidedAt: now })
      .where(and(eq(decisions.id, decision.id), eq(decisions.status, "pending")))
      .returning();
    return row ?? decision;
  }
  if (decision.expiresAt <= now) {
    const [row] = await db
      .update(decisions)
      .set({ steps, status: "expired", decidedAt: now })
      .where(and(eq(decisions.id, decision.id), eq(decisions.status, "pending")))
      .returning();
    return row ?? decision;
  }
  if (JSON.stringify(steps) !== JSON.stringify(decision.steps)) {
    const [row] = await db.update(decisions).set({ steps }).where(eq(decisions.id, decision.id)).returning();
    return row ?? decision;
  }
  return decision;
}

/** The open queue, settled against the data first: what the team still has to decide. */
export async function openDecisions() {
  const rows = await db
    .select({ decision: decisions, company: companies.name })
    .from(decisions)
    .leftJoin(companies, eq(companies.id, decisions.companyId))
    .where(eq(decisions.status, "pending"))
    .orderBy(decisions.createdAt)
    .limit(100);
  // Up to 100 decisions, each settled against its data: a few at a time.
  const settled = await mapLimit(rows, READ_LANES, async (row) => ({ ...row, decision: await settleDecision(row.decision) }));
  return settled.filter((row) => row.decision.status === "pending");
}

/** How many are waiting, without settling: for the Painel's counter. */
export async function openDecisionCount() {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(decisions).where(eq(decisions.status, "pending"));
  return row.n;
}

/** The latest finished ones, for the history under the queue. */
export async function recentDecisions(limit = 20) {
  return db
    .select({ decision: decisions, company: companies.name })
    .from(decisions)
    .leftJoin(companies, eq(companies.id, decisions.companyId))
    .where(inArray(decisions.status, ["done", "dismissed", "expired"]))
    .orderBy(desc(decisions.decidedAt))
    .limit(limit);
}

/** The numbers since `from` (the month's first day, by default). */
export async function decisionTally(from: Date) {
  const rows = await db
    .select({ status: decisions.status, resolution: decisions.resolution, steps: decisions.steps, createdAt: decisions.createdAt, decidedAt: decisions.decidedAt })
    .from(decisions)
    .where(gte(decisions.createdAt, from));
  return tallyDecisions(rows);
}

/** Every pending decision checked against the data, for the events cron: closes what ended on its own. */
export async function settleAllDecisions(now = new Date()) {
  const rows = await db.select().from(decisions).where(eq(decisions.status, "pending")).limit(500);
  let closed = 0;
  for (const row of rows) if ((await settleDecision(row, now)).status !== "pending") closed++;
  return closed;
}

/** Decisions waiting for more than a day, for the morning digest (same shape as the other follow-ups). */
export async function decisionFollowUp(now = new Date()): Promise<FollowUpGroup[]> {
  const rows = await db
    .select({ id: decisions.id, title: decisions.title, reason: decisions.reason })
    .from(decisions)
    .where(and(eq(decisions.status, "pending"), lt(decisions.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000))))
    .orderBy(decisions.createdAt)
    .limit(50);
  if (!rows.length) return [];
  return [{ key: "decisions-waiting", title: "Decisões do Piloto automático paradas há mais de um dia", items: rows.map((r) => ({ line: `${r.title} · ${r.reason}`, href: "/piloto" })) }];
}
