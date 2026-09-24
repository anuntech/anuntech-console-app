import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { catalogItems, subscriptions } from "@/db/schema";
import { accessibleCompanies, requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import type { AddFromCatalogData } from "./add-from-catalog";

export type AddSearchParams = Promise<{ companyId?: string }>;

/** Companies, active catalog items and unlinked live recurrences, for the link form. */
export async function addFromCatalogContext(searchParams: AddSearchParams): Promise<AddFromCatalogData> {
  const actor = await requireAdmin();
  const [companies, items, subs, { companyId }] = await Promise.all([
    accessibleCompanies(actor).then((rows) =>
      rows.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, document: c.document })),
    ),
    db
      .select({
        id: catalogItems.id,
        kind: catalogItems.kind,
        name: catalogItems.name,
        defaultAmountCents: catalogItems.defaultAmountCents,
        interval: catalogItems.interval,
      })
      .from(catalogItems)
      .where(eq(catalogItems.active, true))
      .orderBy(asc(catalogItems.name)),
    db
      .select({
        id: subscriptions.id,
        companyId: subscriptions.companyId,
        description: subscriptions.description,
        amountCents: subscriptions.amountCents,
        interval: subscriptions.interval,
        nextDueDate: subscriptions.nextDueDate,
      })
      .from(subscriptions)
      // A recurrence pays for one item; the ones already linked stay out.
      .where(and(inArray(subscriptions.status, ["draft", "active", "paused"]), isNull(subscriptions.engagementId)))
      .orderBy(asc(subscriptions.description)),
    searchParams,
  ]);
  return {
    companies,
    items,
    subscriptions: subs,
    companyId: companies.some((c) => c.id === companyId) ? companyId : undefined,
  };
}
