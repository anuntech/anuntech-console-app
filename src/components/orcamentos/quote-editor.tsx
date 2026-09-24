"use client";
import Link from "next/link";
import { useId, useState, type KeyboardEvent } from "react";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/console/page-header";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import { DateField } from "@/components/console/date-field";
import { Fact } from "@/components/console/fact";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { MoneyInput } from "@/components/financeiro/invoice-money";
import { createQuote, saveQuote } from "@/lib/quote-actions";
import { currency } from "@/lib/format";
import {
  emptyQuoteContent,
  hoursLabel,
  quoteTotals,
  taskCode,
  type QuoteContent,
  type QuotePhase,
} from "@/lib/quote-model";

export type QuoteEditorData = {
  /** Only when creating: who the proposal is for. */
  companies: CompanyOption[];
  companyId?: string;
  quote?: { id: string; revision: number; title: string; validUntil: string | null; content: QuoteContent };
};

const emptyPhase = (): QuotePhase => ({ name: "", description: "", hoursMin: 0, hoursMax: 0, tasks: [] });
const whole = (value: string) => Math.max(0, Math.floor(Number(value) || 0));

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
    <div>
      <Label htmlFor={uid} className="mb-1.5">
        Stack
      </Label>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-field px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {value.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
            {item}
            <button
              type="button"
              aria-label={`Remover ${item}`}
              onClick={() => onChange(value.filter((entry) => entry !== item))}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </span>
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
      <p className="mt-1.5 text-xs text-muted-foreground">Enter ou vírgula separa cada tecnologia.</p>
    </div>
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
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_96px_96px]">
            <div>
              <Label htmlFor={`${uid}-name`} className="mb-1.5">
                Fase
              </Label>
              <Input
                id={`${uid}-name`}
                value={phase.name}
                maxLength={160}
                placeholder="Ex.: Planejamento e fundação"
                onChange={(event) => onChange({ ...phase, name: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor={`${uid}-min`} className="mb-1.5">
                Horas mín.
              </Label>
              <Input
                id={`${uid}-min`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="0"
                value={phase.hoursMin || ""}
                onChange={(event) => onChange({ ...phase, hoursMin: whole(event.target.value) })}
                className="tabular-nums"
              />
            </div>
            <div>
              <Label htmlFor={`${uid}-max`} className="mb-1.5">
                Horas máx.
              </Label>
              <Input
                id={`${uid}-max`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="0"
                value={phase.hoursMax || ""}
                onChange={(event) => onChange({ ...phase, hoursMax: whole(event.target.value) })}
                className="tabular-nums"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`${uid}-description`} className="mb-1.5">
              Descrição
            </Label>
            <Textarea
              id={`${uid}-description`}
              rows={2}
              maxLength={4000}
              placeholder="O que esta fase entrega."
              value={phase.description}
              onChange={(event) => onChange({ ...phase, description: event.target.value })}
            />
          </div>
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
 * Creating or editing a draft proposal. The whole structure lives in
 * state and is posted as one JSON field; the summary on the side shows
 * the numbers the proposal will print as they change.
 */
export function QuoteEditor({ companies, companyId, quote }: QuoteEditorData) {
  const editing = !!quote;
  const uid = useId();
  const [content, setContent] = useState<QuoteContent>(quote?.content ?? emptyQuoteContent());
  const patch = (next: Partial<QuoteContent>) => setContent((current) => ({ ...current, ...next }));
  const setPhase = (index: number, phase: QuotePhase) => patch({ phases: content.phases.map((entry, i) => (i === index ? phase : entry)) });
  const movePhase = (index: number, direction: -1 | 1) => {
    const phases = [...content.phases];
    const target = index + direction;
    if (target < 0 || target >= phases.length) return;
    [phases[index], phases[target]] = [phases[target], phases[index]];
    patch({ phases });
  };
  const totals = quoteTotals(content);
  return (
    <ServerForm
      action={editing ? saveQuote : createQuote}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
    >
      {editing && <input type="hidden" name="id" value={quote.id} />}
      {editing && <input type="hidden" name="revision" value={quote.revision} />}
      <input type="hidden" name="content" value={JSON.stringify(content)} />
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader>
            <SectionTitle
              title="Proposta"
              description="O que o cliente lê primeiro: para quem é, do que se trata e quanto custa por hora."
            />
          </CardHeader>
          <CardContent className="grid gap-5">
            <FormError />
            {!editing &&
              (companies.length === 1 ? (
                <input type="hidden" name="companyId" value={companies[0].id} />
              ) : (
                <div>
                  <Label htmlFor={`${uid}-company`} className="mb-1.5">
                    Empresa
                  </Label>
                  <CompanyField id={`${uid}-company`} name="companyId" required companies={companies} defaultValue={companyId} />
                </div>
              ))}
            <div>
              <Label htmlFor={`${uid}-title`} className="mb-1.5">
                Título
              </Label>
              <Input
                id={`${uid}-title`}
                name="title"
                required
                maxLength={160}
                defaultValue={quote?.title ?? ""}
                placeholder="Ex.: Sistema de controle de OS/OR"
                autoFocus={!editing && companies.length === 1}
              />
            </div>
            <div>
              <Label htmlFor={`${uid}-summary`} className="mb-1.5">
                Resumo
              </Label>
              <Textarea
                id={`${uid}-summary`}
                rows={3}
                maxLength={4000}
                value={content.summary}
                onChange={(event) => patch({ summary: event.target.value })}
                placeholder="Uma ou duas frases sobre o que será construído."
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <Label htmlFor={`${uid}-rate`} className="mb-1.5">
                  Taxa/hora
                </Label>
                <MoneyInput
                  id={`${uid}-rate`}
                  name="rate"
                  required={false}
                  defaultCents={quote?.content.hourlyRateCents || undefined}
                  onCentsChange={(cents) => patch({ hourlyRateCents: cents })}
                />
              </div>
              <div>
                <Label htmlFor={`${uid}-upfront`} className="mb-1.5">
                  Entrada (%)
                </Label>
                <Input
                  id={`${uid}-upfront`}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  value={content.upfrontPercent}
                  onChange={(event) => patch({ upfrontPercent: Math.min(100, whole(event.target.value)) })}
                  className="tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor={`${uid}-valid`} className="mb-1.5">
                  Válido até
                </Label>
                <DateField id={`${uid}-valid`} name="validUntil" defaultValue={quote?.validUntil ?? ""} placeholder="Sem prazo" />
              </div>
            </div>
            <StackField value={content.stack} onChange={(stack) => patch({ stack })} />
            <div>
              <Label htmlFor={`${uid}-notes`} className="mb-1.5">
                Observações
              </Label>
              <Textarea
                id={`${uid}-notes`}
                rows={2}
                maxLength={4000}
                value={content.notes}
                onChange={(event) => patch({ notes: event.target.value })}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Aparece no rodapé da proposta, abaixo do total.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle
              title="Fases e tarefas"
              description="Cada fase leva uma faixa de horas; as tarefas explicam o que entra nela. O código P1-01 é automático."
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
            <Button type="button" variant="outline" className="self-start" onClick={() => patch({ phases: [...content.phases, emptyPhase()] })}>
              <PlusIcon />
              Adicionar fase
            </Button>
          </CardContent>
        </Card>
      </div>

      <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <SectionTitle title="Resumo" description="Os números que a proposta vai mostrar." />
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="Esforço estimado">{hoursLabel(totals.hoursMin, totals.hoursMax)}</Fact>
              <Fact label="Fases · tarefas">
                {totals.phases} · {totals.tasks}
              </Fact>
              <Fact label="Valor total" className="col-span-2">
                <span className="text-lg font-semibold tabular-nums">{currency(totals.totalCents)}</span>
              </Fact>
              <Fact label={`Entrada (${content.upfrontPercent}%)`}>{currency(totals.upfrontCents)}</Fact>
              <Fact label={`Saldo (${100 - content.upfrontPercent}%)`}>{currency(totals.balanceCents)}</Fact>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Valor total = horas máximas × taxa/hora. {totals.hoursMax}h × {currency(content.hourlyRateCents)}.
            </p>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2 border-t">
            <SubmitButton pendingLabel={editing ? "Salvando…" : "Criando…"}>{editing ? "Salvar rascunho" : "Criar rascunho"}</SubmitButton>
            {!editing && (
              <Button type="button" variant="ghost" asChild>
                <Link href="/orcamentos">Cancelar</Link>
              </Button>
            )}
          </CardFooter>
        </Card>
      </aside>
    </ServerForm>
  );
}
