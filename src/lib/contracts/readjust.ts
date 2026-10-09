import "server-only";
import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { automationEvents, companies, contracts, engagements, subscriptions } from "@/db/schema";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { currency } from "../format";
import { addDays } from "../billing/recurrence";

/*
 * The yearly readjust, prepared: on a signed contract's anniversary, the
 * IPCA of the last 12 months (Banco Central, series 433) and the item's new
 * price. The amendment is a draft the team reviews (the clause waits for the
 * lawyer); the recurrence's price changes only when the team edits it.
 */

const SERIES = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json";

/**
 * The IPCA accumulated over the last 12 published months. Only the daily
 * routine (`refresh`) asks the Banco Central, at most once a day; the
 * screens use what it stored, so they never wait on the network.
 */
export async function ipca12m({ refresh = false } = {}): Promise<{ percent: number; period: string } | null> {
  const [cached] = await db
    .select({ details: automationEvents.details, at: automationEvents.createdAt })
    .from(automationEvents)
    .where(eq(automationEvents.kind, "ipca.12m"))
    .orderBy(desc(automationEvents.createdAt))
    .limit(1);
  if (cached && (!refresh || Date.now() - cached.at.getTime() < 86_400_000)) return cached.details as { percent: number; period: string };
  if (!refresh) return null;
  try {
    const res = await fetch(SERIES, { signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error" });
    const rows = (await res.json()) as { data: string; valor: string }[];
    if (!res.ok || !Array.isArray(rows) || rows.length < 12) throw new Error("série incompleta");
    const factor = rows.reduce((acc, row) => acc * (1 + Number(row.valor.replace(",", ".")) / 100), 1);
    const period = `${rows[0].data.slice(3)} a ${rows[rows.length - 1].data.slice(3)}`;
    const value = { percent: Math.round((factor - 1) * 10000) / 100, period };
    await db
      .insert(automationEvents)
      .values({ kind: "ipca.12m", entityId: `${saoPauloDate()}`, details: value })
      .onConflictDoUpdate({ target: [automationEvents.kind, automationEvents.entityId], set: { details: value, createdAt: new Date() } });
    return value;
  } catch (error) {
    console.warn("[readjust] IPCA unavailable", error instanceof Error ? error.message : error);
    return (cached?.details as { percent: number; period: string } | undefined) ?? null;
  }
}

export type Readjust = {
  contractId: string;
  title: string;
  company: string;
  /** The item and its billing cycle, named in the clause. */
  item: string;
  cycle: "mensal" | "anual" | null;
  anniversary: string;
  currentCents: number;
  newCents: number;
  percent: number;
  period: string;
};

/** The anniversary of `startsAt` on or after `from` (the same day and month; Feb 29 becomes Feb 28). */
function anniversaryAfter(startsAt: string, from: string) {
  const [, month, day] = startsAt.split("-").map(Number);
  const year = Number(from.slice(0, 4));
  const at = (y: number) => {
    const last = new Date(Date.UTC(y, month, 0, 12)).getUTCDate();
    return `${y}-${String(month).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  };
  return at(year) >= from ? at(year) : at(year + 1);
}

/** How far back a passed anniversary still waits for its readjust. */
const LATE_DAYS = 60;

/**
 * Signed contracts whose anniversary comes within 30 days (or passed in the
 * last 60 without a readjust), with a priced item and no amendment in
 * progress. The price is what the recurrence bills, when there is one.
 */
export async function readjustsDue(today = saoPauloDate(), refresh = false): Promise<Readjust[]> {
  const index = await ipca12m({ refresh });
  if (!index) return [];
  const rows = await db
    .select({
      id: contracts.id,
      title: contracts.title,
      startsAt: contracts.startsAt,
      signedAt: contracts.signedAt,
      company: companies.name,
      item: engagements.name,
      amountCents: engagements.amountCents,
      billed: subscriptions.amountCents,
      interval: subscriptions.interval,
    })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .innerJoin(engagements, eq(engagements.id, contracts.engagementId))
    // Linked either way: the catalog writes engagements.subscription_id, Nova cobrança only subscriptions.engagement_id.
    .leftJoin(
      subscriptions,
      and(or(eq(subscriptions.id, engagements.subscriptionId), eq(subscriptions.engagementId, engagements.id)), eq(subscriptions.status, "active")),
    )
    .where(
      and(
        eq(contracts.status, "signed"),
        eq(contracts.kind, "contract"),
        eq(companies.archived, false),
        isNotNull(contracts.startsAt),
        sql`(${contracts.endsAt} is null or ${contracts.endsAt} >= ${today})`,
        sql`not exists (select 1 from ${contracts} c2 where c2.parent_id = ${contracts.id} and c2.status in ('draft', 'sent', 'in_review'))`,
      ),
    );
  // Readjusts already prepared, per contract and anniversary (an amendment cancelled since does not count).
  const done = new Set(
    (
      await db
        .select({ entityId: automationEvents.entityId })
        .from(automationEvents)
        .where(
          and(
            eq(automationEvents.kind, "contract.readjust"),
            sql`exists (select 1 from ${contracts} c3 where c3.id = ${automationEvents.details}->>'amendmentId' and c3.status <> 'cancelled')`,
          ),
        )
    ).map((row) => row.entityId),
  );
  const out: Readjust[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const current = row.billed ?? row.amountCents;
    if (!current) continue;
    // A renewal moves startsAt to the new term; the contract has been in force since it was first signed.
    const signed = row.signedAt ? saoPauloDate(row.signedAt) : row.startsAt!;
    const firstStart = signed < row.startsAt! ? signed : row.startsAt!;
    const late = anniversaryAfter(row.startsAt!, addDays(today, -LATE_DAYS));
    const anniversary = late < today && !done.has(`${row.id}:${late}`) ? late : anniversaryAfter(row.startsAt!, today);
    // A year in force at least, within 30 days ahead, and not prepared yet.
    if (anniversary > addDays(today, 30) || anniversary < addDays(firstStart, 360) || done.has(`${row.id}:${anniversary}`)) continue;
    out.push({
      contractId: row.id,
      title: row.title,
      company: row.company,
      item: row.item,
      cycle: row.interval === "yearly" ? "anual" : row.interval === "monthly" ? "mensal" : null,
      anniversary,
      currentCents: current,
      newCents: Math.round(current * (1 + index.percent / 100)),
      percent: index.percent,
      period: index.period,
    });
  }
  return out;
}

/** The readjust of one contract, for the prepared amendment. */
export async function readjustFor(contractId: string, today = saoPauloDate()) {
  return (await readjustsDue(today)).find((r) => r.contractId === contractId) ?? null;
}

/** For the digest (which refreshes the index) and the Painel. */
export async function readjustFollowUp(today = saoPauloDate(), refresh = false) {
  const due = await readjustsDue(today, refresh);
  return due.length
    ? [
        {
          key: "readjusts",
          title: "Reajustes no aniversário do contrato, em até 30 dias ou já passados (IPCA)",
          items: due.map((r) => ({
            line: `${r.company} · ${r.title} · ${currency(r.currentCents)} → ${currency(r.newCents)} (${String(r.percent).replace(".", ",")}%) ${r.anniversary < today ? "desde" : "em"} ${r.anniversary.split("-").reverse().join("/")}`,
            href: `/contratos/novo?parentId=${r.contractId}&reajuste=1`,
          })),
        },
      ]
    : [];
}

