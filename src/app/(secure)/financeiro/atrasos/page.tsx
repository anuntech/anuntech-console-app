import type { Metadata } from "next";
import { requireAdmin } from "@/lib/access/access";
import { PageHeader } from "@/components/console/page-header";
import { CollectionsList } from "@/components/financeiro/collections-list";
import { collectionQueue } from "@/lib/billing/collections";

export const metadata: Metadata = { title: "Atrasos", description: "Clientes com faturas vencidas e o que foi combinado." };

export default async function Collections() {
  await requireAdmin();
  const cases = await collectionQueue();
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Financeiro", href: "/financeiro" }, { label: "Atrasos" }]}
        title="Atrasos"
        count={cases.length}
        className="mb-4"
      />
      <CollectionsList cases={cases} />
    </>
  );
}
