import { NewProductSheet } from "@/components/produtos/product-form";
import {
  newProjectContext,
  type NewProjectSearchParams,
} from "@/components/projetos/new-project-context";
export const metadata = { title: "Novo produto" };
export default async function Page({
  searchParams,
}: {
  searchParams: NewProjectSearchParams;
}) {
  const context = await newProjectContext(searchParams);
  return <NewProductSheet {...context} />;
}
