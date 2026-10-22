import { cn } from "@/lib/cn";
import {
  contractKindLabels,
  contractStatusLabels,
  contractTerm,
  contractTermLabel,
  type ContractKind,
  type ContractStatus,
} from "@/lib/contracts/contract-table";

const tones: Record<ContractStatus, { pill: string; dot: string }> = {
  draft: { pill: "bg-secondary text-secondary-foreground", dot: "bg-muted-foreground/60" },
  sent: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  in_review: { pill: "bg-accent text-primary", dot: "bg-primary" },
  signed: { pill: "bg-success-soft text-success", dot: "bg-success" },
  cancelled: { pill: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground/50" },
};
const pill = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function ContractStatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  const tone = tones[status];
  return (
    <span className={cn(pill, tone.pill, className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
      {contractStatusLabels[status]}
    </span>
  );
}

/**
 * Only speaks when there is something to act on: a signed contract inside
 * the warning window, or past its end date. Quiet otherwise.
 */
export function ContractTermBadge({
  status,
  startsAt,
  endsAt,
  today,
  className,
}: {
  status: ContractStatus;
  startsAt: string | null;
  endsAt: string | null;
  today: string;
  className?: string;
}) {
  if (status !== "signed") return null;
  const term = contractTerm({ startsAt, endsAt }, today);
  const label = contractTermLabel(term);
  if (!label || term.state === "upcoming") return null;
  const expired = term.state === "expired";
  return (
    <span
      className={cn(pill, expired ? "bg-destructive/10 text-destructive" : "bg-warning-soft text-warning", className)}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", expired ? "bg-destructive" : "bg-warning")} />
      {label}
    </span>
  );
}

/** A small mark for amendments, so they read apart from contracts in lists. */
export function ContractKindChip({ kind, className }: { kind: ContractKind; className?: string }) {
  if (kind === "contract") return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {contractKindLabels[kind]}
    </span>
  );
}
