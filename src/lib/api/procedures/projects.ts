import "server-only";
import { eq } from "drizzle-orm";
import { attachments, engagements, taskComments, tasks as taskTable } from "@/db/schema";
import { db } from "../../db";
import { allowedIds, answersForClient, canSeeEngagement, type Actor } from "../../access/access";
import { avatarView } from "../../account/avatar-view";
import { saoPauloDate } from "../../dates";
import { engagementLabels } from "../../format";
import { guideSection } from "../../guide/guide-content";
import { projectListQuery } from "../../projects/project-table";
import { listProjects } from "../../projects/project-list";
import { findEngagement, projectTasks } from "../../projects/project-view";
import { projectActivity } from "../../projects/project-activity";
import { activityFilters, activityText } from "../../projects/activity-model";
import { projectPeople } from "../../projects/tasks";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  estimateLabel,
  minutesToHours,
  taskPriorityLabels,
  taskStatusLabels,
} from "../../projects/task-model";
import { allowedStatuses, canDeleteTask, canRemoveFile } from "../../projects/task-rules";
import { reviewTaskAs } from "../../projects/task-review";
import {
  addTaskCommentAs,
  createTaskAs,
  deleteTaskAs,
  deleteTaskCommentAs,
  moveTaskAs,
  removeTaskFileAs,
  updateTaskAs,
  updateTaskCommentAs,
} from "../../projects/task-board";
import { api } from "../server";
import { guard, missing } from "../access";
import { answer, refuse } from "../managed-company";

type Project = { id: string; companyId: string };

/** The project a task, a task's file or a task's comment sits on; its company is what the guard checks. */
const projectOfTask = async ({ id }: { id: string }): Promise<Project | undefined> =>
  (
    await db
      .select({ id: engagements.id, companyId: engagements.companyId })
      .from(taskTable)
      .innerJoin(engagements, eq(engagements.id, taskTable.engagementId))
      .where(eq(taskTable.id, id))
  )[0];
const projectOfFile = async ({ id }: { id: string }): Promise<Project | undefined> =>
  (
    await db
      .select({ id: engagements.id, companyId: engagements.companyId })
      .from(attachments)
      .innerJoin(taskTable, eq(taskTable.id, attachments.taskId))
      .innerJoin(engagements, eq(engagements.id, taskTable.engagementId))
      .where(eq(attachments.id, id))
  )[0];
const projectOfComment = async ({ id }: { id: string }): Promise<Project | undefined> =>
  (
    await db
      .select({ id: engagements.id, companyId: engagements.companyId })
      .from(taskComments)
      .innerJoin(taskTable, eq(taskTable.id, taskComments.taskId))
      .innerJoin(engagements, eq(engagements.id, taskTable.engagementId))
      .where(eq(taskComments.id, id))
  )[0];
const projectById = async ({ id }: { id: string }): Promise<Project | undefined> =>
  (await db.select({ id: engagements.id, companyId: engagements.companyId }).from(engagements).where(eq(engagements.id, id)))[0];

/**
 * A Membro with a selection reaches only the projects chosen for them, as on
 * the web's board; the rest answers 404, like a task that does not exist.
 */
async function reach(actor: Actor, find: Promise<Project | undefined>) {
  const project = await find;
  if (!project || !canSeeEngagement(actor, project)) throw missing();
  return project;
}

const label = (labels: Record<string, string>, value: string) => labels[value] ?? value;
const person = (p: { id: string; name: string; image: string | null }) => ({ id: p.id, name: p.name, avatar: avatarView(p.image, p.id) });
const fileView = (file: { id: string; name: string; size: number; mime: string }) => ({
  id: file.id,
  name: file.name,
  size: file.size,
  mime: file.mime,
  href: `/api/anexos/${file.id}`,
});
/** How the deadline reads on the card: past or today, until the task is done. */
const deadline = (task: { dueDate: string | null; status: string }, today: string) => ({
  overdue: !!task.dueDate && task.status !== "done" && task.dueDate < today,
  dueToday: !!task.dueDate && task.status !== "done" && task.dueDate === today,
});

