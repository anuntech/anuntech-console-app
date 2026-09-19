import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { companyInvites } from "@/db/schema";
export const inviteHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const validInviteToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
export async function findCompanyInvite(token: string) {
  if (!validInviteToken(token)) return null;
  const [row] = await db
    .select()
    .from(companyInvites)
    .where(eq(companyInvites.tokenHash, inviteHash(token)));
  return row || null;
}
export async function allowInviteLookup(token: string) {
  if (!validInviteToken(token)) return false;
  const [row] = await db
    .update(companyInvites)
    .set({ lookupCount: sql`${companyInvites.lookupCount} + 1` })
    .where(
      and(
        eq(companyInvites.tokenHash, inviteHash(token)),
        eq(companyInvites.status, "open"),
        gt(companyInvites.expiresAt, new Date()),
        lt(companyInvites.lookupCount, 40),
      ),
    )
    .returning({ id: companyInvites.id });
  return !!row;
}
