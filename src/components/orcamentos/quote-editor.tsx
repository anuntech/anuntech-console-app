"use client";
import { useId, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "@/components/shell/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/console/page-header";
import { DateField } from "@/components/console/date-field";
import { Fact } from "@/components/console/fact";
import { FormField } from "@/components/console/form-field";
import { MoneyField } from "@/components/console/money-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { TokenChip } from "@/components/console/token-chip";
import { saveQuote } from "@/lib/quotes/quote-actions";
import { currency } from "@/lib/format";
import {
  hoursLabel,
  quoteTotals,
  discountShareLabel,
  taskCode,
  type QuoteContent,
  type QuotePhase,
} from "@/lib/quotes/quote-model";

export type QuoteEditorData = {
  quote: { id: string; revision: number; title: string; validUntil: string | null; content: QuoteContent };
};

const emptyPhase = (): QuotePhase => ({ name: "", description: "", hoursMin: 0, hoursMax: 0, tasks: [] });
/* Text inputs with a numeric keyboard; anything but digits is dropped. */
const whole = (value: string) => Number(value.replace(/\D/g, "").slice(0, 9)) || 0;

/** Technologies as chips; Enter or a comma adds one, Backspace on empty removes the last. */
function StackField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const uid = useId();
  const commit = () => {
    const parts = draft
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && !value.includes(part));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <FormField label="Stack" htmlFor={uid} hint="Enter ou vírgula separa cada tecnologia.">
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-field px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {value.map((item) => (
          <TokenChip
            key={item}
            removeLabel={`Remover ${item}`}
            onRemove={() => onChange(value.filter((entry) => entry !== item))}
          >
            {item}
          </TokenChip>
        ))}
        <input
          id={uid}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={value.length ? "" : "Ex.: Next.js 15, React 19, PostgreSQL"}
          className="min-w-[10rem] flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none placeholder:text-muted-foreground focus:ring-0"
        />
      </div>
    </FormField>
  );
}

