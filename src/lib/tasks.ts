import "server-only";
import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  accountEmails,
  attachments,
  consoleStaffMembers,
  memberships,
  taskAssignees,
  taskComments,
  tasks,
  user,
} from "@/db/schema";
import { db } from "./db";
import { hasConsoleStaffAccess } from "./console-members";
import { getAccountEmails, resolveAccountIdentity } from "./account-identity";
import { normalizeEmail } from "./permissions";

export type Person = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/** People a task can be assigned to: the company's members plus Console staff. */
export async function assigneeAllowed(userId: string, companyId: string) {
  const [person] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId));
  if (!person) return false;
  if (await hasConsoleStaffAccess(person.email)) return true;
  const emails = await getAccountEmails(userId, person.email);
  const [member] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.companyId, companyId),
        inArray(memberships.email, emails),
        eq(memberships.active, true),
      ),
    )
    .limit(1);
  return !!member;
}

/** Everyone who can be given a task on this company's projects. */
export async function projectPeople(companyId: string): Promise<Person[]> {
  const columns = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  };
  const [members, staff] = await Promise.all([
    db
      .select(columns)
      .from(memberships)
      .leftJoin(
        accountEmails,
        and(
          eq(accountEmails.email, memberships.email),
          isNotNull(accountEmails.verifiedAt),
        ),
      )
      .innerJoin(
        user,
        or(eq(user.email, memberships.email), eq(user.id, accountEmails.userId)),
      )
      .where(and(eq(memberships.companyId, companyId), eq(memberships.active, true))),
    db
      .select(columns)
      .from(consoleStaffMembers)
      .leftJoin(
        accountEmails,
        and(
          eq(accountEmails.email, consoleStaffMembers.email),
          isNotNull(accountEmails.verifiedAt),
        ),
      )
      .innerJoin(
        user,
        or(
          eq(user.email, consoleStaffMembers.email),
          eq(user.id, accountEmails.userId),
        ),
      )
      .where(eq(consoleStaffMembers.active, true)),
  ]);
  const people = new Map<string, Person>();
  const owner = process.env.CONSOLE_ADMIN_EMAIL?.trim();
  if (owner) {
    const identity = await resolveAccountIdentity(normalizeEmail(owner));
    if (identity.userId) {
      const [row] = await db.select(columns).from(user).where(eq(user.id, identity.userId));
      if (row) people.set(row.id, row);
    }
  }
  for (const row of [...staff, ...members]) if (!people.has(row.id)) people.set(row.id, row);
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Counts per project, for the list's progress line. */
export async function taskSummary(engagementIds: string[]) {
  if (!engagementIds.length)
    return new Map<string, { total: number; done: number }>();
  const rows = await db
    .select({
      engagementId: tasks.engagementId,
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
    })
    .from(tasks)
    .where(inArray(tasks.engagementId, engagementIds))
    .groupBy(tasks.engagementId);
  return new Map(rows.map((row) => [row.engagementId, { total: row.total, done: row.done }]));
}

export type TaskFile = { id: string; name: string; size: number; mime: string; authorId: string };
export type TaskPerson = { id: string; name: string; image: string | null };
export type TaskComment = { id: string; body: string; createdAt: Date; author: TaskPerson };

/** The board's cards, in column order, each with its files and comments. */
export async function boardTasks(engagementId: string) {
  const creator = alias(user, "creator");
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      labels: tasks.labels,
      estimateMinutes: tasks.estimateMinutes,
      position: tasks.position,
      createdBy: tasks.createdBy,
      creator: creator.name,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(creator, eq(creator.id, tasks.createdBy))
    .where(eq(tasks.engagementId, engagementId))
    .orderBy(asc(tasks.position), asc(tasks.createdAt));
  const ids = rows.map((row) => row.id);
  const assigned = ids.length
    ? await db
        .select({
          taskId: taskAssignees.taskId,
          id: user.id,
          name: user.name,
          image: user.image,
        })
        .from(taskAssignees)
        .innerJoin(user, eq(user.id, taskAssignees.userId))
        .where(inArray(taskAssignees.taskId, ids))
        .orderBy(asc(taskAssignees.createdAt))
    : [];
  const peopleByTask = new Map<string, TaskPerson[]>();
  for (const { taskId, ...person } of assigned)
    peopleByTask.set(taskId, [...(peopleByTask.get(taskId) ?? []), person]);
  const files = rows.length
    ? await db
        .select({
          id: attachments.id,
          taskId: attachments.taskId,
          name: attachments.name,
          size: attachments.size,
          mime: attachments.mime,
          authorId: attachments.authorId,
        })
        .from(attachments)
        .where(inArray(attachments.taskId, ids))
        .orderBy(asc(attachments.createdAt))
    : [];
  const byTask = new Map<string, TaskFile[]>();
  for (const { taskId, ...file } of files) {
    if (!taskId) continue;
    byTask.set(taskId, [...(byTask.get(taskId) ?? []), file]);
  }
  const said = rows.length
    ? await db
        .select({
          id: taskComments.id,
          taskId: taskComments.taskId,
          body: taskComments.body,
          createdAt: taskComments.createdAt,
          authorId: user.id,
          authorName: user.name,
          authorImage: user.image,
        })
        .from(taskComments)
        .innerJoin(user, eq(user.id, taskComments.authorId))
        .where(inArray(taskComments.taskId, ids))
        .orderBy(asc(taskComments.createdAt))
    : [];
  const commentsByTask = new Map<string, TaskComment[]>();
  for (const c of said)
    commentsByTask.set(c.taskId, [
      ...(commentsByTask.get(c.taskId) ?? []),
      { id: c.id, body: c.body, createdAt: c.createdAt, author: { id: c.authorId, name: c.authorName, image: c.authorImage } },
    ]);
  return rows.map((row) => ({
    ...row,
    assignees: peopleByTask.get(row.id) ?? [],
    files: byTask.get(row.id) ?? [],
    comments: commentsByTask.get(row.id) ?? [],
  }));
}
