import { TASK_STATUSES, hoursToMinutes, type TaskStatus } from "./task-model";

/*
 * The board's rules that need no database: who moves a card where, who
 * removes a file, and how the sheet's free fields are read. Shared by the
 * web's actions, the app's API and the tests.
 */

export const MAX_LABELS = 8;
export const MAX_FILES_PER_TASK = 20;
export const MAX_ASSIGNEES = 10;

type TaskState = { status: TaskStatus; requested: boolean };

/**
 * The board's rules for the client (D16): only the team concludes a task,
 * and a client's request stays in the Backlog until the team takes it in.
 * In Revisão, the client approves or reports a problem (reviewTask).
 */
export function statusRefusal(admin: boolean, current: TaskState, next: TaskStatus) {
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

/** The columns a person may put the task in (its own included), in board order. */
export function allowedStatuses(admin: boolean, current: TaskState): TaskStatus[] {
  return TASK_STATUSES.filter((status) => !statusRefusal(admin, current, status));
}

/** Entering Revisão starts the client's test window; the team moving a request takes it into the work. */
export function statusSideEffects(admin: boolean, current: TaskState, next: TaskStatus) {
  if (next === current.status) return {};
  return {
    reviewSince: next === "review" ? new Date() : null,
    ...(admin && current.requested && next !== "backlog" ? { requested: false } : {}),
    ...(next !== "done" ? { approvedBy: null, approvedAt: null } : {}),
  };
}

/** Who may remove a saved attachment: staff, whoever added it, or the task's creator. */
export const canRemoveFile = (
  actor: { admin: boolean; user: { id: string } },
  file: { authorId: string | null },
  task: { createdBy: string | null },
) => actor.admin || file.authorId === actor.user.id || task.createdBy === actor.user.id;

/** Who may delete a task: whoever created it, or staff. */
export const canDeleteTask = (actor: { admin: boolean; user: { id: string } }, task: { createdBy: string | null }) =>
  actor.admin || task.createdBy === actor.user.id;

/** Tags typed in the sheet: trimmed, unique, short. */
export function parseLabels(values: readonly unknown[]) {
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

/** Hours as typed ("1,5", "2") into minutes; empty is no estimate. */
export function parseEstimate(input: string) {
  if (!input) return null;
  const minutes = hoursToMinutes(input);
  if (minutes === null || minutes > 100_000)
    throw new Error("Informe a estimativa em horas, como 2 ou 1,5.");
  return minutes;
}

/** The people picked for a task: unique ids of a sane length, at most MAX_ASSIGNEES. */
export function assigneeIdsOf(values: readonly unknown[]) {
  const ids = [...new Set(values.map((v) => String(v).trim()).filter((v) => v && v.length <= 128))];
  if (ids.length > MAX_ASSIGNEES) throw new Error(`Até ${MAX_ASSIGNEES} pessoas por tarefa.`);
  return ids;
}
