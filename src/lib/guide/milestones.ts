import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { userMilestones } from "@/db/schema";
import { db } from "../db";

/** Things a person did once. Keys are fixed here so no form can write anything else. */
export const milestoneKeys = ["guide_read", "first_steps_hidden", "notices_reviewed", "members_reviewed"] as const;
export type MilestoneKey = (typeof milestoneKeys)[number];

export async function milestonesOf(userId: string, companyIds: string[] = []) {
  const rows = await db
    .select({ key: userMilestones.key, companyId: userMilestones.companyId })
    .from(userMilestones)
    .where(and(eq(userMilestones.userId, userId), inArray(userMilestones.companyId, ["", ...companyIds])));
  return new Set(rows.map((r) => `${r.key}:${r.companyId}`));
}

/** With `refresh`, a repeat moves the date (a review done again), instead of keeping the first one. */
export async function recordMilestone(userId: string, key: string, companyId = "", refresh = false) {
  const insert = db.insert(userMilestones).values({ userId, key, companyId });
  await (refresh
    ? insert.onConflictDoUpdate({ target: [userMilestones.userId, userMilestones.companyId, userMilestones.key], set: { createdAt: new Date() } })
    : insert.onConflictDoNothing());
}

/** When a person last did something, per company. */
export async function milestoneAt(userId: string, key: MilestoneKey, companyId: string) {
  const [row] = await db
    .select({ at: userMilestones.createdAt })
    .from(userMilestones)
    .where(and(eq(userMilestones.userId, userId), eq(userMilestones.key, key), eq(userMilestones.companyId, companyId)));
  return row?.at ?? null;
}
