import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { companies, memberships } from "@/db/schema";
import type { Actor } from "../access/access";
import { getAccountEmails } from "../account/account-identity";
import { db } from "../db";
import { managedCompanyIds } from "../access/member-access";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const blocked = { error: "Você não tem permissão para fazer isso." };
export class AccessChangeError extends Error {}
/** A company lock serializes grants, demotions and revocations before authorization. */
export async function lockManagedCompany(
  tx: Transaction,
  actor: Actor,
  companyId: string,
) {
  const [company] = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.id, companyId),
        actor.admin
          ? undefined
          : inArray(companies.id, managedCompanyIds(actor)),
      ),
    )
    .for("update");
  if (!company) throw new AccessChangeError(blocked.error);
  if (actor.admin) return;
  // A form opened before a revocation cannot keep using the old manager grant.
  const emails = await getAccountEmails(actor.user.id, actor.user.email, tx);
  const [manager] = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.companyId, companyId),
        inArray(memberships.email, emails),
        eq(memberships.role, "manager"),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  if (!manager) throw new AccessChangeError(blocked.error);
}
