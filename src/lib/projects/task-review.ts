import "server-only";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { answersForClient, canSeeEngagement, ASSISTED_DECISION, type Actor } from "../access/access";
import { auditEvents, engagements, taskComments, tasks } from "@/db/schema";
import type { ActionState } from "../action-state";
import { sendOpsMail } from "../notifications/ops-alerts";
import { refreshBoard, STEP, taskFailure } from "./task-common";
import type { TaskStatus } from "./task-model";

const reviewNote = z.string().trim().max(5000, "Use até 5 mil caracteres.").default("");
/** What the web's form and the app's projects.reviewTask send. */
export const taskReviewInput = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approve", "problem"]),
  note: reviewNote,
});
export type TaskReview = z.output<typeof taskReviewInput>;

const LEFT_REVIEW = "Esta tarefa não está mais em Revisão.";

/**
 * The client's answer to a delivery in Revisão: approve it (the task is
 * done, with who and when on record) or report a problem (it goes back to
 * the team with the report as a comment). The web's reviewTask and the
 * app's projects.reviewTask. Administradores answer for the company, as
 * with quotes and contracts: never the team, not even in assisted access.
 */
export async function reviewTaskAs(actor: Actor, input: TaskReview): Promise<ActionState> {
  try {
    const note = reviewNote.parse(input.note);
    const [current] = await db.select().from(tasks).where(eq(tasks.id, input.id));
    if (!current) return { error: "Você não tem permissão para fazer isso." };
    const [project] = await db
      .select({ id: engagements.id, companyId: engagements.companyId, name: engagements.name })
      .from(engagements)
      .where(eq(engagements.id, current.engagementId));
    if (!project || !canSeeEngagement(actor, project)) return { error: "Você não tem permissão para fazer isso." };
    if (actor.assisting) return { error: ASSISTED_DECISION };
    // The team sees Revisão too, but the approval is the client's: the board hides the button from staff.
    if (!answersForClient(actor, project.companyId)) return { error: "Só um Administrador da empresa aprova entregas." };
    if (current.status !== "review") return { error: LEFT_REVIEW };
    if (input.decision === "problem" && !note) return { error: "Conte o que não funcionou como esperado." };
    await db.transaction(async (tx) => {
      // Two answers at once (a double tap, the web and the app): only the first finds the task in Revisão.
      const [locked] = await tx.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, current.id)).for("update");
      if (locked?.status !== "review") throw Error(LEFT_REVIEW);
      const status: TaskStatus = input.decision === "approve" ? "done" : "in_progress";
      const [{ last }] = await tx
        .select({ last: max(tasks.position) })
        .from(tasks)
        .where(and(eq(tasks.engagementId, project.id), eq(tasks.status, status)));
      const now = new Date();
      await tx
        .update(tasks)
        .set({
          status,
          position: (last ?? 0) + STEP,
          reviewSince: null,
          approvedBy: input.decision === "approve" ? actor.user.id : null,
          approvedAt: input.decision === "approve" ? now : null,
          updatedAt: now,
        })
        .where(eq(tasks.id, current.id));
      if (note)
        await tx.insert(taskComments).values({
          taskId: current.id,
          authorId: actor.user.id,
          body: input.decision === "approve" ? note : `Encontrei um problema: ${note}`,
        });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: input.decision === "approve" ? "task.approved" : "task.review_failed",
        entityId: current.id,
        details: { engagementId: project.id },
      });
    });
    refreshBoard(project.id);
    // A problem in a delivery reaches the team now, not at the next look at the board.
    if (input.decision === "problem")
      await sendOpsMail(
        `[Console] Problema apontado numa entrega: ${current.title}`,
        `${actor.user.name || actor.user.email} apontou um problema em "${current.title}" (${project.name}).\n\n${note}\n\nO cartão voltou para Em andamento: ${process.env.BETTER_AUTH_URL || "https://console.anuntech.com"}/projetos/${project.id}\n\nConsole da Anuntech`,
      ).catch(() => undefined);
    return { success: input.decision === "approve" ? "Entrega aprovada." : "Problema enviado à equipe." };
  } catch (error) {
    if (error instanceof Error && error.message === LEFT_REVIEW) return { error: LEFT_REVIEW };
    return taskFailure(error);
  }
}
