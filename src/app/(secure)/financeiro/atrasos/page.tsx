import type { Metadata } from "next";
import { requireAdmin } from "@/lib/access/access";
import { PageHeader } from "@/components/console/page-header";
import { CollectionsList } from "@/components/financeiro/collections-list";
import { collectionQueue, markedReceived } from "@/lib/billing/collections";
import { expiredDebts } from "@/lib/billing/billing-watch";

export const metadata: Metadata = { title: "Atrasos", description: "Clientes com faturas vencidas e o que foi combinado." };

export default async function Collections() {
  await requireAdmin();
  const [cases, marked, expired] = await Promise.all([collectionQueue(), markedReceived(), expiredDebts()]);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Financeiro", href: "/financeiro" }, { label: "Atrasos" }]}
        title="Atrasos"
        count={cases.length}
        className="mb-4"
      />
      <CollectionsList
        cases={cases}
        marked={marked}
        expired={{ n: expired.length, cents: expired.reduce((sum, debt) => sum + debt.amountCents, 0) }}
      />
    </>
  );
}
