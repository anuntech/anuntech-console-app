"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, engagements, invoices, subscriptions } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { refreshBoard as refresh, taskFailure as failure } from "./task-common";
import { reviewTaskAs, taskReviewInput, type TaskReview } from "./task-review";
import {
  addTaskCommentAs,
  createTaskAs,
  deleteTaskAs,
  deleteTaskCommentAs,
  moveTaskAs,
  removeTaskFileAs,
  updateTaskAs,
  updateTaskCommentAs,
} from "./task-board";
import { db } from "../db";
import { moneyToCents } from "../access/permissions";
import type { TaskStatus } from "./task-model";

/*
 * The board's forms. Each reads its FormData and calls the shared rule in
 * task-board.ts (the app's API calls the same ones), so the checks, the
 * audit trail, the push and the refresh never drift between web and app.
 */

const id = z.string().uuid();
const blocked = { error: "Você não tem permissão para fazer isso." };

/** The sheet's fields and lists as the shared rules read them. */
const draftOf = (form: FormData) => ({
  ...Object.fromEntries(form),
  labels: form.getAll("labels"),
  assigneeIds: form.getAll("assigneeIds"),
  uploadIds: form.getAll("uploadId").map(String),
  removeFileIds: form.getAll("removeFileId").map(String),
});

export async function createTask(_: ActionState, form: FormData): Promise<ActionState> {
  const state = await createTaskAs(await getActor(), draftOf(form), form.getAll("files"));
  // The new id is for the app; the web's sheet only reads the message.
  delete state.id;
  return state;
}

export async function updateTask(_: ActionState, form: FormData): Promise<ActionState> {
  return updateTaskAs(await getActor(), draftOf(form), form.getAll("files"));
}

/** Removes one attachment: the person who added it, the task's creator or staff. */
export async function removeTaskFile(_: ActionState, form: FormData): Promise<ActionState> {
  return removeTaskFileAs(await getActor(), form.get("id"));
}

/**
 * Drag and drop: the card lands in `status` after `afterId` (or first when
 * empty). Positions are recomputed only when two neighbours collide.
 */
export async function moveTask(input: { id: string; status: TaskStatus; afterId: string | null }): Promise<ActionState> {
  return moveTaskAs(await getActor(), { id: input.id, status: input.status, afterId: input.afterId ?? null });
}

/**
 * The client's answer to a delivery in Revisão (the rules and side effects
 * are in reviewTaskAs, shared with the app's projects.reviewTask).
 */
export async function reviewTask(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  let input: TaskReview;
  try {
    input = taskReviewInput.parse(Object.fromEntries(form));
  } catch (error) {
    return failure(error);
  }
  return reviewTaskAs(actor, input);
}

export async function deleteTask(_: ActionState, form: FormData): Promise<ActionState> {
  return deleteTaskAs(await getActor(), form.get("id"));
}

/** A comment on a task, by anyone who can open its board: text, files or both. */
export async function addTaskComment(_: ActionState, form: FormData): Promise<ActionState> {
  return addTaskCommentAs(
    await getActor(),
    { taskId: form.get("taskId"), body: form.get("body") ?? "", uploadIds: form.getAll("uploadId").map(String) },
    form.getAll("files"),
  );
}

/** Only whoever wrote a comment changes its words. */
export async function updateTaskComment(_: ActionState, form: FormData): Promise<ActionState> {
  return updateTaskCommentAs(await getActor(), { id: form.get("id"), body: form.get("body") ?? "" });
}

/** Whoever wrote it, or the team, can take a comment back. */
export async function deleteTaskComment(_: ActionState, form: FormData): Promise<ActionState> {
  return deleteTaskCommentAs(await getActor(), form.get("id"));
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
