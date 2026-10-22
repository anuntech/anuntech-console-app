import type { Metadata } from "next";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/access/access";
import { db } from "@/lib/db";
import { catalogItems, engagements } from "@/db/schema";
import { PageHeader } from "@/components/console/page-header";
import { CollectionsList, type CollectionProduct } from "@/components/financeiro/collections-list";
import { collectionQueue, markedReceived } from "@/lib/billing/collections";
import { expiredDebts } from "@/lib/billing/billing-watch";
import { appForUrl, protectedApps } from "@/lib/apps/registry";
import { openSuspensions } from "@/lib/suspensions/suspensions";
import { suspensionView } from "@/lib/suspensions/suspension-view";

export const metadata: Metadata = { title: "Atrasos", description: "Clientes com faturas vencidas e o que foi combinado." };

export default async function Collections() {
  await requireAdmin();
  const [cases, marked, expired] = await Promise.all([collectionQueue(), markedReceived(), expiredDebts()]);
  // Each overdue client's products, with the suspension the contract allows (lib/suspensions).
  const rows = cases.length
    ? await db
        .select({ id: engagements.id, name: engagements.name, kind: engagements.kind, status: engagements.status, url: engagements.url, companyId: engagements.companyId, suspensionKind: catalogItems.suspensionKind })
        .from(engagements)
        .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
        .where(
          and(
            inArray(engagements.companyId, cases.map((c) => c.companyId)),
            inArray(engagements.kind, ["product", "service"]),
            inArray(engagements.status, ["active", "suspended"]),
          ),
        )
        .orderBy(asc(engagements.name))
    : [];
  const suspensions = await openSuspensions(rows.map((row) => row.id));
  const apps = protectedApps();
  const products: CollectionProduct[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    companyId: row.companyId,
    appPage: row.kind === "product" && appForUrl(row.url, apps) ? `/apps/${row.id}` : null,
    suspension: suspensionView(suspensions.get(row.id), row.suspensionKind, true),
  }));
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Financeiro", href: "/financeiro" }]}
        title="Atrasos"
        count={cases.length}
        className="mb-4"
      />
      <CollectionsList
        cases={cases}
        products={products}
        marked={marked}
        expired={{ n: expired.length, cents: expired.reduce((sum, debt) => sum + debt.amountCents, 0) }}
      />
    </>
  );
}
