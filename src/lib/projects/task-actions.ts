"use server";
import { and, asc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { sendOpsMail } from "../notifications/ops-alerts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  attachments,
  auditEvents,
  engagements,
  invoices,
  subscriptions,
  taskAssignees,
  taskComments,
  tasks,
} from "@/db/schema";
import { getActor, canAccess, canSeeEngagement } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { assigneeAllowed } from "./tasks";
import { moneyToCents } from "../access/permissions";
import { prepareTicketFiles, takeTicketUploads } from "../tickets/ticket-files";
import { DOCUMENT_ATTACHMENTS } from "../tickets/attachment-rules";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  hoursToMinutes,
  type TaskStatus,
} from "./task-model";

const id = z.string().uuid();
const blocked = { error: "Você não tem permissão para fazer isso." };
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

/** Anyone who sees the project (its company and, for a Membro with a selection, the project itself) works on its board. */
async function projectFor(engagementId: string) {
  const actor = await getActor();
  const [project] = await db
    .select({ id: engagements.id, companyId: engagements.companyId, name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId));
  if (!project || !canSeeEngagement(actor, project)) return null;
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
const MAX_FILES_AT_ONCE = DOCUMENT_ATTACHMENTS.max;
/** Who may remove a saved attachment: staff, whoever added it, or the task's creator. */
const canRemoveFile = (
  actor: { admin: boolean; user: { id: string } },
  file: { authorId: string | null },
  task: { createdBy: string | null },
) => actor.admin || file.authorId === actor.user.id || task.createdBy === actor.user.id;

/**
 * People picked in the sheet; ids come from better-auth, so they are not UUIDs.
 * Someone already on the task stays without a new check: a Membro narrowed to
 * other projects (or removed) must not block every later save of the card.
 */
async function parseAssignees(
  values: FormDataEntryValue[],
  project: { id: string; companyId: string },
  already: ReadonlySet<string> = new Set(),
) {
  const ids = [...new Set(values.map((v) => String(v).trim()).filter((v) => v && v.length <= 128))];
  if (ids.length > MAX_ASSIGNEES) throw new Error(`Até ${MAX_ASSIGNEES} pessoas por tarefa.`);
  for (const userId of ids)
    if (!already.has(userId) && !(await assigneeAllowed(userId, project.companyId, project.id)))
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
    const assigneeIds = await parseAssignees(form.getAll("assigneeIds"), project);
    // A task the client creates is a request: it waits in the Backlog until the team takes it into the work.
    if (!actor.admin) input.status = "backlog";
    let direct: Awaited<ReturnType<typeof prepareTicketFiles>>;
    try {
      direct = await prepareTicketFiles(form.getAll("files"));
    } catch (error) {
      return { error: message(error, "Não foi possível ler os anexos. Selecione os arquivos de novo.") };
    }
    const result = await db.transaction(async (tx): Promise<ActionState> => {
      let uploaded: Awaited<ReturnType<typeof takeTicketUploads>>;
      try {
        uploaded = await takeTicketUploads(tx, actor.user.id, form);
      } catch (error) {
        return { error: message(error, "Não foi possível ler os anexos. Selecione os arquivos de novo.") };
      }
      const files = [...direct, ...uploaded];
      if (files.length > MAX_FILES_AT_ONCE)
        return { error: `Selecione até ${MAX_FILES_AT_ONCE} anexos por vez.` };
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
          requested: !actor.admin,
          reviewSince: input.status === "review" ? new Date() : null,
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
      return { success: actor.admin ? "Tarefa criada." : "Pedido criado no Backlog. A equipe confirma se ele faz parte do combinado." };
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
    const assigned = await db.select({ userId: taskAssignees.userId }).from(taskAssignees).where(eq(taskAssignees.taskId, current.id));
    const assigneeIds = await parseAssignees(form.getAll("assigneeIds"), project, new Set(assigned.map((a) => a.userId)));
    const refused = statusRefusal(actor.admin, current, input.status);
    if (refused) return { error: refused };
    // Saved files the sheet marked for removal go only when the task saves.
    const removeIds = [...new Set(form.getAll("removeFileId").map(String))];
    if (removeIds.length > MAX_FILES_PER_TASK || removeIds.some((value) => !id.safeParse(value).success))
      return blocked;
    const removing = removeIds.length
      ? await db
          .select({ id: attachments.id, taskId: attachments.taskId, authorId: attachments.authorId, name: attachments.name })
          .from(attachments)
          .where(inArray(attachments.id, removeIds))
      : [];
    // A file already gone is fine; one from another task, or not theirs to remove, blocks the save.
    if (removing.some((file) => file.taskId !== current.id || !canRemoveFile(actor, file, current)))
      return blocked;
    let direct: Awaited<ReturnType<typeof prepareTicketFiles>>;
    try {
      direct = await prepareTicketFiles(form.getAll("files"));
    } catch (error) {
      return { error: message(error, "Não foi possível ler os anexos. Selecione os arquivos de novo.") };
    }
    const result = await db.transaction(async (tx): Promise<ActionState> => {
      let uploaded: Awaited<ReturnType<typeof takeTicketUploads>>;
      try {
        uploaded = await takeTicketUploads(tx, actor.user.id, form);
      } catch (error) {
        return { error: message(error, "Não foi possível ler os anexos. Selecione os arquivos de novo.") };
      }
      const files = [...direct, ...uploaded];
      if (files.length > MAX_FILES_AT_ONCE)
        return { error: `Selecione até ${MAX_FILES_AT_ONCE} anexos por vez.` };
      if (files.length) {
        const [total] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(attachments)
          .where(and(eq(attachments.taskId, input.id), isNull(attachments.commentId)));
        if (total.n - removing.length + files.length > MAX_FILES_PER_TASK)
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
          ...statusSideEffects(actor.admin, current, input.status),
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
      // Same removal and audit trail as removeTaskFile, one event per file.
      if (removing.length) {
        const removed = await tx
          .delete(attachments)
          .where(and(inArray(attachments.id, removing.map((file) => file.id)), eq(attachments.taskId, input.id)))
          .returning({ name: attachments.name });
        if (removed.length)
          await tx.insert(auditEvents).values(
            removed.map((file) => ({
              actorId: actor.user.id,
              companyId: project.companyId,
              action: "task.updated",
              entityId: input.id,
              details: { engagementId: project.id, removedFile: file.name },
            })),
          );
      }
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
    if (!canRemoveFile(actor, file, task)) return blocked;
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
    const refused = statusRefusal(actor.admin, current, status);
    if (refused) return { error: refused };
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
        .set({ status, position, ...statusSideEffects(actor.admin, current, status), updatedAt: new Date() })
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

/**
 * The board's rules for the client (D16): only the team concludes a task,
 * and a client's request stays in the Backlog until the team takes it in.
 * In Revisão, the client approves or reports a problem (reviewTask).
 */
function statusRefusal(admin: boolean, current: typeof tasks.$inferSelect, next: TaskStatus) {
  if (admin || next === current.status) return null;
  if (next === "done")
    return current.status === "review"
      ? "Para concluir, use Aprovar na tarefa em Revisão."
      : "Só a equipe conclui tarefas. Quando a entrega estiver pronta, ela aparece em Revisão para você aprovar.";
  // Only the team says a delivery is ready; in Revisão the client answers through Revisar.
  if (next === "review") return "Só a equipe coloca uma entrega em Revisão.";
  if (current.status === "review") return "Esta entrega está em Revisão: use Revisar para aprovar ou apontar um problema.";
  // Leaving Concluído would erase who approved and when; reopening a delivery is the team's call.
  if (current.status === "done") return "Esta tarefa está concluída. Para reabrir, comente na tarefa ou abra um chamado.";
  if (current.requested && current.status === "backlog")
    return "Este pedido fica no Backlog até a equipe confirmar se ele faz parte do combinado.";
  return null;
}

/** Entering Revisão starts the client's test window; the team moving a request takes it into the work. */
function statusSideEffects(admin: boolean, current: typeof tasks.$inferSelect, next: TaskStatus) {
  if (next === current.status) return {};
  return {
    reviewSince: next === "review" ? new Date() : null,
    ...(admin && current.requested && next !== "backlog" ? { requested: false } : {}),
    ...(next !== "done" ? { approvedBy: null, approvedAt: null } : {}),
  };
}

/**
 * The client's answer to a delivery in Revisão: approve it (the task is
 * done, with who and when on record) or report a problem (it goes back to
 * the team with the report as a comment). Administradores answer for the
 * company, as with quotes and contracts.
 */
export async function reviewTask(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const input = z
      .object({
        id,
        decision: z.enum(["approve", "problem"]),
        note: z.string().trim().max(5000, "Use até 5 mil caracteres.").default(""),
      })
      .parse(Object.fromEntries(form));
    const [current] = await db.select().from(tasks).where(eq(tasks.id, input.id));
    if (!current) return blocked;
    const context = await projectFor(current.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    if (!actor.admin && !canAccess(actor, project.companyId, "finance"))
      return { error: "Só um Administrador da empresa aprova entregas." };
    if (current.status !== "review") return { error: "Esta tarefa não está mais em Revisão." };
    if (input.decision === "problem" && !input.note) return { error: "Conte o que não funcionou como esperado." };
    await db.transaction(async (tx) => {
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
      if (input.note)
        await tx.insert(taskComments).values({
          taskId: current.id,
          authorId: actor.user.id,
          body: input.decision === "approve" ? input.note : `Encontrei um problema: ${input.note}`,
        });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: input.decision === "approve" ? "task.approved" : "task.review_failed",
        entityId: current.id,
        details: { engagementId: project.id },
      });
    });
    refresh(project.id);
    // A problem in a delivery reaches the team now, not at the next look at the board.
    if (input.decision === "problem")
      await sendOpsMail(
        `[Console] Problema apontado numa entrega: ${current.title}`,
        `${actor.user.name || actor.user.email} apontou um problema em "${current.title}" (${project.name}).\n\n${input.note}\n\nO cartão voltou para Em andamento: ${process.env.BETTER_AUTH_URL || "https://console.anuntech.com"}/projetos/${project.id}\n\nConsole da Anuntech`,
      ).catch(() => undefined);
    return { success: input.decision === "approve" ? "Entrega aprovada." : "Problema enviado à equipe." };
  } catch (error) {
    return failure(error);
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
      await tx.delete(taskComments).where(eq(taskComments.taskId, taskId));
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

const commentInput = z.object({
  taskId: id,
  body: z.string().trim().max(5000, "O comentário excede o tamanho permitido."),
});

/** A comment on a task, by anyone who can open its board: text, files or both. */
export async function addTaskComment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const input = commentInput.parse({ taskId: form.get("taskId"), body: form.get("body") ?? "" });
    const [task] = await db
      .select({ id: tasks.id, title: tasks.title, engagementId: tasks.engagementId })
      .from(tasks)
      .where(eq(tasks.id, input.taskId));
    if (!task) return blocked;
    const context = await projectFor(task.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    let direct: Awaited<ReturnType<typeof prepareTicketFiles>>;
    try {
      direct = await prepareTicketFiles(form.getAll("files"));
    } catch (error) {
      return { error: message(error, "Não foi possível ler os anexos. Selecione os arquivos de novo.") };
    }
    const result = await db.transaction(async (tx): Promise<ActionState> => {
      let uploaded: Awaited<ReturnType<typeof takeTicketUploads>>;
      try {
        uploaded = await takeTicketUploads(tx, actor.user.id, form);
      } catch (error) {
        return { error: message(error, "Não foi possível ler os anexos. Selecione os arquivos de novo.") };
      }
      const files = [...direct, ...uploaded];
      if (!input.body && !files.length) return { error: "Escreva o comentário ou anexe um arquivo." };
      if (files.length > MAX_FILES_AT_ONCE)
        return { error: `Selecione até ${MAX_FILES_AT_ONCE} anexos por vez.` };
      const [comment] = await tx
        .insert(taskComments)
        .values({ taskId: task.id, authorId: actor.user.id, body: input.body })
        .returning({ id: taskComments.id });
      if (files.length)
        await tx.insert(attachments).values(
          files.map((file) => ({ ...file, taskId: task.id, commentId: comment.id, authorId: actor.user.id })),
        );
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.commented",
        entityId: task.id,
        details: { engagementId: project.id, title: task.title, commentId: comment.id, files: files.length },
      });
      return { success: "Comentário publicado." };
    });
    if (result.success) refresh(project.id);
    return result;
  } catch (error) {
    return failure(error);
  }
}

/**
 * Only whoever wrote a comment changes its words (the team can delete, not
 * rewrite, someone else's). A comment with files may end up without text.
 */
export async function updateTaskComment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const commentId = id.parse(form.get("id"));
    const body = z
      .string()
      .trim()
      .max(5000, "O comentário excede o tamanho permitido.")
      .parse(form.get("body") ?? "");
    const [comment] = await db
      .select({ id: taskComments.id, authorId: taskComments.authorId, body: taskComments.body, taskId: tasks.id, title: tasks.title, engagementId: tasks.engagementId })
      .from(taskComments)
      .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
      .where(eq(taskComments.id, commentId));
    if (!comment) return blocked;
    const context = await projectFor(comment.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    if (comment.authorId !== actor.user.id) return { error: "Só quem escreveu o comentário pode editá-lo." };
    if (body === comment.body) return { success: "Comentário sem alterações." };
    if (!body) {
      const [files] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(attachments)
        .where(eq(attachments.commentId, comment.id));
      if (!files.n) return { error: "Escreva o comentário ou exclua-o." };
    }
    await db.transaction(async (tx) => {
      await tx.update(taskComments).set({ body, editedAt: new Date() }).where(eq(taskComments.id, comment.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.comment_edited",
        entityId: comment.taskId,
        details: { engagementId: project.id, title: comment.title, commentId: comment.id },
      });
    });
    refresh(project.id);
    return { success: "Comentário editado." };
  } catch (error) {
    return failure(error);
  }
}

/** Whoever wrote it, or the team, can take a comment back. */
export async function deleteTaskComment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const commentId = id.parse(form.get("id"));
    const [comment] = await db
      .select({ id: taskComments.id, authorId: taskComments.authorId, taskId: tasks.id, title: tasks.title, engagementId: tasks.engagementId })
      .from(taskComments)
      .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
      .where(eq(taskComments.id, commentId));
    if (!comment) return blocked;
    const context = await projectFor(comment.engagementId);
    if (!context) return blocked;
    const { actor, project } = context;
    if (!actor.admin && comment.authorId !== actor.user.id)
      return { error: "Só quem escreveu o comentário ou a equipe pode excluí-lo." };
    await db.transaction(async (tx) => {
      await tx.delete(attachments).where(eq(attachments.commentId, comment.id));
      await tx.delete(taskComments).where(eq(taskComments.id, comment.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.comment_deleted",
        entityId: comment.taskId,
        details: { engagementId: project.id, title: comment.title },
      });
    });
    refresh(project.id);
    return { success: "Comentário excluído." };
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
