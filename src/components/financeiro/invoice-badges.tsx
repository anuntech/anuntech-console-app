import { cn } from "cn";
import { noticeStatusLabels } from "@/lib/billing/billing-notice-rules";
import {
  invoiceStatusLabels,
  type InvoiceDisplayStatus,
} from "@/lib/billing/invoice-table";

function Pill({
  tone,
  dot,
  className,
  children,
}: {
  tone: string;
  dot?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      {dot && (
        <span aria-hidden="true" className={cn("size-1.5 rounded-full", dot)} />
      )}
      {children}
    </span>
  );
}

/* Money states: waiting on the client is blue, late is red, settled is
   green, everything internal (drafts, schedules, cancellations) stays grey. */
const invoiceTones: Record<InvoiceDisplayStatus, { pill: string; dot: string }> =
  {
    issued: { pill: "bg-accent text-primary", dot: "bg-primary" },
    overdue: {
      pill: "bg-destructive-soft text-destructive",
      dot: "bg-destructive",
    },
    paid: { pill: "bg-success-soft text-success", dot: "bg-success" },
    scheduled: { pill: "bg-secondary text-foreground", dot: "bg-primary/60" },
    expired: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
    draft: {
      pill: "bg-secondary text-muted-foreground",
      dot: "bg-muted-foreground/50",
    },
    cancelled: {
      pill: "bg-secondary text-muted-foreground",
      dot: "bg-muted-foreground/40",
    },
  };

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceDisplayStatus;
  className?: string;
}) {
  const tone = invoiceTones[status] ?? invoiceTones.draft;
  return (
    <Pill tone={tone.pill} dot={tone.dot} className={className}>
      {invoiceStatusLabels[status] ?? status}
    </Pill>
  );
}

const noticeTones: Record<string, string> = {
  delivered: "bg-success-soft text-success",
  accepted: "bg-accent text-primary",
  sending: "bg-accent text-primary",
  pending: "bg-secondary text-foreground",
  waiting: "bg-secondary text-foreground",
  failed: "bg-destructive-soft text-destructive",
  uncertain: "bg-warning-soft text-warning",
  expired: "bg-warning-soft text-warning",
  skipped: "bg-secondary text-muted-foreground",
};

export function NoticeStatusBadge({ status }: { status: string }) {
  return (
    <Pill tone={noticeTones[status] ?? noticeTones.pending}>
      {noticeStatusLabels[status] ?? status}
    </Pill>
  );
}

export const subscriptionStatusLabels: Record<string, string> = {
  draft: "Aguardando publicação",
  active: "Ativa",
  paused: "Pausada",
  cancelled: "Cancelada",
};
const subscriptionTones: Record<string, { pill: string; dot: string }> = {
  draft: {
    pill: "bg-secondary text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  active: { pill: "bg-success-soft text-success", dot: "bg-success" },
  paused: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  cancelled: {
    pill: "bg-secondary text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
};

export function SubscriptionStatusBadge({ status }: { status: string }) {
  const tone = subscriptionTones[status] ?? subscriptionTones.draft;
  return (
    <Pill tone={tone.pill} dot={tone.dot}>
      {subscriptionStatusLabels[status] ?? status}
    </Pill>
  );
}
