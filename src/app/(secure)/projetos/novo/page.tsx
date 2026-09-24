import type { Metadata } from "next";
import { PageHeader } from "@/components/console/page-header";
import { NewProjectForm } from "@/components/projetos/project-form";
import {
  newProjectContext,
  type NewProjectSearchParams,
} from "@/components/projetos/new-project-context";
export const metadata: Metadata = { title: "Novo projeto" };

/** Direct loads only; in-app navigation shows the sheet from @ticket instead. */
export default async function NewProject({
  searchParams,
}: {
  searchParams: NewProjectSearchParams;
}) {
  const context = await newProjectContext(searchParams);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Projetos", href: "/projetos" }, { label: "Novo" }]}
        title="Novo projeto"
        description="O projeto fica vinculado à empresa e ganha um quadro de tarefas."
      />
      <NewProjectForm {...context} />
    </>
  );
}
