import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getActor } from "@/lib/access/access";
import { projectListQuery } from "@/lib/projects/project-table";
import { listProjects } from "@/lib/projects/project-list";
import { engagementLinks } from "@/lib/record-links";
import { Button } from "@/components/ui/button";
import { listLayoutFor } from "@/lib/list-layout-server";
import { PageHeader } from "@/components/console/page-header";
import { ProjectsList } from "@/components/projetos/projects-list";
export const metadata: Metadata = {
  title: "Projetos",
  description: "Os projetos em andamento e o quadro de tarefas de cada um.",
};

export default async function Projects({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const view = await listLayoutFor("projects");
  const list = await listProjects(actor, projectListQuery(await searchParams));
  // Staff see "Excluir" only where nothing billed or signed points at the project.
  const links = actor.admin ? await engagementLinks(list.rows.map((row) => row.id)) : null;
  return (
    <>
      <PageHeader
        className="mb-4"
        title="Projetos"
        count={list.total}
      />
      <ProjectsList
        view={view}
        actions={
          actor.admin && (
            <Button asChild>
              <Link href="/projetos/novo" data-assistant-action="">
                <PlusIcon />
                Novo projeto
              </Link>
            </Button>
          )
        }
        rows={list.rows.map((row) => ({ ...row, links: links?.get(row.id) }))}
        query={list.paging}
        total={list.total}
        pageCount={list.pageCount}
        now={new Date().toISOString()}
        admin={actor.admin}
        showCompany={list.showCompany}
        companyFilter={list.companyFilter}
        companyShortcuts={list.shortcuts}
      />
    </>
  );
}
