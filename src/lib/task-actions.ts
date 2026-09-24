"use server";
import { and, asc, eq, isNull, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  attachments,
  auditEvents,
  engagements,
  invoices,
  subscriptions,
  taskAssignees,
  tasks,
} from "@/db/schema";
import { getActor, canAccess } from "./access";
import type { ActionState } from "./action-state";
import { db } from "./db";
import { assigneeAllowed } from "./tasks";
import { moneyToCents } from "./permissions";
import { prepareTicketFiles, takeTicketUploads } from "./ticket-files";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  hoursToMinutes,
  type TaskStatus,
} from "./task-model";

const id = z.string().uuid();
const blocked = { error: "Você não tem permissão para realizar esta ação." };
const failure = (error: unknown): ActionState => ({
  error:
    error instanceof z.ZodError
      ? error.issues[0].message
      : error instanceof Error && /etiqueta|estimativa|pessoa/i.test(error.message)
        ? error.message
        : "Não foi possível salvar. Confira os dados e tente novamente.",
});
function refresh(engagementId: string) {
  revalidatePath(`/projetos/${engagementId}`);
  revalidatePath("/projetos");
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
  dueDate: z.union([z.iso.date("Informe uma data válida."), z.literal("")]).default(""),
  estimate: z.string().trim().max(10).default(""),
});
const MAX_LABELS = 8;
const MAX_FILES_PER_TASK = 20;
const MAX_ASSIGNEES = 10;

/** People picked in the sheet; ids come from better-auth, so they are not UUIDs. */
async function parseAssignees(values: FormDataEntryValue[], companyId: string) {
  const ids = [...new Set(values.map((v) => String(v).trim()).filter((v) => v && v.length <= 128))];
  if (ids.length > MAX_ASSIGNEES) throw new Error(`Até ${MAX_ASSIGNEES} pessoas por tarefa.`);
  for (const userId of ids)
    if (!(await assigneeAllowed(userId, companyId)))
      throw new Error("Uma das pessoas escolhidas não participa deste projeto.");
  return ids;
}

/** Tags typed in the sheet: trimmed, unique, short. */
function parseLabels(values: FormDataEntryValue[]) {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const value of values) {
    const label = String(value).trim().replace(/\s+/g, " ");
    if (!label) continue;
    if (label.length > 24) throw new Error("Cada etiqueta tem até 24 caracteres.");
    const key = label.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  if (labels.length > MAX_LABELS) throw new Error(`Use até ${MAX_LABELS} etiquetas.`);
  return labels;
}
function parseEstimate(input: string) {
  if (!input) return null;
  const minutes = hoursToMinutes(input);
  if (minutes === null || minutes > 100_000)
    throw new Error("Informe a estimativa em horas, como 2 ou 1,5.");
  return minutes;
}
const message = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export async function createTask(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const input = taskInput
      .extend({ engagementId: id })
      .parse(Object.fromEntries(form));
    const labels = parseLabels(form.getAll("labels"));
    const estimateMinutes = parseEstimate(input.estimate);
    const context = await projectFor(input.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    const assigneeIds = await parseAssignees(form.getAll("assigneeIds"), project.companyId);
    let direct: Awaited<ReturnType<typeof prepareTicketFiles>>;
    try {
      direct = await prepareTicketFiles(form.getAll("files"));
    } catch (error) {
      return { error: message(error, "Anexos inválidos.") };
    }
    const result = await db.transaction(async (tx): Promise<ActionState> => {
      let uploaded: Awaited<ReturnType<typeof takeTicketUploads>>;
      try {
        uploaded = await takeTicketUploads(tx, actor.user.id, form);
      } catch (error) {
        return { error: message(error, "Anexos inválidos.") };
      }
      const files = [...direct, ...uploaded];
      if (files.length > 5) return { error: "Selecione até 5 anexos por vez." };
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
          dueDate: input.dueDate || null,
          labels,
          estimateMinutes,
          position: (last ?? 0) + STEP,
          createdBy: actor.user.id,
        })
        .returning({ id: tasks.id });
      if (assigneeIds.length)
        await tx
          .insert(taskAssignees)
          .values(assigneeIds.map((userId) => ({ taskId: row.id, userId })));
      if (files.length)
        await tx.insert(attachments).values(
          files.map((file) => ({ ...file, taskId: row.id, authorId: actor.user.id })),
        );
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.created",
        entityId: row.id,
        details: { engagementId: project.id, title: input.title },
      });
      return { success: "Tarefa criada." };
    });
    if (result.success) refresh(project.id);
    return result;
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
    const labels = parseLabels(form.getAll("labels"));
    const estimateMinutes = parseEstimate(input.estimate);
    const [current] = await db.select().from(tasks).where(eq(tasks.id, input.id));
    if (!current) return blocked;
    const context = await projectFor(current.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    const assigneeIds = await parseAssignees(form.getAll("assigneeIds"), project.companyId);
    let direct: Awaited<ReturnType<typeof prepareTicketFiles>>;
    try {
      direct = await prepareTicketFiles(form.getAll("files"));
    } catch (error) {
      return { error: message(error, "Anexos inválidos.") };
    }
    const result = await db.transaction(async (tx): Promise<ActionState> => {
      let uploaded: Awaited<ReturnType<typeof takeTicketUploads>>;
      try {
        uploaded = await takeTicketUploads(tx, actor.user.id, form);
      } catch (error) {
        return { error: message(error, "Anexos inválidos.") };
      }
      const files = [...direct, ...uploaded];
      if (files.length > 5) return { error: "Selecione até 5 anexos por vez." };
      if (files.length) {
        const [total] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(attachments)
          .where(eq(attachments.taskId, input.id));
        if (total.n + files.length > MAX_FILES_PER_TASK)
          return { error: `Limite de ${MAX_FILES_PER_TASK} anexos por tarefa atingido.` };
        await tx.insert(attachments).values(
          files.map((file) => ({ ...file, taskId: input.id, authorId: actor.user.id })),
        );
      }
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
          dueDate: input.dueDate || null,
          labels,
          estimateMinutes,
          position,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id));
      await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, input.id));
      if (assigneeIds.length)
        await tx
          .insert(taskAssignees)
          .values(assigneeIds.map((userId) => ({ taskId: input.id, userId })));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.updated",
        entityId: input.id,
        details: { engagementId: project.id, status: input.status },
      });
      return { success: "Tarefa atualizada." };
    });
    if (result.success) refresh(project.id);
    return result;
  } catch (error) {
    return failure(error);
  }
}

