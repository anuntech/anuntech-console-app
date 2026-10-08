import "server-only";
import { asc, eq } from "drizzle-orm";
import { consoleStaffMembers, user } from "@/db/schema";
import { db } from "../db";
import { normalizeEmail } from "../access/permissions";

/**
 * Who an automatic step is recorded for in the audit log, which needs a
 * person: the Console's owner, else the oldest active staff member. The
 * event's details say it was automatic.
 */
export async function automationActorId(): Promise<string | null> {
  const owner = process.env.CONSOLE_ADMIN_EMAIL?.trim();
  if (owner) {
    const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, normalizeEmail(owner)));
    if (row) return row.id;
  }
  const [staff] = await db
    .select({ id: user.id })
    .from(consoleStaffMembers)
    .innerJoin(user, eq(user.email, consoleStaffMembers.email))
    .where(eq(consoleStaffMembers.active, true))
    .orderBy(asc(consoleStaffMembers.createdAt))
    .limit(1);
  return staff?.id ?? null;
}
