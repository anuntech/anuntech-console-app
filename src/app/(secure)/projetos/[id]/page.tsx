import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companies, engagements } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { saoPauloDate } from "@/lib/dates";
import { boardTasks, projectPeople } from "@/lib/tasks";
import { ProjectBoard } from "@/components/projetos/project-board";
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
  const [row] = await db
    .select({ project: engagements, company: companies.name })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .where(eq(engagements.id, id));
  if (!row || !canAccess(actor, row.project.companyId, "overview")) notFound();
  if (row.project.kind !== "project") redirect("/produtos");
  const [tasks, people] = await Promise.all([
    boardTasks(id),
    projectPeople(row.project.companyId),
  ]);
  const now = new Date();
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
        },
        tasks: tasks.map((task) => ({
          ...task,
          updatedAt: task.updatedAt.toISOString(),
        })),
        people: people.map((person) => ({
          id: person.id,
          name: person.name,
          image: person.image,
        })),
        viewer: { id: actor.user.id, admin: actor.admin },
        today: saoPauloDate(now),
        now: now.toISOString(),
      }}
    />
  );
}
