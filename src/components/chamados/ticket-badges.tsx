import { cn } from "cn";
import { priorityLabels, ticketLabels } from "@/lib/format";
import type { TicketPriority, TicketStatus } from "@/lib/tickets/ticket-table";

/* One tone per situation, used identically in lists, headers and cards:
   what needs the team is blue, what needs the client is amber, what is done
   is green, what is over is grey. */
const statusTone: Record<TicketStatus, { pill: string; dot: string }> = {
  open: { pill: "bg-accent text-primary", dot: "bg-primary" },
  in_progress: {
    pill: "bg-primary text-primary-foreground",
    dot: "bg-primary-foreground/80",
  },
  waiting_customer: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  resolved: { pill: "bg-success-soft text-success", dot: "bg-success" },
  closed: {
    pill: "bg-secondary text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
};

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
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
      {ticketLabels[status] ?? status}
    </span>
  );
}

/** Only "Alta" asks for attention; normal priority stays quiet text. */
export function TicketPriorityMark({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  if (priority !== "high")
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {priorityLabels.normal}
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-destructive-soft px-2 py-0.5 text-xs font-medium text-destructive",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
      {priorityLabels.high}
    </span>
  );
}
