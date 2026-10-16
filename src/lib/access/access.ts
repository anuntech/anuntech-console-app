import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { eq, and, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { auth } from "../auth/auth";
import { db } from "../db";
import { companies } from "@/db/schema";
import { hasPermission, type Area } from "./permissions";
import { getAccountEmails } from "../account/account-identity";
import { getConsoleStaffAccess } from "./console-members";
import { ASSIST_COOKIE } from "./assisted-session";
import { scopeIncludes, scopeOfCompany, type EngagementScope } from "./engagement-scope";
import { loadGrants } from "./grants";
export const getActor = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) redirect("/entrar");
  const { admin, owner } = await getConsoleStaffAccess(session.user.email);
  const emails = await getAccountEmails(session.user.id, session.user.email);
  const grants = await loadGrants(emails);
  const assistedCompanyId = admin
    ? (await cookies()).get(ASSIST_COOKIE)?.value
    : undefined;
  const assisting = assistedCompanyId
    ? (
        await db
          .select()
          .from(companies)
          .where(eq(companies.id, assistedCompanyId))
      )[0]
    : undefined;
  if (assisting)
    return {
      user: session.user,
      owner: false,
      admin: false,
      grants: [{ company: assisting, role: "manager" as const, engagements: "all" as EngagementScope }],
      assisting,
      realAdmin: true,
    };
  return {
    user: session.user,
    owner,
    admin,
    grants,
    assisting: null,
    realAdmin: admin,
  };
});
export type Actor = Awaited<ReturnType<typeof getActor>>;
export async function requireAdmin() {
  const actor = await getActor();
  if (!actor.admin) notFound();
  return actor;
}
export async function accessibleCompanies(
  actor: Actor,
  area: Area = "overview",
) {
  if (actor.admin) return db.select().from(companies).orderBy(companies.name);
  return actor.grants
    .filter((g) => hasPermission(g.role, area))
    .map((g) => g.company);
}
export function allowedIds(actor: Actor, area: Area) {
  return actor.grants
    .filter((g) => hasPermission(g.role, area))
    .map((g) => g.company.id);
}
export function canAccess(actor: Actor, companyId: string, area: Area) {
  return (
    actor.admin ||
    actor.grants.some(
      (g) => g.company.id === companyId && hasPermission(g.role, area),
    )
  );
}

/** Amounts, due dates and billing: Administradores of the company and the team. */
export function canSeeMoney(actor: Actor, companyId: string) {
  return canAccess(actor, companyId, "finance");
}

/** A product, service or project: the company's area, and the person's selection when a Membro has one. */
export function canSeeEngagement(
  actor: Actor,
  engagement: { id: string; companyId: string },
  area: Area = "overview",
) {
  if (actor.admin) return true;
  return (
    canAccess(actor, engagement.companyId, area) &&
    scopeIncludes(scopeOfCompany(actor.grants, engagement.companyId), engagement.id)
  );
}

/**
 * The SQL twin of canSeeEngagement, for lists: undefined for the team (no filter).
 * `id` is the engagement id column (engagements.id, tasks.engagementId...) and
 * `company` the company column of the same row.
 */
export function engagementWhere(
  actor: Actor,
  id: PgColumn,
  company: PgColumn,
  area: Area = "overview",
): SQL | undefined {
  if (actor.admin) return undefined;
  const whole: string[] = [];
  const parts: SQL[] = [];
  for (const companyId of new Set(allowedIds(actor, area))) {
    const scope = scopeOfCompany(actor.grants, companyId);
    if (scope === "all") whole.push(companyId);
    else if (scope?.size) parts.push(and(eq(company, companyId), inArray(id, [...scope]))!);
  }
  if (whole.length) parts.unshift(inArray(company, whole));
  return parts.length ? or(...parts) : sql`false`;
}

/**
 * Tickets a person sees: the company's support area; a Membro with a selection
 * does not see requests about the products left out, except the ones they opened.
 */
export function ticketWhere(
  actor: Actor,
  columns: { company: PgColumn; engagement: PgColumn; author: PgColumn },
): SQL | undefined {
  if (actor.admin) return undefined;
  const whole: string[] = [];
  const parts: SQL[] = [];
  for (const companyId of new Set(allowedIds(actor, "support"))) {
    const scope = scopeOfCompany(actor.grants, companyId);
    if (scope === "all") whole.push(companyId);
    else if (scope)
      parts.push(
        and(
          eq(columns.company, companyId),
          or(
            isNull(columns.engagement),
            eq(columns.author, actor.user.id),
            scope.size ? inArray(columns.engagement, [...scope]) : undefined,
          ),
        )!,
      );
  }
  if (whole.length) parts.unshift(inArray(columns.company, whole));
  return parts.length ? or(...parts) : sql`false`;
}

/** The ticket rule for one row (detail pages, replies, the assistant). */
export function canSeeTicket(
  actor: Actor,
  ticket: { companyId: string; engagementId: string | null; authorId: string },
) {
  if (actor.admin) return true;
  if (!canAccess(actor, ticket.companyId, "support")) return false;
  if (!ticket.engagementId || ticket.authorId === actor.user.id) return true;
  return scopeIncludes(scopeOfCompany(actor.grants, ticket.companyId), ticket.engagementId);
}
