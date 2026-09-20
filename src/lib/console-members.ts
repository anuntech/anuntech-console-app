import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { consoleStaffMembers } from "@/db/schema";
import { db } from "./db";
import { resolveAccountIdentity } from "./account-identity";
import { normalizeEmail } from "./permissions";

/** Email admission only. Callers authorizing a session must also verify its email. */
export async function getConsoleStaffAccess(email: string) {
  const identity = await resolveAccountIdentity(normalizeEmail(email));
  const configuredOwner = process.env.CONSOLE_ADMIN_EMAIL?.trim();
  const owner =
    !!configuredOwner &&
    identity.emails.includes(normalizeEmail(configuredOwner));
  if (owner) return { owner: true, admin: true };
  const [member] = await db
    .select({ id: consoleStaffMembers.id })
    .from(consoleStaffMembers)
    .where(
      and(
        inArray(consoleStaffMembers.email, identity.emails),
        eq(consoleStaffMembers.active, true),
      ),
    )
    .limit(1);
  return { owner: false, admin: !!member };
}

export async function hasConsoleStaffAccess(email: string) {
  return (await getConsoleStaffAccess(email)).admin;
}
