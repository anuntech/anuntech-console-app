import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { consoleStaffMembers, memberships } from "@/db/schema";
import { db } from "./db";
import { AccessChangeError } from "./company-management";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Serializes invitations with alias verification, including not-yet-created accounts. */
export async function lockEnvironmentAssignments(tx: Tx) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('console-environment-assignments'))`,
  );
}
export async function assertSingleEnvironment(
  tx: Tx,
  emails: string[],
  target?: string,
) {
  const grants = await tx
    .select({ id: memberships.companyId })
    .from(memberships)
    .where(
      and(inArray(memberships.email, emails), eq(memberships.active, true)),
    );
  const staff = await tx
    .select({ id: consoleStaffMembers.id })
    .from(consoleStaffMembers)
    .where(
      and(
        inArray(consoleStaffMembers.email, emails),
        eq(consoleStaffMembers.active, true),
      ),
    )
    .limit(1);
  const environments = new Set(grants.map((grant) => grant.id));
  if (
    staff.length ||
    emails.includes(process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase() || "")
  )
    environments.add("console");
  if (target) environments.add(target);
  if (environments.size > 1)
    throw new AccessChangeError(
      "Esta conta já pertence a outro ambiente. Remova o vínculo anterior antes de convidá-la.",
    );
}