/** Removes one attachment: the person who added it, the task's creator or staff. */
export async function removeTaskFile(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const fileId = id.parse(form.get("id"));
    const [file] = await db
      .select({ id: attachments.id, taskId: attachments.taskId, authorId: attachments.authorId, name: attachments.name })
      .from(attachments)
      .where(eq(attachments.id, fileId));
    if (!file?.taskId) return blocked;
    const [task] = await db.select().from(tasks).where(eq(tasks.id, file.taskId));
    if (!task) return blocked;
    const context = await projectFor(task.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    if (!actor.admin && file.authorId !== actor.user.id && task.createdBy !== actor.user.id)
      return blocked;
    await db.transaction(async (tx) => {
      await tx.delete(attachments).where(eq(attachments.id, fileId));
      await tx.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, task.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.updated",
        entityId: task.id,
        details: { engagementId: project.id, removedFile: file.name },
      });
    });
    refresh(project.id);
    return { success: "Anexo removido." };
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
      await tx.delete(attachments).where(eq(attachments.taskId, taskId));
      await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
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

/** Name, description and, for products, the link (staff only). */
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
        name: z.string().trim().min(1, "Dê um nome.").max(160),
        description: z.string().trim().max(3000).default(""),
        url: z.string().trim().max(2048).optional(),
        amount: z.string().trim().max(20).optional(),
      })
      .parse(Object.fromEntries(form));
    const amountCents =
      input.amount === undefined ? undefined : input.amount ? moneyToCents(input.amount) : null;
    if (input.amount && amountCents === null)
      return { error: "Informe um valor entre R$ 0,01 e R$ 9.999.999,99." };
    if (input.url) {
      try {
        const parsed = new URL(input.url);
        if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password)
          throw new Error();
      } catch {
        return { error: "Informe um link HTTP ou HTTPS válido." };
      }
    }
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(engagements)
        .set({
          name: input.name,
          description: input.description || null,
          ...(input.url !== undefined ? { url: input.url || null } : {}),
          ...(amountCents !== undefined ? { amountCents } : {}),
        })
        .where(eq(engagements.id, input.id))
        .returning();
      if (!row) throw Error();
      // A new price also drives the recurrence, for the periods not yet issued.
      if (amountCents && row.subscriptionId) {
        const [sub] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, row.subscriptionId))
          .for("update");
        if (sub && sub.status !== "cancelled") {
          await tx
            .update(subscriptions)
            .set({ amountCents })
            .where(eq(subscriptions.id, sub.id));
          await tx
            .update(invoices)
            .set({ amountCents })
            .where(
              and(
                eq(invoices.subscriptionId, sub.id),
                eq(invoices.dueDate, sub.nextDueDate),
                eq(invoices.status, "draft"),
                isNull(invoices.bankRequest),
              ),
            );
        }
      }
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "engagement.updated",
        entityId: row.id,
      });
    });
    refresh(input.id);
    revalidatePath("/financeiro");
    return { success: "Alterações salvas." };
  } catch (error) {
    return failure(error);
  }
}
