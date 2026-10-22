import { cn } from "@/lib/cn";
import { formatDocument } from "@/lib/companies/company-input";
import { currency, dateLabel, longDateLabel } from "@/lib/format";
import { discountShareLabel, hoursLabel, quoteTotals, taskCode, type QuoteContent, weeksLabel } from "@/lib/quotes/quote-model";

export type QuoteDocumentData = QuoteContent & {
  title: string;
  number: string;
  companyName: string;
  companyDocument: string;
  validUntil: string | null;
  /** When it was prepared: the send date, or the last edit for a draft. */
  date: string;
};

function Stat({ value, label, strong = false }: { value: string; label: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-4 py-3">
      <p className={cn("m-0 font-semibold tabular-nums text-foreground", strong ? "text-xl" : "text-lg")}>{value}</p>
      <p className="m-0 mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <h2 className="m-0 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{children}</h2>;
}

/**
 * The proposal as the client reads it, in the layout the PDF follows:
 * headline numbers, the financial split, the stack, a phase summary,
 * every task and the total. Pure, so the editor can preview it too.
 */
export function QuoteDocument({ data, className }: { data: QuoteDocumentData; className?: string }) {
  const totals = quoteTotals(data);
  return (
    <article className={cn("flex flex-col gap-8", className)}>
      <header>
        <Eyebrow>Backlog técnico · Proposta comercial</Eyebrow>
        <h1 className="m-0 mt-2 text-2xl font-semibold tracking-tight text-foreground">{data.title}</h1>
        <p className="m-0 mt-1 text-sm text-muted-foreground">
          Orçamento nº {data.number} · {data.companyName} · {formatDocument(data.companyDocument)}
        </p>
        {data.summary && <p className="m-0 mt-4 text-[15px] leading-7 text-foreground/90">{data.summary}</p>}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={hoursLabel(totals.hoursMin, totals.hoursMax)} label="Esforço estimado" />
        <Stat value={`${currency(data.hourlyRateCents)}/h`} label="Taxa/hora" />
        <Stat value={String(totals.phases)} label={totals.phases === 1 ? "Fase" : "Fases"} />
        <Stat value={String(totals.tasks)} label={totals.tasks === 1 ? "Tarefa" : "Tarefas"} />
      </div>

      <section>
        <Eyebrow>Proposta financeira</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat value={currency(totals.totalCents)} label="Valor total" strong />
          <Stat value={currency(totals.upfrontCents)} label={`Entrada (${data.upfrontPercent}%)`} strong />
          <Stat value={currency(totals.balanceCents)} label={`Saldo (${100 - data.upfrontPercent}%)`} strong />
        </div>
        {totals.discountCents > 0 && (
          <p className="m-0 mt-3 text-sm text-muted-foreground">
            Valor das horas <span className="tabular-nums text-foreground">{currency(totals.subtotalCents)}</span>, com desconto negociado de{" "}
            <span className="font-medium tabular-nums text-foreground">{currency(totals.discountCents)}</span> ({discountShareLabel(totals)}).
          </p>
        )}
      </section>

      {data.stack.length > 0 && (
        <section>
          <Eyebrow>Stack</Eyebrow>
          <ul className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0">
            {data.stack.map((item) => (
              <li key={item} className="rounded-md border bg-card px-2 py-0.5 text-xs font-medium text-foreground">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.phases.length > 0 && (
        <section>
          <Eyebrow>Resumo por fase</Eyebrow>
          {/* A narrow phone scrolls the table in place, never the page. */}
          <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                <th className="py-2 pr-3 font-semibold">Fase</th>
                <th className="py-2 pr-3 text-right font-semibold">Tarefas</th>
                <th className="py-2 text-right font-semibold">HH estimado</th>
              </tr>
            </thead>
            <tbody>
              {data.phases.map((phase, index) => (
                <tr key={index} className="border-b border-border/70">
                  <td className="py-2.5 pr-3 text-foreground">{phase.name}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{phase.tasks.length}</td>
                  <td className="py-2.5 text-right tabular-nums">{hoursLabel(phase.hoursMin, phase.hoursMax)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-foreground">
                <td className="py-2.5 pr-3">Total</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{totals.tasks}</td>
                <td className="py-2.5 text-right tabular-nums">{hoursLabel(totals.hoursMin, totals.hoursMax)}</td>
              </tr>
            </tfoot>
          </table>
          </div>
        </section>
      )}

      {data.phases.some((phase) => phase.tasks.length || phase.description) && (
        <section>
          <Eyebrow>Tarefas detalhadas</Eyebrow>
          <ol className="m-0 mt-3 flex list-none flex-col gap-6 p-0">
            {data.phases.map((phase, phaseIndex) => (
              <li key={phaseIndex} className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="m-0 text-base font-semibold text-foreground">{phase.name}</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {phase.tasks.length} {phase.tasks.length === 1 ? "tarefa" : "tarefas"} · {hoursLabel(phase.hoursMin, phase.hoursMax)}
                    {phase.weeks ? ` · ${weeksLabel(phase.weeks)}` : ""}
                  </span>
                </div>
                {phase.description && <p className="m-0 mt-1 text-sm text-muted-foreground">{phase.description}</p>}
                {phase.tasks.length > 0 && (
                  <ol className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
                    {phase.tasks.map((task, taskIndex) => (
                      <li key={taskIndex} className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
                        <span className="pt-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                          {taskCode(phaseIndex, taskIndex)}
                        </span>
                        <div className="min-w-0">
                          <p className="m-0 text-sm font-medium text-foreground">{task.title}</p>
                          {task.description && <p className="m-0 mt-0.5 text-sm text-muted-foreground">{task.description}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="m-0 mt-4 text-right text-xs text-muted-foreground">
                  Subtotal {phase.name}: <span className="font-medium text-foreground tabular-nums">{hoursLabel(phase.hoursMin, phase.hoursMax)}</span>
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-primary px-5 py-4 text-primary-foreground">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.08em] uppercase opacity-80">Total estimado do projeto</p>
          <p className="m-0 mt-1 text-2xl font-semibold tabular-nums">{hoursLabel(totals.hoursMin, totals.hoursMax)}</p>
        </div>
        <div className="w-full sm:w-auto sm:text-right">
          <p className="m-0 text-xs tabular-nums opacity-80">
            {totals.hoursMax}h × {currency(data.hourlyRateCents)}/h
            {totals.discountCents > 0 && `, com ${currency(totals.discountCents)} de desconto`}
          </p>
          <p className="m-0 mt-1 text-2xl font-semibold tabular-nums">{currency(totals.totalCents)}</p>
        </div>
      </section>

      <footer className="text-xs text-muted-foreground">
        <p className="m-0">
          Proposta preparada pela Anuntech · {dateLabel(new Date(data.date))}
          {data.validUntil && ` · válida até ${longDateLabel(data.validUntil)}`}
        </p>
        {data.notes && <p className="m-0 mt-1">{data.notes}</p>}
      </footer>
    </article>
  );
}
