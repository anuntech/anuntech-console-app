import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { companies, memberships } from "@/db/schema";
import { hasPermission, type Area } from "./permissions";
import { getAccountEmails } from "./account-identity";
import { getConsoleStaffAccess } from "./console-members";
export const getActor = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user.emailVerified) redirect("/entrar");
  const { admin, owner } = await getConsoleStaffAccess(session.user.email);
  const emails = await getAccountEmails(session.user.id, session.user.email);
  const grants = await db
    .select({ company: companies, role: memberships.role })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(
      and(inArray(memberships.email, emails), eq(memberships.active, true)),
    );
  return { user: session.user, owner, admin, grants };
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
