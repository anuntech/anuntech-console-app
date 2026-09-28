import type { ReactNode } from "react";
import { cn } from "cn";
import { engagementLabels } from "@/lib/format";
import { taskPriorityLabels, type TaskPriority } from "@/lib/projects/task-model";

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

/** Only the dot, for lists that already spell the priority out. */
export function PriorityDot({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", priorityDots[priority], className)} />
  );
}

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

const labelTones = [
  "bg-accent text-primary",
  "bg-success-soft text-success",
  "bg-warning-soft text-warning",
  "bg-destructive-soft text-destructive",
  "bg-secondary text-foreground",
];
/** Same text, same colour, everywhere. */
export function labelTone(label: string) {
  let hash = 0;
  for (const char of label.toLocaleLowerCase("pt-BR")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return labelTones[hash % labelTones.length];
}

export function LabelChip({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        labelTone(label),
        className,
      )}
    >
      <span className="truncate">{label}</span>
      {children}
    </span>
  );
}
