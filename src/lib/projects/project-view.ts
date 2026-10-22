import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { companies, engagements } from "@/db/schema";
import { canSeeEngagement, type Actor } from "../access/access";
import { boardTasks } from "./tasks";
import { governingTerms, loadCalendar, snapshotOf } from "../service-terms/terms";
import { visibleToClient } from "../service-terms/ticket-clock";
import { addBusinessMinutes } from "../service-terms/business-calendar";
import { BUSINESS_DAY_MINUTES } from "../service-terms/terms-model";

/**
 * A product or project with its company, or null when it does not exist or
 * is out of reach (both answer "not found"): the company's overview area and,
 * for a Membro with a selection, only the ones chosen for them. Used by
 * /projetos/[id] and the app's projects.get.
 */
export async function findEngagement(actor: Actor, id: string) {
  const [row] = await db
    .select({ project: engagements, company: companies.name, companyDocument: companies.document })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .where(eq(engagements.id, id));
  if (!row || !canSeeEngagement(actor, row.project)) return null;
  return row;
}

/**
 * The board's tasks as a viewer sees them: a delivery in Revisão carries its
 * test window only where the contract sets one (SUP 5.3, Serviço 4.2) and,
 * for a client, once the conditions are published.
 */
export async function projectTasks(actor: Actor, project: { id: string; companyId: string }, now = new Date()) {
  const [tasks, terms] = await Promise.all([
    boardTasks(project.id),
    governingTerms(project.companyId, project.id).then(snapshotOf),
  ]);
  const testDays = terms && !terms.personClient && (actor.admin || visibleToClient(terms, now)) ? terms.policy.testDays : null;
  const cal = testDays ? await loadCalendar() : null;
  return tasks.map(({ reviewSince, approvedAt, ...task }) => ({
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
  }));
}
