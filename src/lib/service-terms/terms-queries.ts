import "server-only";
import { and, asc, eq, isNull, notExists, or, sql } from "drizzle-orm";
import { companies, engagements, serviceTerms, subscriptions } from "@/db/schema";
import { db } from "../db";

/** Active Synova licences of clients with no conditions at all, signed outside the Console. */
export async function synovaWithoutTerms() {
  return db
    .selectDistinct({ companyId: subscriptions.companyId, company: companies.name, document: companies.document })
    .from(subscriptions)
    .innerJoin(companies, eq(companies.id, subscriptions.companyId))
    .leftJoin(engagements, or(eq(engagements.id, subscriptions.engagementId), eq(engagements.subscriptionId, subscriptions.id)))
    .where(
      and(
        eq(subscriptions.status, "active"),
        eq(companies.archived, false),
        or(sql`${subscriptions.description} ilike '%synova%'`, sql`${engagements.name} ilike '%synova%'`),
        notExists(db.select({ one: sql`1` }).from(serviceTerms).where(eq(serviceTerms.companyId, subscriptions.companyId))),
      ),
    );
}

/** Synova conditions prepared as drafts and not confirmed yet: the list to check one by one. */
export async function synovaDraftsToConfirm() {
  return db
    .select({ companyId: serviceTerms.companyId, company: companies.name })
    .from(serviceTerms)
    .innerJoin(companies, eq(companies.id, serviceTerms.companyId))
    .where(and(eq(serviceTerms.active, true), eq(serviceTerms.preset, "synova"), isNull(serviceTerms.verifiedAt), eq(companies.archived, false)))
    .orderBy(asc(companies.name));
}
