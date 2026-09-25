import { AddFromCatalogSheet } from "@/components/produtos/add-from-catalog";
import { addFromCatalogContext, type AddSearchParams } from "@/components/produtos/add-context";
export const metadata = { title: "Novo produto ou serviço" };
export default async function Page({ searchParams }: { searchParams: AddSearchParams }) {
  const context = await addFromCatalogContext(searchParams);
  return <AddFromCatalogSheet {...context} />;
}
