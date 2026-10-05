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

export async function recordMilestone(userId: string, key: string, companyId = "") {
  await db.insert(userMilestones).values({ userId, key, companyId }).onConflictDoNothing();
}
