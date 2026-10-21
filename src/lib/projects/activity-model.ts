import { taskStatusLabels, type TaskStatus } from "./task-model";
import { engagementLabels } from "../format";

/*
 * The project's "Atividade": each audit event about the project or one of
 * its tasks, as one sentence. Pure, so the sheet and the tests share it.
 */

export type ActivityEvent = {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  at: string;
  who: { id: string; name: string; image: string | null; staff: boolean };
  /** The task's current title, or the one recorded when it was deleted. */
  task: { id: string; title: string; exists: boolean } | null;
};

export type ActivityKind = "moves" | "reviews" | "comments" | "edits";

export const ACTIVITY_ACTIONS = [
  "task.created",
  "task.moved",
  "task.approved",
  "task.review_failed",
  "task.updated",
  "task.deleted",
  "task.commented",
  "task.comment_edited",
  "task.comment_deleted",
  "engagement.status_changed",
  "engagement.updated",
] as const;

const status = (value: unknown) => taskStatusLabels[value as TaskStatus] ?? String(value ?? "");

/** What happened, after the person's name: "moveu de A fazer para Revisão". */
export function activityText(event: Pick<ActivityEvent, "action" | "details">): { text: string; kind: ActivityKind } {
  const d = event.details ?? {};
  switch (event.action) {
    case "task.created":
      return { text: "criou a tarefa", kind: "edits" };
    case "task.moved":
      return { text: d.from ? `moveu de ${status(d.from)} para ${status(d.to)}` : `moveu para ${status(d.to)}`, kind: "moves" };
    case "task.approved":
      return { text: "aprovou a entrega", kind: "reviews" };
    case "task.review_failed":
      return { text: "apontou um problema na entrega e devolveu para Em andamento", kind: "reviews" };
    case "task.updated":
      return { text: d.removedFile ? `removeu o anexo ${String(d.removedFile)}` : "editou a tarefa", kind: "edits" };
    case "task.deleted":
      return { text: "excluiu a tarefa", kind: "edits" };
    case "task.commented":
      return { text: Number(d.files) > 0 ? `comentou, com ${Number(d.files) === 1 ? "1 anexo" : `${Number(d.files)} anexos`}` : "comentou", kind: "comments" };
    case "task.comment_edited":
      return { text: "editou um comentário", kind: "comments" };
    case "task.comment_deleted":
      return { text: "excluiu um comentário", kind: "comments" };
    case "engagement.status_changed":
      return { text: `mudou a situação do projeto para ${(engagementLabels[String(d.status)] ?? String(d.status ?? "")).toLowerCase()}`, kind: "edits" };
    case "engagement.updated":
      return { text: "editou o projeto", kind: "edits" };
    default:
      return { text: "fez uma alteração", kind: "edits" };
  }
}

export const activityFilters: { key: "all" | ActivityKind; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "moves", label: "Movimentos" },
  { key: "reviews", label: "Revisões" },
  { key: "comments", label: "Comentários" },
  { key: "edits", label: "Edições" },
];
