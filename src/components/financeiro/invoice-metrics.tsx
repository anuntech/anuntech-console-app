import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AnimatedValue } from "@/components/console/motion";
import { currency } from "@/lib/format";
import type { InvoiceStatusFilter } from "@/lib/billing/invoice-table";

export type InvoiceMetric = {
  status: InvoiceStatusFilter;
  label: string;
  count: number;
  cents: number;
  /** `destructive` asks for attention (overdue): colour only while there is something in it. */
  tone?: "default" | "destructive" | "success";
  icon: ReactNode;
};

/**
 * Totals per situation; each tile is also the filter for that situation.
 * The figure leads. Only a metric that asks for attention (overdue, with
 * something in it) gets colour; the rest stay neutral, with the situation
 * said by the label.
 */
export function InvoiceMetrics({
  metrics,
  active,
  hrefFor,
}: {
  metrics: InvoiceMetric[];
  active: InvoiceStatusFilter;
  hrefFor: (status: InvoiceStatusFilter) => string;
}) {
  return (
    // Mounts once per visit; a filter re-renders the same tiles, so the stagger does not replay.
    <div className="stagger mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {metrics.map((metric) => {
        const alert = metric.tone === "destructive" && metric.count > 0;
        const current = active === metric.status;
        const count = metric.count === 1 ? "1 fatura" : `${metric.count} faturas`;
        return (
          <Link
            key={metric.status}
            href={hrefFor(metric.status)}
            aria-current={current ? "page" : undefined}
            className={cn(
              "press group flex min-w-0 flex-col gap-2 rounded-xl border bg-card px-4 pt-3.5 pb-4 shadow-card hover:border-foreground/20 sm:gap-3",
              current && "border-primary ring-1 ring-primary/25 hover:border-primary",
            )}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="truncate text-label text-muted-foreground">{metric.label}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg max-sm:hidden [&_svg]:size-3.5",
                  alert ? "bg-destructive-soft text-destructive" : "bg-secondary text-muted-foreground",
                )}
              >
                {metric.icon}
              </span>
            </span>
            <span className="min-w-0">
              {/* The figure slides in when a filter changes it; never on load, never counting. */}
              <span
                className={cn(
                  "block truncate text-title tabular-nums sm:text-title-lg",
                  alert ? "text-destructive" : "text-foreground",
                )}
              >
                <AnimatedValue value={metric.cents}>{currency(metric.cents)}</AnimatedValue>
              </span>
              <span className="mt-0.5 block text-caption text-muted-foreground tabular-nums">
                <AnimatedValue value={count} />
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
