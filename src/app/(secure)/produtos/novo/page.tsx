import type { Metadata } from "next";
import { PageHeader } from "@/components/console/page-header";
import { AddFromCatalogForm } from "@/components/produtos/add-from-catalog";
import { addFromCatalogContext, type AddSearchParams } from "@/components/produtos/add-context";
export const metadata: Metadata = { title: "Novo produto ou serviço" };

/** Direct loads only; in-app navigation shows the sheet from @ticket instead. */
export default async function AddProduct({ searchParams }: { searchParams: AddSearchParams }) {
  const context = await addFromCatalogContext(searchParams);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Produtos e serviços", href: "/produtos" }, { label: "Novo" }]}
        title="Novo produto ou serviço"
        description="Escolha do catálogo e defina o preço desta empresa."
      />
      <AddFromCatalogForm {...context} />
    </>
  );
}
