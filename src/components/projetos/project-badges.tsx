import { cn } from "cn";
import { engagementLabels } from "@/lib/format";
import { taskPriorityLabels, type TaskPriority } from "@/lib/task-model";

const statusTones: Record<string, { pill: string; dot: string }> = {
  active: { pill: "bg-success-soft text-success", dot: "bg-success" },
  paused: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  completed: {
    pill: "bg-secondary text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
};

export function EngagementStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = statusTones[status] ?? statusTones.completed;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone.pill,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
      {engagementLabels[status] ?? status}
    </span>
  );
}

const priorityTones: Record<TaskPriority, string> = {
  low: "text-muted-foreground",
  normal: "text-muted-foreground",
  high: "text-warning",
  urgent: "text-destructive",
};
const priorityDots: Record<TaskPriority, string> = {
  low: "bg-muted-foreground/40",
  normal: "bg-muted-foreground/60",
  high: "bg-warning",
  urgent: "bg-destructive",
};

/** A dot and a word; the calm priorities stay grey. */
export function TaskPriorityMark({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        priorityTones[priority],
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", priorityDots[priority])} />
      {taskPriorityLabels[priority]}
    </span>
  );
}
