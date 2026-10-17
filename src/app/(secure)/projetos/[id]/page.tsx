import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { companies, engagements } from "@/db/schema";
import { getActor, canAccess, canSeeEngagement } from "@/lib/access/access";
import { saoPauloDate } from "@/lib/dates";
import { boardTasks, projectPeople } from "@/lib/projects/tasks";
import { engagementLinks } from "@/lib/record-links";
import { ProjectBoard } from "@/components/projetos/project-board";
import { governingTerms, loadCalendar, snapshotOf } from "@/lib/service-terms/terms";
import { visibleToClient } from "@/lib/service-terms/ticket-clock";
import { addBusinessMinutes } from "@/lib/service-terms/business-calendar";
import { BUSINESS_DAY_MINUTES } from "@/lib/service-terms/terms-model";
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
  if (!row || !canSeeEngagement(actor, row.project)) notFound();
  if (row.project.kind !== "project") redirect("/produtos");
  const [tasks, people, links] = await Promise.all([
    boardTasks(id),
    projectPeople(row.project.companyId, id),
    // Staff see "Excluir" only when nothing billed or signed points at it.
    actor.admin ? engagementLinks([id]) : null,
  ]);
  const now = new Date();
  // A delivery in Revisão has a test window only where the contract sets one (SUP 5.3, Serviço 4.2).
  const terms = snapshotOf(await governingTerms(row.project.companyId, id));
  const testDays = terms && !terms.personClient && (actor.admin || visibleToClient(terms, now)) ? terms.policy.testDays : null;
  const cal = testDays ? await loadCalendar() : null;
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
          links: links?.get(id),
        },
        tasks: tasks.map(({ reviewSince, approvedAt, ...task }) => ({
          ...task,
          reviewDue:
            task.status === "review" && reviewSince && testDays && cal
              ? addBusinessMinutes(reviewSince, testDays * BUSINESS_DAY_MINUTES, cal).toISOString()
              : null,
          approvedAt: approvedAt?.toISOString() ?? null,
          updatedAt: task.updatedAt.toISOString(),
          comments: task.comments.map((comment) => ({
            ...comment,
            createdAt: comment.createdAt.toISOString(),
            editedAt: comment.editedAt?.toISOString() ?? null,
          })),
        })),
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
      }}
    />
  );
}
