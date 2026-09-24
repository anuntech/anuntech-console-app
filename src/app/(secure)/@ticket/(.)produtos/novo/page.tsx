import { NewProjectSheet } from "@/components/projetos/project-form";
import {
  newProjectContext,
  type NewProjectSearchParams,
} from "@/components/projetos/new-project-context";
export const metadata = { title: "Novo produto ou projeto" };
export default async function Page({
  searchParams,
}: {
  searchParams: NewProjectSearchParams;
}) {
  const context = await newProjectContext(searchParams);
  return <NewProjectSheet {...context} />;
}
