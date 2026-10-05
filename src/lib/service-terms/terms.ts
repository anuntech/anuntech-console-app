import "server-only";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { environmentProfile, serviceTerms } from "@/db/schema";
import { db } from "../db";
import { calendar, type Calendar } from "./business-calendar";
import type { TermsSnapshot } from "./terms-model";

type Executor = Pick<typeof db, "select">;

/** The business calendar with the seat's own holidays (Configurações → Dados da empresa). */
export async function loadCalendar(executor: Executor = db): Promise<Calendar> {
  const [profile] = await executor.select({ holidays: environmentProfile.holidays }).from(environmentProfile).limit(1);
  return calendar(profile?.holidays ?? {});
}

export type TermsRow = typeof serviceTerms.$inferSelect;

/**
 * A company's conditions that govern one product or service: the active,
 * verified record scoped to it, else the company-wide one. Records with no
 * response rule (basis "none") count as "no deadlines".
 */
export async function governingTerms(companyId: string, engagementId: string | null | undefined, executor: Executor = db) {
  const rows = await executor
    .select()
    .from(serviceTerms)
    .where(
      and(
        eq(serviceTerms.companyId, companyId),
        eq(serviceTerms.active, true),
        engagementId ? or(eq(serviceTerms.engagementId, engagementId), isNull(serviceTerms.engagementId)) : isNull(serviceTerms.engagementId),
      ),
    )
    .orderBy(desc(serviceTerms.updatedAt));
  const verified = rows.filter((r) => r.verifiedAt);
  return verified.find((r) => r.engagementId === engagementId) ?? verified.find((r) => !r.engagementId) ?? null;
}

export function snapshotOf(row: TermsRow | null): TermsSnapshot | null {
  if (!row || row.basis === "none" || !Object.keys(row.policy.response ?? {}).length) return null;
  return {
    termsId: row.id,
    version: row.version,
    label: row.label,
    preset: row.preset,
    policy: row.policy,
    publishAt: row.publishAt ? row.publishAt.toISOString() : null,
    personClient: row.personClient,
  };
}

/** Every active, verified record of a company: what "Seus prazos" shows. */
export async function companyTerms(companyId: string, executor: Executor = db) {
  const rows = await executor
    .select()
    .from(serviceTerms)
    .where(and(eq(serviceTerms.companyId, companyId), eq(serviceTerms.active, true)))
    .orderBy(desc(serviceTerms.updatedAt));
  return rows.filter((r) => r.verifiedAt);
}
