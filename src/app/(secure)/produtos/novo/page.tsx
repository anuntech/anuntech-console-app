import type { Metadata } from "next";
import { PageHeader } from "@/components/console/page-header";
import { NewProductForm } from "@/components/produtos/product-form";
import {
  newProjectContext,
  type NewProjectSearchParams,
} from "@/components/projetos/new-project-context";
export const metadata: Metadata = { title: "Novo produto" };

/** Direct loads only; in-app navigation shows the sheet from @ticket instead. */
export default async function NewProduct({
  searchParams,
}: {
  searchParams: NewProjectSearchParams;
}) {
  const context = await newProjectContext(searchParams);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Produtos", href: "/produtos" }, { label: "Novo" }]}
        title="Novo produto"
        description="Um produto que a empresa contratou; o cliente abre pelo link."
      />
      <NewProductForm {...context} />
    </>
  );
}
