import { cn } from "cn";
import { contractStatusLabels, type ContractStatus } from "@/lib/contract-table";

const tones: Record<ContractStatus, { pill: string; dot: string }> = {
  draft: { pill: "bg-secondary text-secondary-foreground", dot: "bg-muted-foreground/60" },
  sent: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  signed: { pill: "bg-success-soft text-success", dot: "bg-success" },
  cancelled: { pill: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground/50" },
};

export function ContractStatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  const tone = tones[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone.pill,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
      {contractStatusLabels[status]}
    </span>
  );
}
