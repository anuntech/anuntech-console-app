"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor, canAccess } from "../access/access";
import { GUIDE_VERSION } from "./guide-content";
import { milestoneKeys, recordMilestone } from "./milestones";

/** Reading "Como trabalhamos" counts once per version; it never stands for accepting any term. */
export async function markGuideRead() {
  const actor = await getActor();
  await recordMilestone(actor.user.id, `guide_read_v${GUIDE_VERSION}`);
  revalidatePath("/painel");
}

/** A first step done by hand, or the card hidden, for one company the person belongs to. */
export async function markFirstStep(companyId: string, key: string) {
  const actor = await getActor();
  const input = z.object({ companyId: z.string().uuid(), key: z.enum(milestoneKeys) }).parse({ companyId, key });
  if (!canAccess(actor, input.companyId, "overview")) return;
  // Reviewing who has access is due again every 6 months, so its date follows the latest review.
  await recordMilestone(actor.user.id, input.key, input.companyId, input.key === "members_reviewed");
  revalidatePath("/painel");
}
