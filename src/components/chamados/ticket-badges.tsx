import { cn } from "cn";
import { clientTicketLabels, priorityLabels, ticketLabels } from "@/lib/format";
import type { TicketPriority, TicketStatus } from "@/lib/tickets/ticket-table";

/* One tone per situation, used identically in lists, headers and cards:
   what needs the team is neutral (a blue dot while someone works on it), what
   needs the client is amber, what is done is green, what is over is grey. */
const statusTone: Record<TicketStatus, { pill: string; dot: string }> = {
  open: { pill: "border border-border bg-card text-foreground", dot: "bg-foreground" },
  in_progress: { pill: "border border-border bg-secondary text-foreground", dot: "bg-link" },
  waiting_customer: { pill: "border border-warning-edge bg-warning-soft text-warning", dot: "bg-warning" },
  resolved: { pill: "border border-success-edge bg-success-soft text-success", dot: "bg-success" },
  closed: {
    pill: "border border-border bg-secondary text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
};

export function TicketStatusBadge({
  status,
  client = false,
  className,
}: {
  status: TicketStatus;
  /** The client's words: "Aguardando você". */
  client?: boolean;
  className?: string;
}) {
  const tone = statusTone[status] ?? statusTone.closed;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone.pill,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
      {(client ? clientTicketLabels : ticketLabels)[status] ?? status}
    </span>
  );
}

/** Alta and Crítica ask for attention (Crítica in solid red); normal priority stays quiet text. */
export function TicketPriorityMark({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  if (priority !== "high" && priority !== "critical")
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {priorityLabels.normal}
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        priority === "critical" ? "bg-destructive text-white" : "bg-destructive-soft text-destructive",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", priority === "critical" ? "bg-white" : "bg-destructive")} />
      {priorityLabels[priority]}
    </span>
  );
}
