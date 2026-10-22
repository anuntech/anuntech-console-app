import "server-only";
import { and, asc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { z } from "zod";
import { attachments, auditEvents, engagements, taskAssignees, taskComments, tasks } from "@/db/schema";
import { canSeeEngagement, type Actor } from "../access/access";
import type { ActionState } from "../action-state";
import { logDatabaseFault } from "../action-errors";
import { db } from "../db";
import { refreshBoard as refresh, STEP, taskFailure as failure } from "./task-common";
import { assigneeAllowed } from "./tasks";
import { prepareTicketFiles, takeTicketUploads } from "../tickets/ticket-files";
import { DOCUMENT_ATTACHMENTS } from "../tickets/attachment-rules";
import { enqueueReviewPush, schedulePushNotices } from "../notifications/push-queue";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskStatus } from "./task-model";
import {
  MAX_FILES_PER_TASK,
  assigneeIdsOf,
  canDeleteTask,
  canRemoveFile,
  parseEstimate,
  parseLabels,
  statusRefusal,
  statusSideEffects,
} from "./task-rules";

/*
 * The board's changes, for whoever is acting: the web's actions
 * (task-actions.ts) read the FormData and call these, and so do the app's
 * procedures (api/procedures/projects.ts). Same checks, same audit trail,
 * same push and same refresh on both sides.
 */

const id = z.string().uuid();
const blocked = { error: "Você não tem permissão para fazer isso." };
const MAX_FILES_AT_ONCE = DOCUMENT_ATTACHMENTS.max;

/** Anyone who sees the project (its company and, for a Membro with a selection, the project itself) works on its board. */
async function projectOf(actor: Actor, engagementId: string) {
  const [project] = await db
    .select({ id: engagements.id, companyId: engagements.companyId, name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId));
  if (!project || !canSeeEngagement(actor, project)) return null;
  return project;
}

export const taskInput = z.object({
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

/**
 * What the sheet sends: the fields of taskInput as typed, plus the lists
 * (labels, people, staged uploads and, when editing, the saved files to
 * remove). Raw on purpose: the cores validate it, so both callers get the
 * same messages.
 */
export type TaskDraft = {
  [field: string]: unknown;
  labels?: readonly unknown[];
  assigneeIds?: readonly unknown[];
  uploadIds?: readonly unknown[];
  removeFileIds?: readonly unknown[];
};

/**
 * People picked in the sheet; ids come from better-auth, so they are not UUIDs.
 * Someone already on the task stays without a new check: a Membro narrowed to
 * other projects (or removed) must not block every later save of the card.
 */
async function parseAssignees(
  values: readonly unknown[],
  project: { id: string; companyId: string },
  already: ReadonlySet<string> = new Set(),
) {
  const ids = assigneeIdsOf(values);
  for (const userId of ids)
    if (!already.has(userId) && !(await assigneeAllowed(userId, project.companyId, project.id)))
      throw new Error("Uma das pessoas escolhidas não participa deste projeto.");
  return ids;
}

const message = (error: unknown, fallback: string) =>
  error instanceof Error && error.message && !logDatabaseFault("task uploads", error) ? error.message : fallback;
const unreadable = "Não foi possível ler os anexos. Selecione os arquivos de novo.";
const uploadIdsOf = (draft: { uploadIds?: readonly unknown[] }) => (draft.uploadIds ?? []).map(String);

/**
 * A new task. `files` are the ones the web form posts directly; the app's
 * come staged, by `uploadIds`. A task the client creates is a request.
 */
export async function createTaskAs(
  actor: Actor,
  draft: TaskDraft,
  files: FormDataEntryValue[] = [],
): Promise<ActionState & { id?: string }> {
  try {
    const input = taskInput.extend({ engagementId: id }).parse(draft);
    const labels = parseLabels(draft.labels ?? []);
    const estimateMinutes = parseEstimate(input.estimate);
    const project = await projectOf(actor, input.engagementId);
    if (!project) return blocked;
    const assigneeIds = await parseAssignees(draft.assigneeIds ?? [], project);
    // A task the client creates is a request: it waits in the Backlog until the team takes it into the work.
    if (!actor.admin) input.status = "backlog";
    let direct: Awaited<ReturnType<typeof prepareTicketFiles>>;
    try {
      direct = await prepareTicketFiles(files);
    } catch (error) {
      return { error: message(error, unreadable) };
    }
    const result = await db.transaction(async (tx): Promise<ActionState & { id?: string }> => {
      let uploaded: Awaited<ReturnType<typeof takeTicketUploads>>;
      try {
        uploaded = await takeTicketUploads(tx, actor.user.id, uploadIdsOf(draft));
      } catch (error) {
        return { error: message(error, unreadable) };
      }
      const all = [...direct, ...uploaded];
      if (all.length > MAX_FILES_AT_ONCE)
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
      if (all.length)
        await tx.insert(attachments).values(
          all.map((file) => ({ ...file, taskId: row.id, authorId: actor.user.id })),
        );
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.created",
        entityId: row.id,
        details: { engagementId: project.id, title: input.title },
      });
      if (input.status === "review")
        await enqueueReviewPush(tx, { id: row.id, companyId: project.companyId, engagementId: project.id }, actor.user.id);
      return {
        id: row.id,
        success: actor.admin ? "Tarefa criada." : "Pedido criado no Backlog. A equipe confirma se ele faz parte do combinado.",
      };
    });
    if (result.success) refresh(project.id);
    if (result.success && input.status === "review") schedulePushNotices();
    return result;
  } catch (error) {
    return failure(error);
  }
}

