import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { catalogItems, companies, engagementSuspensions, engagements, subscriptions } from "@/db/schema";
import { productNextDueDate } from "../billing/product-due";
import { canSeeEngagement, canSeeMoney, type Actor } from "../access/access";
import type { SuspendedProduct } from "../suspensions/suspension-notice";

/**
 * One product, service or project the person sees, with its catalog item and
 * billing: the web's /produtos/[id] and the app's products.get. Null when it
 * does not exist or is outside the person's reach (a Membro's selection too),
 * so a hidden id answers like a missing one. `billing` only where the person
 * sees money.
 */
export async function findProduct(actor: Actor, id: string) {
  const [row] = await db
    .select({
      engagement: engagements,
      company: companies.name,
      companyDocument: companies.document,
      item: catalogItems,
      nextDueDate: productNextDueDate(),
      subscriptionInterval: subscriptions.interval,
      subscriptionAmount: subscriptions.amountCents,
    })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
    .leftJoin(subscriptions, eq(subscriptions.id, engagements.subscriptionId))
    .where(eq(engagements.id, id));
  if (!row || !canSeeEngagement(actor, row.engagement)) return null;
  const money = canSeeMoney(actor, row.engagement.companyId);
  return {
    ...row,
    // Only where the viewer sees money; a Membro gets no billing at all.
    billing: money
      ? {
          amountCents: row.subscriptionAmount ?? row.engagement.amountCents,
          interval: row.subscriptionInterval ?? row.item?.interval ?? null,
          nextDueDate: row.nextDueDate,
        }
      : undefined,
  };
}

/** The open suspension of a suspended product, as the client reads it (no team note). */
export async function productSuspension(actor: Actor, engagement: { id: string; name: string; companyId: string; status: string }): Promise<SuspendedProduct | null> {
  if (engagement.status !== "suspended") return null;
  const [open] = await db
    .select({ since: engagementSuspensions.suspendedAt, reason: engagementSuspensions.reason })
    .from(engagementSuspensions)
    .where(and(eq(engagementSuspensions.engagementId, engagement.id), isNull(engagementSuspensions.liftedAt)));
  if (!open) return null;
  return { name: engagement.name, since: open.since?.toISOString() ?? null, reason: open.reason, canPay: canSeeMoney(actor, engagement.companyId) };
}
