import "server-only";
import { z } from "zod";
import { canAccess, type Actor } from "../access/access";
import { milestoneKeys, recordMilestone } from "./milestones";

/**
 * A first step done by hand, or the card hidden, for one company the person
 * belongs to: the web's markFirstStep and the app's settings screens. False
 * when the company is out of the person's reach (nothing is recorded).
 */
export async function markCompanyStep(actor: Actor, companyId: string, key: string) {
  const input = z.object({ companyId: z.string().uuid(), key: z.enum(milestoneKeys) }).parse({ companyId, key });
  if (!canAccess(actor, input.companyId, "overview")) return false;
  // Reviewing who has access is due again every 6 months, so its date follows the latest review.
  await recordMilestone(actor.user.id, input.key, input.companyId, input.key === "members_reviewed");
  return true;
}
