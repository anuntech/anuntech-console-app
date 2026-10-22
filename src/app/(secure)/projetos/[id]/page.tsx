import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getActor, canAccess } from "@/lib/access/access";
import { saoPauloDate } from "@/lib/dates";
import { projectPeople } from "@/lib/projects/tasks";
import { findEngagement, projectTasks } from "@/lib/projects/project-view";
import { engagementLinks } from "@/lib/record-links";
import { ProjectBoard } from "@/components/projetos/project-board";
import { projectActivity } from "@/lib/projects/project-activity";
export const metadata: Metadata = {
  title: "Projeto",
  description: "O quadro de tarefas de um produto ou projeto.",
};

export default async function Project({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getActor();
  const { id } = await params;
  const row = await findEngagement(actor, id);
  if (!row) notFound();
  if (row.project.kind !== "project") redirect("/produtos");
  const now = new Date();
  const [tasks, people, links, activity] = await Promise.all([
    projectTasks(actor, row.project, now),
    projectPeople(row.project.companyId, id),
    // Staff see "Excluir" only when nothing billed or signed points at it.
    actor.admin ? engagementLinks([id]) : null,
    projectActivity(id, row.project.companyId),
  ]);
  return (
    <ProjectBoard
      data={{
        project: {
          id: row.project.id,
          name: row.project.name,
          kind: row.project.kind,
          status: row.project.status,
          description: row.project.description,
          companyId: row.project.companyId,
          company: row.company,
          companyDocument: row.companyDocument,
          links: links?.get(id),
        },
        tasks,
        people: people.map((person) => ({
          id: person.id,
          name: person.name,
          image: person.image,
        })),
        viewer: {
          id: actor.user.id,
          admin: actor.admin,
          // Administradores answer for the company: they approve deliveries.
          approver: actor.admin || canAccess(actor, row.project.companyId, "finance"),
        },
        today: saoPauloDate(now),
        now: now.toISOString(),
        activity,
      }}
    />
  );
}
