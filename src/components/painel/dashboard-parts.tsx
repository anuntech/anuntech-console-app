import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";

/**
 * The Painel's building blocks, in the same card language as the lists:
 * indicator tiles, an attention list and an activity feed.
 */

type Tone = "default" | "critical" | "warning" | "good";
const toneIcon: Record<Tone, string> = {
  default: "bg-accent text-primary",
  critical: "bg-destructive-soft text-destructive",
  warning: "bg-warning-soft text-warning",
  good: "bg-success-soft text-success",
};

/** One headline number with its context line; the whole tile opens the list behind it. */
export function KpiTile({
  label,
  value,
  detail,
  icon,
  tone = "default",
  delta,
  href,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  /** Change against the previous period, in percent; positive is up. */
  delta?: { percent: number; label: string } | null;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-8 [&_svg]:size-4", toneIcon[tone])}>{icon}</span>
      </div>
      <p className="mt-2 truncate text-xl leading-none font-semibold tracking-[-0.02em] text-foreground tabular-nums sm:text-[1.625rem]">{value}</p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {delta && Number.isFinite(delta.percent) && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-medium tabular-nums",
              delta.percent >= 0 ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
            )}
          >
            {delta.percent >= 0 ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
            {Math.abs(Math.round(delta.percent))}%
            <span className="sr-only">{delta.label}</span>
          </span>
        )}
        {detail}
      </div>
    </>
  );
  const frame = "block min-w-0 rounded-xl border bg-card p-3.5 shadow-card sm:p-4";
  return href ? (
    <Link href={href} className={cn(frame, "transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none")}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}

export type AttentionItem = {
  key: string;
  icon: ReactNode;
  title: string;
  detail?: string;
  count: number;
  href: string;
  tone?: Tone;
};

/** What needs someone today, most urgent first; empty means all caught up. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (!items.length)
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success [&_svg]:size-5">
          <CheckCircle2Icon />
        </span>
        <p className="text-sm font-medium text-foreground">Tudo em dia</p>
        <p className="text-xs text-muted-foreground">Quando algo vencer ou ficar esperando alguém, aparece aqui.</p>
      </div>
    );
  return (
    <ul className="divide-y border-t">
      {items.map((item) => (
        <li key={item.key}>
          <Link href={item.href} className="group flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/50">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", toneIcon[item.tone ?? "default"])}>{item.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{item.title}</span>
              {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground tabular-nums">{item.count}</span>
            <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-primary" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type ActivityEntry = { id: string; what: string; who: string; where: string | null; at: string; relative: string };

/** The latest things that happened in the Console, as a quiet timeline. */
export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (!entries.length) return <p className="px-6 py-10 text-center text-sm text-muted-foreground">Nenhuma atividade ainda.</p>;
  return (
    <ol className="relative px-6 pb-2">
      {entries.map((entry, i) => (
        <li key={entry.id} className="relative flex gap-3 pb-3 last:pb-0">
          {i < entries.length - 1 && <span aria-hidden="true" className="absolute top-3 bottom-0 left-[3px] w-px bg-border" />}
          <span aria-hidden="true" className="relative mt-1.5 size-[7px] shrink-0 rounded-full bg-primary/70 ring-2 ring-card" />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-5 font-medium text-foreground">{entry.what}</p>
            <p className="truncate text-xs text-muted-foreground">
              {entry.who}
              {entry.where ? ` · ${entry.where}` : ""} ·{" "}
              <time dateTime={entry.at} title={new Date(entry.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}>
                {entry.relative}
              </time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
