import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { companies, membershipEngagements, memberships } from "@/db/schema";
import { db } from "../db";
import { mergeScopes, type EngagementScope } from "./engagement-scope";

/**
 * The active memberships of an identity (all its e-mail aliases), one grant per
 * membership, each carrying what that person sees in the company: aliases in the
 * same company share the widest scope. getActor and the routes that cannot
 * redirect (file downloads) read access here, so the rules never drift.
 */
export async function loadGrants(emails: string[], companyId?: string) {
  if (!emails.length) return [];
  const rows = await db
    .select({ company: companies, role: memberships.role, membershipId: memberships.id, engagementAccess: memberships.engagementAccess })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(and(inArray(memberships.email, emails), eq(memberships.active, true), companyId ? eq(memberships.companyId, companyId) : undefined));
  const restricted = rows.filter((r) => r.role === "member" && r.engagementAccess === "selected").map((r) => r.membershipId);
  const selected = restricted.length
    ? await db
        .select({ membershipId: membershipEngagements.membershipId, engagementId: membershipEngagements.engagementId })
        .from(membershipEngagements)
        .where(inArray(membershipEngagements.membershipId, restricted))
    : [];
  const scopes = mergeScopes(
    rows.map((r) => ({
      companyId: r.company.id,
      role: r.role,
      engagementAccess: r.engagementAccess,
      engagementIds: selected.filter((s) => s.membershipId === r.membershipId).map((s) => s.engagementId),
    })),
  );
  return rows.map((r) => ({ company: r.company, role: r.role, engagements: scopes.get(r.company.id) as EngagementScope }));
}

/**
 * For queries over console_memberships: the membership sees this engagement
 * (an Administrador, a Membro with everything, or one with it selected). Literal
 * table names, so it stays correct inside one-table selects.
 */
export const membershipSeesEngagement = (engagementId: string) =>
  sql`("console_memberships"."role" = 'manager' or "console_memberships"."engagement_access" = 'all' or exists (select 1 from "console_membership_engagements" "me" where "me"."membership_id" = "console_memberships"."id" and "me"."engagement_id" = ${engagementId}))`;
