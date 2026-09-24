import "server-only";
import { asc } from "drizzle-orm";
import { catalogItems } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { CatalogTable } from "./catalog-table";

/** Everything Anuntech offers, for staff to keep current. */
export async function CatalogSection() {
  await requireAdmin();
  const rows = await db
    .select({
      id: catalogItems.id,
      kind: catalogItems.kind,
      name: catalogItems.name,
      description: catalogItems.description,
      url: catalogItems.url,
      defaultAmountCents: catalogItems.defaultAmountCents,
      interval: catalogItems.interval,
      whatWeDo: catalogItems.whatWeDo,
      whatWeNeed: catalogItems.whatWeNeed,
      expectedResults: catalogItems.expectedResults,
      deadlines: catalogItems.deadlines,
      active: catalogItems.active,
    })
    .from(catalogItems)
    .orderBy(asc(catalogItems.active), asc(catalogItems.name));
  return <CatalogTable rows={rows.sort((a, b) => Number(b.active) - Number(a.active))} />;
}
