"use client";
import { useState } from "react";
import { cn } from "cn";
import { currency } from "@/lib/format";

export type BillingMonth = {
  /** "2026-09" */
  month: string;
  /** "set" */
  label: string;
  /** "setembro de 2026" */
  longLabel: string;
  receivedCents: number;
  openCents: number;
};

const compact = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);

/** A round ceiling for the axis: 1, 2 or 5 × a power of ten, so gridlines land on readable values. */
function niceMax(value: number) {
  if (value <= 0) return 100_00;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

/**
 * Billing by due month: what was received (blue) stacked under what is still
 * to receive (orange), one bar per month. Hover or focus a month for the
 * values; the same numbers are in a table for screen readers.
 */
export function BillingChart({ months }: { months: BillingMonth[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...months.map((m) => m.receivedCents + m.openCents)));
  const ticks = [max, max / 2, 0];
  const shown = active ?? months.length - 1;
  const current = months[shown];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div aria-live="polite">
          <p className="text-xs text-muted-foreground">{current.longLabel}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-[-0.02em] text-foreground tabular-nums">
            {currency(current.receivedCents + current.openCents)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {currency(current.receivedCents)} recebido · {currency(current.openCents)} a receber
          </p>
        </div>
        <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legenda">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-[var(--chart-received)]" />
            Recebido
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-[var(--chart-open)]" />A receber
          </li>
        </ul>
      </div>

      <div className="relative grid grid-cols-[auto_1fr] gap-x-3" aria-hidden="true">
        {/* y axis */}
        <div className="flex h-44 flex-col justify-between py-px text-right text-[11px] text-muted-foreground tabular-nums">
          {ticks.map((tick) => (
            <span key={tick} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0 leading-none">
              {tick ? compact(tick) : "R$ 0"}
            </span>
          ))}
        </div>
        {/* plot */}
        <div className="relative h-44">
          {ticks.map((tick, i) => (
            <span
              key={tick}
              className={cn("absolute inset-x-0 border-t", i === ticks.length - 1 ? "border-border" : "border-dashed border-border/60")}
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 grid items-end gap-3" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
            {months.map((m, i) => {
              const total = m.receivedCents + m.openCents;
              const receivedPct = (m.receivedCents / max) * 100;
              const openPct = (m.openCents / max) * 100;
              return (
                <button
                  key={m.month}
                  type="button"
                  tabIndex={-1}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  className="group relative flex h-full flex-col justify-end outline-none"
                >
                  {/* hover band: a wider hit area than the bar itself */}
                  <span className={cn("absolute inset-x-[-6px] inset-y-0 rounded-md transition-colors", shown === i && active !== null ? "bg-accent/60" : "")} />
                  <span className="relative mx-auto flex h-full w-full max-w-10 flex-col justify-end gap-[2px]">
                    {m.openCents > 0 && (
                      <span className="block rounded-t-[4px] bg-[var(--chart-open)]" style={{ height: `${Math.max(openPct, 1.5)}%`, minHeight: 3 }} />
                    )}
                    {m.receivedCents > 0 && (
                      <span
                        className={cn("block bg-[var(--chart-received)]", m.openCents > 0 ? "" : "rounded-t-[4px]")}
                        style={{ height: `${Math.max(receivedPct, 1.5)}%`, minHeight: 3 }}
                      />
                    )}
                    {total === 0 && <span className="block h-[2px] rounded-full bg-border" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* x axis */}
        <span />
        <div className="mt-2 grid gap-3 text-center text-[11px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
          {months.map((m, i) => (
            <span key={m.month} className={cn(shown === i && "font-medium text-foreground")}>
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* keyboard and screen readers: the same data as a table */}
      <table className="sr-only">
        <caption>Faturamento por mês de vencimento</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Recebido</th>
            <th scope="col">A receber</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{m.longLabel}</th>
              <td>{currency(m.receivedCents)}</td>
              <td>{currency(m.openCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
