import { cn } from "@/lib/cn";
import {
  quoteExpired,
  quoteStatusLabels,
  quoteValidity,
  quoteValidityLabel,
  type QuoteStatus,
} from "@/lib/quotes/quote-model";

const tones: Record<QuoteStatus | "expired", { pill: string; dot: string }> = {
  draft: { pill: "bg-secondary text-secondary-foreground", dot: "bg-muted-foreground/60" },
  sent: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  accepted: { pill: "bg-success-soft text-success", dot: "bg-success" },
  declined: { pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  cancelled: { pill: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground/50" },
  expired: { pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
};
const pill = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** The situation, with a waiting proposal past its date reading as expired. */
export function QuoteStatusBadge({
  status,
  validUntil,
  today,
  className,
}: {
  status: QuoteStatus;
  validUntil: string | null;
  today: string;
  className?: string;
}) {
  const expired = quoteExpired(status, validUntil, today);
  const tone = tones[expired ? "expired" : status];
  return (
    <span className={cn(pill, tone.pill, className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
      {expired ? "Expirado" : quoteStatusLabels[status]}
    </span>
  );
}

/** "Válido por 12 dias" while a proposal waits; silent otherwise. */
export function validityText(status: QuoteStatus, validUntil: string | null, today: string) {
  if (status !== "sent") return null;
  const validity = quoteValidity(validUntil, today);
  return validity.state === "open" ? quoteValidityLabel(validity) : null;
}
