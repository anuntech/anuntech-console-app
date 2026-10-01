import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { currency } from "@/lib/format";
import type { InvoiceStatusFilter } from "@/lib/billing/invoice-table";

export type InvoiceMetric = {
  status: InvoiceStatusFilter;
  label: string;
  count: number;
  cents: number;
  tone?: "default" | "destructive" | "success";
  icon: ReactNode;
};

const iconTones = {
  default: "bg-accent text-primary",
  destructive: "bg-destructive-soft text-destructive",
  success: "bg-success-soft text-success",
};
const valueTones = {
  default: "text-foreground",
  destructive: "text-destructive",
  success: "text-success",
};

/** Totals per situation; each card is also the filter for that situation. */
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
    <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {metrics.map((metric) => {
        const tone = metric.tone ?? "default";
        const current = active === metric.status;
        return (
          <Link
            key={metric.status}
            href={hrefFor(metric.status)}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-card transition-colors hover:border-primary/40",
              current && "border-primary ring-1 ring-primary/25",
            )}
          >
            <span className="min-w-0">
              <span className="block text-xs font-medium text-muted-foreground">
                {metric.label}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-xl font-semibold tracking-[-0.02em] tabular-nums",
                  valueTones[tone],
                )}
              >
                {currency(metric.cents)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {metric.count === 1 ? "1 fatura" : `${metric.count} faturas`}
              </span>
            </span>
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg max-sm:hidden [&_svg]:size-4",
                iconTones[tone],
              )}
            >
              {metric.icon}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
