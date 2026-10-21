import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { auditEvents, tasks, user } from "@/db/schema";
import { db } from "../db";
import { hasConsoleStaffAccess } from "../access/console-members";
import { ACTIVITY_ACTIONS, type ActivityEvent } from "./activity-model";

/** Enough for a few weeks of a busy board; older moves stay in the audit log. */
export const ACTIVITY_LIMIT = 200;

/**
 * What happened in a project, newest first: every task event recorded with
 * this project's id, and the project's own changes. Called only after the
 * page checked that the viewer sees the project.
 */
export async function projectActivity(projectId: string, companyId: string): Promise<ActivityEvent[]> {
  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      details: auditEvents.details,
      at: auditEvents.createdAt,
      entityId: auditEvents.entityId,
      whoId: user.id,
      whoName: user.name,
      whoEmail: user.email,
      whoImage: user.image,
      taskTitle: tasks.title,
    })
    .from(auditEvents)
    .innerJoin(user, eq(user.id, auditEvents.actorId))
    .leftJoin(tasks, eq(tasks.id, auditEvents.entityId))
    .where(
      and(
        eq(auditEvents.companyId, companyId),
        inArray(auditEvents.action, [...ACTIVITY_ACTIONS]),
        or(sql`${auditEvents.details}->>'engagementId' = ${projectId}`, eq(auditEvents.entityId, projectId)),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(ACTIVITY_LIMIT);
  const staff = new Map<string, boolean>();
  for (const email of new Set(rows.map((row) => row.whoEmail))) staff.set(email, await hasConsoleStaffAccess(email));
  return rows.map((row) => {
    const details = (row.details ?? null) as Record<string, unknown> | null;
    const onTask = row.action.startsWith("task.");
    const title = row.taskTitle ?? (typeof details?.title === "string" ? details.title : null);
    return {
      id: row.id,
      action: row.action,
      // Only what the sentences use; nothing else from the log reaches the browser.
      details: details ? pick(details, ["from", "to", "removedFile", "files", "status"]) : null,
      at: row.at.toISOString(),
      who: { id: row.whoId, name: row.whoName || row.whoEmail, image: row.whoImage, staff: !!staff.get(row.whoEmail) },
      task: onTask ? { id: row.entityId, title: title ?? "Tarefa", exists: row.taskTitle !== null } : null,
    };
  });
}

function pick(source: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));
}