/** Every field of a task, its column (with the client's rules), new files and the saved ones marked for removal. */
export async function updateTaskAs(
  actor: Actor,
  draft: TaskDraft,
  files: FormDataEntryValue[] = [],
): Promise<ActionState> {
  try {
    const input = taskInput.extend({ id }).parse(draft);
    const labels = parseLabels(draft.labels ?? []);
    const estimateMinutes = parseEstimate(input.estimate);
    const [current] = await db.select().from(tasks).where(eq(tasks.id, input.id));
    if (!current) return blocked;
    const project = await projectOf(actor, current.engagementId);
    if (!project) return blocked;
    const assigned = await db.select({ userId: taskAssignees.userId }).from(taskAssignees).where(eq(taskAssignees.taskId, current.id));
    const assigneeIds = await parseAssignees(draft.assigneeIds ?? [], project, new Set(assigned.map((a) => a.userId)));
    const refused = statusRefusal(actor.admin, current, input.status);
    if (refused) return { error: refused };
    // Saved files the sheet marked for removal go only when the task saves.
    const removeIds = [...new Set((draft.removeFileIds ?? []).map(String))];
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
      direct = await prepareTicketFiles(files);
    } catch (error) {
      return { error: message(error, unreadable) };
    }
    const result = await db.transaction(async (tx): Promise<ActionState> => {
      let uploaded: Awaited<ReturnType<typeof takeTicketUploads>>;
      try {
        uploaded = await takeTicketUploads(tx, actor.user.id, uploadIdsOf(draft));
      } catch (error) {
        return { error: message(error, unreadable) };
      }
      const all = [...direct, ...uploaded];
      if (all.length > MAX_FILES_AT_ONCE)
        return { error: `Selecione até ${MAX_FILES_AT_ONCE} anexos por vez.` };
      if (all.length) {
        const [total] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(attachments)
          .where(and(eq(attachments.taskId, input.id), isNull(attachments.commentId)));
        if (total.n - removing.length + all.length > MAX_FILES_PER_TASK)
          return { error: `Limite de ${MAX_FILES_PER_TASK} anexos por tarefa atingido.` };
        await tx.insert(attachments).values(
          all.map((file) => ({ ...file, taskId: input.id, authorId: actor.user.id })),
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
      if (input.status === "review" && current.status !== "review")
        await enqueueReviewPush(tx, { id: input.id, companyId: project.companyId, engagementId: project.id }, actor.user.id);
      // Same removal and audit trail as removeTaskFileAs, one event per file.
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
    if (result.success && input.status === "review" && current.status !== "review") schedulePushNotices();
    return result;
  } catch (error) {
    return failure(error);
  }
}

/** Removes one attachment: the person who added it, the task's creator or staff. */
export async function removeTaskFileAs(actor: Actor, fileIdValue: unknown): Promise<ActionState> {
  try {
    const fileId = id.parse(fileIdValue);
    const [file] = await db
      .select({ id: attachments.id, taskId: attachments.taskId, authorId: attachments.authorId, name: attachments.name })
      .from(attachments)
      .where(eq(attachments.id, fileId));
    if (!file?.taskId) return blocked;
    const [task] = await db.select().from(tasks).where(eq(tasks.id, file.taskId));
    if (!task) return blocked;
    const project = await projectOf(actor, task.engagementId);
    if (!project) return blocked;
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
 * The card lands in `status` after `afterId` (first when null, as a drop
 * at the top of the board; at the end of the column when left out, as the
 * app's "Coluna" field). Positions are recomputed only when two neighbours collide.
 */
export async function moveTaskAs(
  actor: Actor,
  input: { id: string; status: TaskStatus; afterId?: string | null },
): Promise<ActionState> {
  try {
    const taskId = id.parse(input.id);
    const status = z.enum(TASK_STATUSES).parse(input.status);
    const afterId = input.afterId ? id.parse(input.afterId) : null;
    const [current] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!current) return blocked;
    const project = await projectOf(actor, current.engagementId);
    if (!project) return blocked;
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
      const index =
        input.afterId === undefined ? column.length : afterId ? column.findIndex((row) => row.id === afterId) + 1 : 0;
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
      if (status === "review" && current.status !== "review")
        await enqueueReviewPush(tx, { id: taskId, companyId: project.companyId, engagementId: project.id }, actor.user.id);
    });
    refresh(project.id);
    if (status === "review" && current.status !== "review") schedulePushNotices();
    return { success: "" };
  } catch {
    return { error: "Não foi possível mover a tarefa. Recarregue a página e tente de novo." };
  }
}

/** Takes a task off the board, with its files, people and comments: whoever created it, or staff. */
export async function deleteTaskAs(actor: Actor, taskIdValue: unknown): Promise<ActionState> {
  try {
    const taskId = id.parse(taskIdValue);
    const [current] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!current) return blocked;
    const project = await projectOf(actor, current.engagementId);
    if (!project) return blocked;
    if (!canDeleteTask(actor, current))
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

const commentBody = z.string().trim().max(5000, "O comentário excede o tamanho permitido.");
const commentInput = z.object({ taskId: id, body: commentBody });

/** A comment on a task, by anyone who can open its board: text, files or both. */
export async function addTaskCommentAs(
  actor: Actor,
  draft: { taskId: unknown; body?: unknown; uploadIds?: readonly unknown[] },
  files: FormDataEntryValue[] = [],
): Promise<ActionState> {
  try {
    const input = commentInput.parse({ taskId: draft.taskId, body: draft.body ?? "" });
    const [task] = await db
      .select({ id: tasks.id, title: tasks.title, engagementId: tasks.engagementId })
      .from(tasks)
      .where(eq(tasks.id, input.taskId));
    if (!task) return blocked;
    const project = await projectOf(actor, task.engagementId);
    if (!project) return blocked;
    let direct: Awaited<ReturnType<typeof prepareTicketFiles>>;
    try {
      direct = await prepareTicketFiles(files);
    } catch (error) {
      return { error: message(error, unreadable) };
    }
    const result = await db.transaction(async (tx): Promise<ActionState> => {
      let uploaded: Awaited<ReturnType<typeof takeTicketUploads>>;
      try {
        uploaded = await takeTicketUploads(tx, actor.user.id, uploadIdsOf(draft));
      } catch (error) {
        return { error: message(error, unreadable) };
      }
      const all = [...direct, ...uploaded];
      if (!input.body && !all.length) return { error: "Escreva o comentário ou anexe um arquivo." };
      if (all.length > MAX_FILES_AT_ONCE)
        return { error: `Selecione até ${MAX_FILES_AT_ONCE} anexos por vez.` };
      const [comment] = await tx
        .insert(taskComments)
        .values({ taskId: task.id, authorId: actor.user.id, body: input.body })
        .returning({ id: taskComments.id });
      if (all.length)
        await tx.insert(attachments).values(
          all.map((file) => ({ ...file, taskId: task.id, commentId: comment.id, authorId: actor.user.id })),
        );
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: project.companyId,
        action: "task.commented",
        entityId: task.id,
        details: { engagementId: project.id, title: task.title, commentId: comment.id, files: all.length },
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
export async function updateTaskCommentAs(actor: Actor, draft: { id: unknown; body?: unknown }): Promise<ActionState> {
  try {
    const commentId = id.parse(draft.id);
    const body = commentBody.parse(draft.body ?? "");
    const [comment] = await db
      .select({ id: taskComments.id, authorId: taskComments.authorId, body: taskComments.body, taskId: tasks.id, title: tasks.title, engagementId: tasks.engagementId })
      .from(taskComments)
      .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
      .where(eq(taskComments.id, commentId));
    if (!comment) return blocked;
    const project = await projectOf(actor, comment.engagementId);
    if (!project) return blocked;
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

/** Whoever wrote it, or the team, can take a comment back (its files go with it). */
export async function deleteTaskCommentAs(actor: Actor, commentIdValue: unknown): Promise<ActionState> {
  try {
    const commentId = id.parse(commentIdValue);
    const [comment] = await db
      .select({ id: taskComments.id, authorId: taskComments.authorId, taskId: tasks.id, title: tasks.title, engagementId: tasks.engagementId })
      .from(taskComments)
      .innerJoin(tasks, eq(tasks.id, taskComments.taskId))
      .where(eq(taskComments.id, commentId));
    if (!comment) return blocked;
    const project = await projectOf(actor, comment.engagementId);
    if (!project) return blocked;
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