function PhaseEditor({
  index,
  phase,
  last,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  phase: QuotePhase;
  last: boolean;
  onChange: (phase: QuotePhase) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const uid = useId();
  const setTask = (position: number, patch: Partial<QuotePhase["tasks"][number]>) =>
    onChange({ ...phase, tasks: phase.tasks.map((task, i) => (i === position ? { ...task, ...patch } : task)) });
  return (
    <section aria-label={`Fase ${index + 1}`} className="rounded-lg border bg-field/40 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-2 w-6 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">P{index + 1}</span>
        <div className="grid min-w-0 flex-1 gap-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_88px_88px_88px]">
            <FormField label="Fase" htmlFor={`${uid}-name`}>
              <Input
                id={`${uid}-name`}
                value={phase.name}
                maxLength={160}
                placeholder="Ex.: Planejamento e fundação"
                onChange={(event) => onChange({ ...phase, name: event.target.value })}
              />
            </FormField>
            <FormField label="Horas mín." htmlFor={`${uid}-min`}>
              <Input
                id={`${uid}-min`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={phase.hoursMin || ""}
                onChange={(event) => onChange({ ...phase, hoursMin: whole(event.target.value) })}
                className="tabular-nums"
              />
            </FormField>
            <FormField label="Horas máx." htmlFor={`${uid}-max`}>
              <Input
                id={`${uid}-max`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={phase.hoursMax || ""}
                onChange={(event) => onChange({ ...phase, hoursMax: whole(event.target.value) })}
                className="tabular-nums"
              />
            </FormField>
            <FormField label="Semanas" htmlFor={`${uid}-weeks`}>
              <Input
                id={`${uid}-weeks`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="—"
                value={phase.weeks || ""}
                onChange={(event) => onChange({ ...phase, weeks: whole(event.target.value) || null })}
                className="tabular-nums"
              />
            </FormField>
          </div>
          <FormField label="Descrição" htmlFor={`${uid}-description`}>
            <Textarea
              id={`${uid}-description`}
              rows={2}
              maxLength={4000}
              placeholder="O que esta fase entrega."
              value={phase.description}
              onChange={(event) => onChange({ ...phase, description: event.target.value })}
            />
          </FormField>
          {phase.tasks.length > 0 && (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {phase.tasks.map((task, position) => (
                <li key={position} className="grid gap-2 sm:grid-cols-[52px_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center">
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">{taskCode(index, position)}</span>
                  <Input
                    value={task.title}
                    maxLength={160}
                    placeholder="Tarefa"
                    aria-label={`Título da tarefa ${taskCode(index, position)}`}
                    onChange={(event) => setTask(position, { title: event.target.value })}
                  />
                  <Input
                    value={task.description}
                    maxLength={4000}
                    placeholder="O que será feito"
                    aria-label={`Descrição da tarefa ${taskCode(index, position)}`}
                    onChange={(event) => setTask(position, { description: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover tarefa ${taskCode(index, position)}`}
                    className="text-muted-foreground"
                    onClick={() => onChange({ ...phase, tasks: phase.tasks.filter((_, i) => i !== position) })}
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ol>
          )}
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => onChange({ ...phase, tasks: [...phase.tasks, { title: "", description: "" }] })}
            >
              <PlusIcon />
              Adicionar tarefa
            </Button>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Subir fase" disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronUpIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Descer fase" disabled={last} onClick={() => onMove(1)}>
            <ChevronDownIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover fase" className="text-destructive" onClick={onRemove}>
            <Trash2Icon />
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * Editing a draft proposal on its own page (the draft is created in
 * NewQuoteSheet). The whole structure lives in state and is posted as one
 * JSON field; the summary on the side shows the numbers the proposal will
 * print as they change.
 */
export function QuoteEditor({ quote }: QuoteEditorData) {
  const uid = useId();
  const [content, setContent] = useState<QuoteContent>(quote.content);
  const patch = (next: Partial<QuoteContent>) => setContent((current) => ({ ...current, ...next }));
  const [suggesting, setSuggesting] = useState(false);
  // Phases, hours and tasks proposed from the summary; they land in the editor only, to adjust and save.
  const suggestPhases = async () => {
    setSuggesting(true);
    try {
      const res = await fetch(`/api/orcamentos/${quote.id}/fases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: quote.title, summary: content.summary }),
      });
      const data = (await res.json().catch(() => null)) as { phases?: QuotePhase[]; stack?: string[]; error?: string } | null;
      if (!res.ok || !data?.phases?.length) throw new Error(data?.error ?? "Não foi possível sugerir agora.");
      setContent((current) => ({ ...current, phases: data.phases!, stack: current.stack.length ? current.stack : (data.stack ?? []) }));
      toast.success("Fases sugeridas. Confira horas e tarefas antes de salvar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sugerir agora.");
    } finally {
      setSuggesting(false);
    }
  };
  const setPhase = (index: number, phase: QuotePhase) => patch({ phases: content.phases.map((entry, i) => (i === index ? phase : entry)) });
  const movePhase = (index: number, direction: -1 | 1) => {
    const phases = [...content.phases];
    const target = index + direction;
    if (target < 0 || target >= phases.length) return;
    [phases[index], phases[target]] = [phases[target], phases[index]];
    patch({ phases });
  };
  const totals = quoteTotals(content);
  // Rarely used, so it stays folded behind a link until there is a discount.
  const [discountOpen, setDiscountOpen] = useState((quote.content.discountCents ?? 0) > 0);
  const openDiscount = () => {
    flushSync(() => setDiscountOpen(true));
    document.getElementById(`${uid}-discount`)?.focus();
  };
  const removeDiscount = () => {
    flushSync(() => {
      patch({ discountCents: 0 });
      setDiscountOpen(false);
    });
    document.getElementById(`${uid}-add-discount`)?.focus();
  };
  return (
    <ServerForm action={saveQuote} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <input type="hidden" name="id" value={quote.id} />
      <input type="hidden" name="revision" value={quote.revision} />
      <input type="hidden" name="content" value={JSON.stringify(content)} />
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader>
            <SectionTitle
              title="Proposta"
              description="O que o cliente lê primeiro."
            />
          </CardHeader>
          <CardContent className="grid gap-5">
            <FormError />
            <FormField label="Título" htmlFor={`${uid}-title`}>
              <Input
                id={`${uid}-title`}
                name="title"
                required
                maxLength={160}
                defaultValue={quote.title}
                placeholder="Ex.: Sistema de controle de OS/OR"
              />
            </FormField>
            <FormField label="Resumo" htmlFor={`${uid}-summary`}>
              <Textarea
                id={`${uid}-summary`}
                rows={3}
                maxLength={4000}
                value={content.summary}
                onChange={(event) => patch({ summary: event.target.value })}
                placeholder="Uma ou duas frases sobre o que será construído."
              />
            </FormField>
            <div className="grid gap-5 sm:grid-cols-3">
              <FormField label="Taxa/hora" htmlFor={`${uid}-rate`}>
                <MoneyField
                  id={`${uid}-rate`}
                  name="rate"
                  required={false}
                  defaultCents={quote.content.hourlyRateCents || undefined}
                  onCentsChange={(cents) => patch({ hourlyRateCents: cents })}
                />
              </FormField>
              <FormField label="Entrada (%)" htmlFor={`${uid}-upfront`}>
                <Input
                  id={`${uid}-upfront`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={content.upfrontPercent}
                  onChange={(event) => patch({ upfrontPercent: Math.min(100, whole(event.target.value)) })}
                  className="tabular-nums"
                />
              </FormField>
              <FormField label="Validade" htmlFor={`${uid}-valid`}>
                <DateField id={`${uid}-valid`} name="validUntil" defaultValue={quote.validUntil ?? ""} placeholder="Sem prazo" />
              </FormField>
            </div>
            {discountOpen ? (
              <div className="grid gap-5 sm:grid-cols-3">
                <FormField
                  label="Desconto"
                  htmlFor={`${uid}-discount`}
                  hint={
                    (content.discountCents ?? 0) > totals.subtotalCents
                      ? `Passa do valor das horas (${currency(totals.subtotalCents)}); ajuste antes de salvar.`
                      : totals.discountCents
                        ? `${discountShareLabel(totals)} do valor das horas.`
                        : "Negociado com o cliente, sai do valor das horas."
                  }
                >
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <MoneyField
                        id={`${uid}-discount`}
                        name="discount"
                        required={false}
                        defaultCents={content.discountCents || undefined}
                        onCentsChange={(cents) => patch({ discountCents: cents })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remover desconto"
                      title="Remover desconto"
                      onClick={removeDiscount}
                    >
                      <XIcon />
                    </Button>
                  </div>
                </FormField>
              </div>
            ) : (
              <Button
                id={`${uid}-add-discount`}
                type="button"
                variant="link"
                className="-mt-2 h-auto justify-self-start p-0 text-sm"
                onClick={openDiscount}
              >
                <PlusIcon />
                Adicionar desconto
              </Button>
            )}
            <StackField value={content.stack} onChange={(stack) => patch({ stack })} />
            <FormField label="Observações" htmlFor={`${uid}-notes`} hint="Aparece no rodapé da proposta, abaixo do total.">
              <Textarea
                id={`${uid}-notes`}
                rows={2}
                maxLength={4000}
                value={content.notes}
                onChange={(event) => patch({ notes: event.target.value })}
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle
              title="Fases e tarefas"
              description="Cada fase leva uma faixa de horas. O código P1-01 é automático."
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {content.phases.map((phase, index) => (
              <PhaseEditor
                key={index}
                index={index}
                phase={phase}
                last={index === content.phases.length - 1}
                onChange={(next) => setPhase(index, next)}
                onRemove={() => patch({ phases: content.phases.filter((_, i) => i !== index) })}
                onMove={(direction) => movePhase(index, direction)}
              />
            ))}
            {content.phases.length === 0 && (
              <p className="m-0 text-sm text-muted-foreground">Nenhuma fase ainda. O orçamento precisa de ao menos uma para ser enviado.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => patch({ phases: [...content.phases, emptyPhase()] })}>
                <PlusIcon />
                Adicionar fase
              </Button>
              {content.phases.length === 0 && content.summary.trim().length >= 20 && (
                <Button type="button" variant="ghost" disabled={suggesting} onClick={suggestPhases}>
                  <SparklesIcon />
                  {suggesting ? "Sugerindo…" : "Sugerir fases pelo resumo"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <SectionTitle title="Resumo" />
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="Esforço estimado">{hoursLabel(totals.hoursMin, totals.hoursMax)}</Fact>
              <Fact label="Fases · tarefas">
                {totals.phases} · {totals.tasks}
              </Fact>
              {totals.discountCents > 0 && (
                <>
                  <Fact label="Valor das horas">{currency(totals.subtotalCents)}</Fact>
                  <Fact label={`Desconto (${discountShareLabel(totals)})`}>
                    <span className="tabular-nums">− {currency(totals.discountCents)}</span>
                  </Fact>
                </>
              )}
              <Fact label="Valor total" className="col-span-2">
                <span className="text-lg font-semibold tabular-nums">{currency(totals.totalCents)}</span>
              </Fact>
              <Fact label={`Entrada (${content.upfrontPercent}%)`}>{currency(totals.upfrontCents)}</Fact>
              <Fact label={`Saldo (${100 - content.upfrontPercent}%)`}>{currency(totals.balanceCents)}</Fact>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Valor total = horas máximas × taxa/hora{totals.discountCents > 0 && " − desconto"}. {totals.hoursMax}h ×{" "}
              {currency(content.hourlyRateCents)}
              {totals.discountCents > 0 && ` − ${currency(totals.discountCents)}`}.
            </p>
          </CardContent>
          <CardFooter className="border-t">
            <SubmitButton pendingLabel="Salvando…" className="w-full">
              Salvar rascunho
            </SubmitButton>
          </CardFooter>
        </Card>
      </aside>
    </ServerForm>
  );
}
