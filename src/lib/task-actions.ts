"use server";
import { and, asc, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, engagements, tasks } from "@/db/schema";
import { getActor, canAccess } from "./access";
import type { ActionState } from "./action-state";
import { db } from "./db";
import { assigneeAllowed } from "./tasks";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskStatus } from "./task-model";

const id = z.string().uuid();
const blocked = { error: "Você não tem permissão para realizar esta ação." };
const failure = (error: unknown): ActionState => ({
  error:
    error instanceof z.ZodError
      ? error.issues[0].message
      : "Não foi possível salvar. Confira os dados e tente novamente.",
});
function refresh(engagementId: string) {
  revalidatePath(`/produtos/${engagementId}`);
  revalidatePath("/produtos");
}
/** Spaced positions let a card slot between two others without renumbering. */
const STEP = 1024;

/** Anyone who can open the project's company can work on its board. */
async function projectFor(engagementId: string) {
  const actor = await getActor();
  const [project] = await db
    .select({ id: engagements.id, companyId: engagements.companyId })
    .from(engagements)
    .where(eq(engagements.id, engagementId));
  if (!project || !canAccess(actor, project.companyId, "overview")) return null;
  return { actor, project };
}

const taskInput = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Dê um título à tarefa.")
    .max(200, "O título excede o tamanho permitido."),
  description: z.string().trim().max(5000, "A descrição excede o tamanho permitido.").default(""),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  // User ids come from better-auth and are not UUIDs; membership is checked separately.
  assigneeId: z.union([z.string().trim().min(1).max(128), z.literal("")]).default(""),
  dueDate: z.union([z.iso.date("Informe uma data válida."), z.literal("")]).default(""),
});

export async function createTask(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const input = taskInput
      .extend({ engagementId: id })
      .parse(Object.fromEntries(form));
    const context = await projectFor(input.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    if (input.assigneeId && !(await assigneeAllowed(input.assigneeId, project.companyId)))
      return { error: "Essa pessoa não participa deste projeto." };
    await db.transaction(async (tx) => {
      const [{ last }] = await tx
        .select({ last: max(tasks.position) })
        .from(tasks)
        .where(and(eq(tasks.engagementId, project.id), eq(tasks.status, input.status)));
      const [row] = await tx
        .insert(tasks)
        .values({
          engagementId: project.id,
          companyId: project.companyId,
          title: input.title,
          description: input.description || null,
          status: input.status,
          priority: input.priority,
          assigneeId: input.assigneeId || null,
          dueDate: input.dueDate || null,
          position: (last ?? 0) + STEP,
          createdBy: actor.user.id,
        })
        .returning({ id: tasks.id });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.created",
        entityId: row.id,
        details: { engagementId: project.id, title: input.title },
      });
    });
    refresh(project.id);
    return { success: "Tarefa criada." };
  } catch (error) {
    return failure(error);
  }
}

export async function updateTask(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const input = taskInput.extend({ id }).parse(Object.fromEntries(form));
    const [current] = await db.select().from(tasks).where(eq(tasks.id, input.id));
    if (!current) return blocked;
    const context = await projectFor(current.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    if (input.assigneeId && !(await assigneeAllowed(input.assigneeId, project.companyId)))
      return { error: "Essa pessoa não participa deste projeto." };
    await db.transaction(async (tx) => {
      // A status change through the form lands at the end of the new column.
      const position =
        input.status === current.status
          ? current.position
          : ((
              await tx
                .select({ last: max(tasks.position) })
                .from(tasks)
                .where(and(eq(tasks.engagementId, project.id), eq(tasks.status, input.status)))
            )[0].last ?? 0) + STEP;
      await tx
        .update(tasks)
        .set({
          title: input.title,
          description: input.description || null,
          status: input.status,
          priority: input.priority,
          assigneeId: input.assigneeId || null,
          dueDate: input.dueDate || null,
          position,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.updated",
        entityId: input.id,
        details: { engagementId: project.id, status: input.status },
      });
    });
    refresh(project.id);
    return { success: "Tarefa atualizada." };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Drag and drop: the card lands in `status` after `afterId` (or first when
 * empty). Positions are recomputed only when two neighbours collide.
 */
export async function moveTask(input: {
  id: string;
  status: TaskStatus;
  afterId: string | null;
}): Promise<ActionState> {
  try {
    const taskId = id.parse(input.id);
    const status = z.enum(TASK_STATUSES).parse(input.status);
    const afterId = input.afterId ? id.parse(input.afterId) : null;
    const [current] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!current) return blocked;
    const context = await projectFor(current.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    await db.transaction(async (tx) => {
      const column = (
        await tx
          .select({ id: tasks.id, position: tasks.position })
          .from(tasks)
          .where(and(eq(tasks.engagementId, project.id), eq(tasks.status, status)))
          .orderBy(asc(tasks.position), asc(tasks.createdAt))
      ).filter((row) => row.id !== taskId);
      const index = afterId ? column.findIndex((row) => row.id === afterId) + 1 : 0;
      const before = column[index - 1]?.position;
      const after = column[index]?.position;
      let position: number;
      if (before === undefined && after === undefined) position = STEP;
      else if (before === undefined) position = after! - STEP;
      else if (after === undefined) position = before + STEP;
      else position = Math.floor((before + after) / 2);
      if (
        (before !== undefined && position <= before) ||
        (after !== undefined && position >= after)
      ) {
        // Neighbours too close: renumber the column with the card in place.
        const ordered = [...column.slice(0, index), { id: taskId, position: 0 }, ...column.slice(index)];
        for (const [i, row] of ordered.entries())
          await tx
            .update(tasks)
            .set({ position: (i + 1) * STEP })
            .where(eq(tasks.id, row.id));
        position = (index + 1) * STEP;
      }
      await tx
        .update(tasks)
        .set({ status, position, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
      if (current.status !== status)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: project.companyId,
          action: "task.moved",
          entityId: taskId,
          details: { engagementId: project.id, from: current.status, to: status },
        });
    });
    refresh(project.id);
    return { success: "" };
  } catch {
    return { error: "Não foi possível mover a tarefa. Recarregue a página e tente de novo." };
  }
}

export async function deleteTask(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const taskId = id.parse(form.get("id"));
    const [current] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!current) return blocked;
    const context = await projectFor(current.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    if (!actor.admin && current.createdBy !== actor.user.id)
      return { error: "Só quem criou a tarefa ou a equipe pode excluí-la." };
    await db.transaction(async (tx) => {
      await tx.delete(tasks).where(eq(tasks.id, taskId));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.deleted",
        entityId: taskId,
        details: { engagementId: project.id, title: current.title },
      });
    });
    refresh(project.id);
    return { success: "Tarefa excluída." };
  } catch (error) {
    return failure(error);
  }
}

/** Renames a project or changes its description (staff only). */
export async function updateProject(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        id,
        name: z.string().trim().min(1, "Dê um nome ao projeto.").max(160),
        kind: z.enum(["product", "project"]),
        description: z.string().trim().max(3000).default(""),
      })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(engagements)
        .set({ name: input.name, kind: input.kind, description: input.description || null })
        .where(eq(engagements.id, input.id))
        .returning();
      if (!row) throw Error();
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "engagement.updated",
        entityId: row.id,
      });
    });
    refresh(input.id);
    return { success: "Projeto atualizado." };
  } catch (error) {
    return failure(error);
  }
}
