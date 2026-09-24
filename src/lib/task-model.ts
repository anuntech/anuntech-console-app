export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
] as const;
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const taskStatusLabels: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  in_progress: "Em andamento",
  review: "Revisão",
  done: "Concluído",
};
export const taskPriorityLabels: Record<TaskPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};
export const engagementKindLabels: Record<string, string> = {
  product: "Produto",
  project: "Projeto",
};

/** "2h", "1h30", "45min" for a stored estimate. */
export function estimateLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}min`;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}
/** Hours as typed ("1,5", "2") ⇄ minutes. */
export function hoursToMinutes(input: string) {
  const value = Number(input.replace(",", "."));
  if (!input.trim() || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 60);
}
export function minutesToHours(minutes: number) {
  return String(Math.round((minutes / 60) * 100) / 100).replace(".", ",");
}
