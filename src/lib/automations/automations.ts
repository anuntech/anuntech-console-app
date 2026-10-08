import "server-only";
import { eq } from "drizzle-orm";
import { environmentProfile } from "@/db/schema";
import { db } from "../db";
import { automationState, type AutomationKey } from "./automation-list";

/** Every automation's switch, read once per run. */
export async function automations() {
  const [row] = await db.select({ automations: environmentProfile.automations }).from(environmentProfile).where(eq(environmentProfile.id, "console"));
  return automationState(row?.automations);
}

export async function automationOn(key: AutomationKey) {
  return (await automations())[key];
}