export const projects = {
  list: api.projects.list
    // listProjects keeps each person to their companies and, for a Membro, the projects chosen for them.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const list = await listProjects(
        actor,
        projectListQuery({ page: String(input.page), status: input.status, q: input.search, company: input.company }),
      );
      const ids = new Set(allowedIds(actor, "overview"));
      const companies = actor.admin
        ? []
        : [...new Map(actor.grants.filter((g) => ids.has(g.company.id)).map((g) => [g.company.id, g.company.name])).entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return {
        rows: list.rows.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          statusLabel: label(engagementLabels, row.status),
          company: row.company,
          tasks: row.tasks,
          updatedAt: row.updatedAt,
        })),
        page: list.paging.page,
        pageCount: list.pageCount,
        showCompany: list.showCompany,
        companies: companies.length > 1 ? companies : [],
      };
    }),
  get: api.projects.get
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await projectById(input))?.companyId }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const row = await findEngagement(actor, input.id);
      if (!row || row.project.kind !== "project") throw missing();
      const now = new Date();
      const today = saoPauloDate(now);
      const [tasks, people] = await Promise.all([projectTasks(actor, row.project, now), projectPeople(row.project.companyId, row.project.id)]);
      return {
        id: row.project.id,
        name: row.project.name,
        description: row.project.description,
        company: row.company,
        status: row.project.status,
        statusLabel: label(engagementLabels, row.project.status),
        columns: TASK_STATUSES.map((status) => ({
          status,
          label: taskStatusLabels[status],
          tasks: tasks
            .filter((task) => task.status === status)
            .map((task) => ({
              id: task.id,
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              priorityLabel: label(taskPriorityLabels, task.priority),
              dueDate: task.dueDate,
              ...deadline(task, today),
              labels: task.labels,
              estimateMinutes: task.estimateMinutes,
              estimateLabel: task.estimateMinutes != null ? estimateLabel(task.estimateMinutes) : null,
              assignees: task.assignees.map((p) => p.name),
              assigneeIds: task.assignees.map((p) => p.id),
              comments: task.comments.length,
              files: task.files.length,
              reviewDue: task.reviewDue,
              requested: task.requested,
              creator: task.creator,
              updatedAt: task.updatedAt,
            })),
        })),
        // Approving a delivery is the client's decision: its Administradores, never the team.
        canReview: answersForClient(actor, row.project.companyId),
        viewer: { id: actor.user.id, staff: actor.admin },
        people: people.map(person),
        // Whoever sees the board adds to it (createTaskAs makes a client's task a request).
        canCreate: true,
        priorities: TASK_PRIORITIES.map((value) => ({ value, label: taskPriorityLabels[value] })),
        guide: guideSection("projetos")?.blocks.flatMap((block) => (block.kind === "list" ? block.items : [])) ?? [],
      };
    }),
  task: api.projects.task
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await projectOfTask(input))?.companyId }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const found = await reach(actor, projectOfTask(input));
      const row = await findEngagement(actor, found.id);
      if (!row) throw missing();
      const now = new Date();
      const task = (await projectTasks(actor, row.project, now)).find((t) => t.id === input.id);
      if (!task) throw missing();
      const me = actor.user.id;
      return {
        id: task.id,
        project: { id: row.project.id, name: row.project.name },
        title: task.title,
        description: task.description,
        status: task.status,
        statusLabel: taskStatusLabels[task.status],
        priority: task.priority,
        priorityLabel: label(taskPriorityLabels, task.priority),
        dueDate: task.dueDate,
        ...deadline(task, saoPauloDate(now)),
        labels: task.labels,
        estimateMinutes: task.estimateMinutes,
        estimateLabel: task.estimateMinutes != null ? estimateLabel(task.estimateMinutes) : null,
        estimateHours: task.estimateMinutes != null ? minutesToHours(task.estimateMinutes) : "",
        requested: task.requested,
        creator: task.creator,
        updatedAt: task.updatedAt,
        reviewDue: task.reviewDue,
        approvedAt: task.approvedAt,
        assignees: task.assignees.map(person),
        files: task.files.map((file) => ({ ...fileView(file), canRemove: canRemoveFile(actor, file, task) })),
        comments: task.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          editedAt: comment.editedAt,
          author: person(comment.author),
          mine: comment.author.id === me,
          canEdit: comment.author.id === me,
          canDelete: actor.admin || comment.author.id === me,
          files: comment.files.map(fileView),
        })),
        canDelete: canDeleteTask(actor, task),
        canReview: task.status === "review" && answersForClient(actor, row.project.companyId),
        statuses: allowedStatuses(actor.admin, task).map((value) => ({ value, label: taskStatusLabels[value] })),
      };
    }),
  activity: api.projects.activity
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await projectById(input))?.companyId }))
    .handler(async ({ input, context }) => {
      const row = await findEngagement(context.actor, input.id);
      if (!row || row.project.kind !== "project") throw missing();
      const events = await projectActivity(row.project.id, row.project.companyId);
      return {
        events: events.map((event) => {
          const { text, kind } = activityText(event);
          return { id: event.id, text, kind, at: event.at, who: { ...person(event.who), staff: event.who.staff }, task: event.task };
        }),
        filters: activityFilters.map((filter) => ({ key: filter.key, label: filter.label })),
      };
    }),
  createTask: api.projects.createTask
    .use(guard({ area: "overview", company: async (input: { engagementId: string }) => (await projectById({ id: input.engagementId }))?.companyId }))
    .handler(async ({ input, context }) => {
      await reach(context.actor, projectById({ id: input.engagementId }));
      const result = await createTaskAs(context.actor, { ...input, status: input.status ?? "todo" });
      if (result.error || !result.id) throw refuse(result.error || "Não foi possível concluir agora.");
      return { id: result.id, message: result.success ?? "" };
    }),
  updateTask: api.projects.updateTask
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await projectOfTask(input))?.companyId }))
    .handler(async ({ input, context }) => {
      await reach(context.actor, projectOfTask(input));
      return answer(await updateTaskAs(context.actor, input));
    }),
  moveTask: api.projects.moveTask
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await projectOfTask(input))?.companyId }))
    .handler(async ({ input, context }) => {
      await reach(context.actor, projectOfTask(input));
      // Picked from the task's "Coluna": it lands at the end of the column, as the web's sheet does.
      const result = await moveTaskAs(context.actor, { id: input.id, status: input.status });
      if (result.error) throw refuse(result.error);
      return { message: `Tarefa movida para ${taskStatusLabels[input.status]}.` };
    }),
  deleteTask: api.projects.deleteTask
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await projectOfTask(input))?.companyId }))
    .handler(async ({ input, context }) => {
      await reach(context.actor, projectOfTask(input));
      return answer(await deleteTaskAs(context.actor, input.id));
    }),
  removeTaskFile: api.projects.removeTaskFile
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await projectOfFile(input))?.companyId }))
    .handler(async ({ input, context }) => {
      await reach(context.actor, projectOfFile(input));
      return answer(await removeTaskFileAs(context.actor, input.id));
    }),
  comment: api.projects.comment
    .use(guard({ area: "overview", company: async (input: { taskId: string }) => (await projectOfTask({ id: input.taskId }))?.companyId }))
    .handler(async ({ input, context }) => {
      await reach(context.actor, projectOfTask({ id: input.taskId }));
      return answer(await addTaskCommentAs(context.actor, input));
    }),
  editComment: api.projects.editComment
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await projectOfComment(input))?.companyId }))
    .handler(async ({ input, context }) => {
      await reach(context.actor, projectOfComment(input));
      return answer(await updateTaskCommentAs(context.actor, input));
    }),
  deleteComment: api.projects.deleteComment
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await projectOfComment(input))?.companyId }))
    .handler(async ({ input, context }) => {
      await reach(context.actor, projectOfComment(input));
      return answer(await deleteTaskCommentAs(context.actor, input.id));
    }),
  reviewTask: api.projects.reviewTask
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await projectOfTask(input))?.companyId }))
    .handler(async ({ input, context }) => {
      await reach(context.actor, projectOfTask(input));
      return answer(await reviewTaskAs(context.actor, input));
    }),
};
