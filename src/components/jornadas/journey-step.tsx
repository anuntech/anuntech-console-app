"use client";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  ExternalLinkIcon,
  MinusCircleIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DateField } from "@/components/console/date-field";
import { FormField } from "@/components/console/form-field";
import { DictationButton } from "@/components/console/dictation-button";
import { ConfirmAction, FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { setNativeValue } from "@/components/console/insert-text";
import { toast } from "@/components/shell/notifications";
import { createJourneyQuote, removeJourneyStep, saveJourneyStep } from "@/lib/journeys/journey-actions";
import { createProjectFromQuote } from "@/lib/quotes/quote-actions";
import type { ResolvedStep, StepStatus } from "@/lib/journeys/journey-model";
import { StepAi } from "./journey-ai";

const statusIcon: Record<StepStatus, { icon: typeof CircleIcon; className: string; label: string }> = {
  done: { icon: CheckCircle2Icon, className: "text-success", label: "Feito" },
  doing: { icon: CircleDotIcon, className: "text-warning", label: "Em andamento" },
  ready: { icon: CircleIcon, className: "text-primary", label: "Pronto para fazer" },
  waiting: { icon: CircleDashedIcon, className: "text-muted-foreground", label: "Esperando outro passo" },
  skipped: { icon: MinusCircleIcon, className: "text-muted-foreground", label: "Não se aplica" },
};

/** The journey's actions a step can trigger, given by the page (they need the journey and its records). */
export type StepHandlers = {
  onLinkHosting: () => void;
  onLinkCompany: () => void;
};

/** What a step's button does: open the right Console form, or one of the journey's own shortcuts. */
function StepButton({ step, journeyId, quoteId, handlers }: { step: ResolvedStep; journeyId: string; quoteId: string | null; handlers: StepHandlers }) {
  const action = step.action;
  if (!action) return null;
  const variant = step.status === "ready" || step.status === "doing" ? "default" : "outline";
  if (action.type === "link")
    return (
      <Button size="sm" variant={step.status === "done" || step.status === "skipped" ? "ghost" : variant} asChild>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  if (action.type === "createQuote")
    return (
      <ServerForm action={createJourneyQuote} className="contents">
        <input type="hidden" name="journeyId" value={journeyId} />
        <SubmitButton size="sm" variant={variant} pendingLabel="Criando…">
          {action.label}
        </SubmitButton>
      </ServerForm>
    );
  if (action.type === "createProject" && quoteId)
    return (
      <ConfirmAction
        action={createProjectFromQuote}
        fields={{ id: quoteId }}
        title="Criar o projeto agora?"
        description="O projeto nasce com as fases e tarefas do orçamento. O cliente vê o projeto e o quadro assim que ele é criado."
        confirmLabel="Criar projeto"
      >
        <Button size="sm" variant={variant}>
          {action.label}
        </Button>
      </ConfirmAction>
    );
  if (action.type === "linkHosting")
    return (
      <Button size="sm" variant={variant} onClick={handlers.onLinkHosting}>
        {action.label}
      </Button>
    );
  if (action.type === "linkCompany")
    return (
      <Button size="sm" variant={variant} onClick={handlers.onLinkCompany}>
        {action.label}
      </Button>
    );
  return null;
}

const NOTE_LIMIT = 4000;
const toDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso)) : "");

/**
 * One step: status, title, what the data shows, the button that does it; a
 * click on the chevron opens the help, the fields, the note and the AI.
 */
export function JourneyStep({
  step,
  journeyId,
  quoteId,
  voice,
  handlers,
  highlight = false,
  panel,
}: {
  step: ResolvedStep;
  journeyId: string;
  quoteId: string | null;
  voice: boolean;
  handlers: StepHandlers;
  /** The step "Agora" points at. */
  highlight?: boolean;
  /** Replaces the fields and the AI (the briefing has an editor of its own). */
  panel?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Mounted on first open and kept: closing a step never throws away what was typed or what the AI wrote.
  const [seen, setSeen] = useState(false);
  const note = useRef<HTMLTextAreaElement>(null);
  const { def, row } = step;
  const look = statusIcon[step.status];
  const Icon = look.icon;
  const auto = def.source === "auto";
  const fields = def.fields ?? [];
  // The client step's detail is the company's name, which the page header already shows.
  const detail = def.key === "cadastro" && step.status === "done" ? null : step.detail;
  const panelId = `passo-${def.key.replace(/[^a-z0-9-]/gi, "")}-painel`;
  const useNote = (text: string) => {
    if (!note.current) return;
    const current = note.current.value.trim();
    const joined = current ? `${current}\n\n${text}` : text;
    // The note holds 4 thousand characters; a longer text is kept whole with "Guardar na jornada".
    if (joined.length > NOTE_LIMIT) toast.warning("O texto passou do limite da anotação e foi cortado. Para guardar inteiro, use Guardar na jornada.");
    setNativeValue(note.current, joined.slice(0, NOTE_LIMIT));
    note.current.focus({ preventScroll: true });
    note.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  return (
    <li id={`passo-${def.key}`} className={cn("scroll-mt-24 rounded-lg", highlight && "bg-accent/50 ring-1 ring-primary/25")}>
      <div className="flex min-h-12 items-start gap-3 px-3 py-2.5">
        <Icon className={cn("mt-0.5 size-5 shrink-0", look.className)} aria-label={look.label} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={cn("text-sm font-medium", step.status === "skipped" ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground")}>
              {def.title}
            </span>
            {!def.required && !step.extra && <span className="text-caption text-muted-foreground">opcional</span>}
            {step.extra && <span className="rounded-full bg-secondary px-1.5 py-px text-caption text-secondary-foreground">acrescentado</span>}
          </div>
          {detail && (
            <p className="m-0 mt-0.5 text-xs break-words text-muted-foreground">
              {detail}
              {/* Who ticked a finished step is history; "pelo Console" matters while the step is still open. */}
              {step.by === "data" && step.status !== "waiting" && step.status !== "done" ? <span className="ml-1.5 text-caption text-muted-foreground">· pelo Console</span> : null}
            </p>
          )}
          {step.warning && (
            <p className="m-0 mt-1 flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangleIcon className="mt-px size-3.5 shrink-0" />
              {step.warning}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="hidden sm:block">
            <StepButton step={step} journeyId={journeyId} quoteId={quoteId} handlers={handlers} />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? `Fechar ${def.title}` : `Abrir ${def.title}`}
            onClick={() => {
              setSeen(true);
              setOpen((value) => !value);
            }}
          >
            <ChevronDownIcon className={cn("transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>
      {step.action && (
        <div className="px-3 pb-2.5 pl-11 sm:hidden">
          <StepButton step={step} journeyId={journeyId} quoteId={quoteId} handlers={handlers} />
        </div>
      )}
      {seen && panel && (
        <div id={panelId} hidden={!open} className="flex flex-col gap-4 border-t px-3 py-4 sm:pl-11">
          <p className="m-0 text-sm text-muted-foreground">{def.help}</p>
          {panel}
        </div>
      )}
      {seen && !panel && (
        <div id={panelId} hidden={!open} className="flex flex-col gap-4 border-t px-3 py-4 sm:pl-11">
          <p className="m-0 text-sm text-muted-foreground">{def.help}</p>
          <ServerForm action={saveJourneyStep} className="flex flex-col gap-4">
            <input type="hidden" name="journeyId" value={journeyId} />
            <input type="hidden" name="key" value={def.key} />
            <FormError />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Situação" htmlFor={`${panelId}-status`} hint={auto ? "Este passo conta sozinho pelo Console." : undefined}>
                <NativeSelect id={`${panelId}-status`} name="status" defaultValue={row?.status ?? "todo"}>
                  <NativeSelectOption value="todo">{auto ? "Conforme o Console" : "A fazer"}</NativeSelectOption>
                  {!auto && <NativeSelectOption value="doing">Em andamento</NativeSelectOption>}
                  {!auto && <NativeSelectOption value="done">Feito</NativeSelectOption>}
                  <NativeSelectOption value="skipped">Não se aplica</NativeSelectOption>
                </NativeSelect>
              </FormField>
              {fields.includes("url") && (
                <FormField label="Link" htmlFor={`${panelId}-url`} hint={def.urlHint} className="sm:col-span-2">
                  <div className="flex gap-2">
                    <Input id={`${panelId}-url`} name="url" type="url" inputMode="url" defaultValue={row?.url ?? ""} placeholder="https://" maxLength={500} />
                    {row?.url && (
                      <Button type="button" variant="outline" size="icon" asChild>
                        <a href={row.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir o link em nova aba">
                          <ExternalLinkIcon />
                        </a>
                      </Button>
                    )}
                  </div>
                </FormField>
              )}
              {fields.includes("value") && (
                <FormField label={def.valueLabel ?? "Valor"} htmlFor={`${panelId}-value`}>
                  <Input id={`${panelId}-value`} name="value" defaultValue={row?.value ?? ""} maxLength={200} />
                </FormField>
              )}
              {fields.includes("date") && (
                <FormField label={def.key === "aceite" ? "Data do aceite" : def.key === "garantia" ? "Garantia até" : "Data"} htmlFor={`${panelId}-date`}>
                  <DateField id={`${panelId}-date`} name="scheduledAt" defaultValue={toDate(row?.scheduledAt ?? null)} placeholder="Sem data" />
                </FormField>
              )}
            </div>
            <FormField
              label="Anotações"
              htmlFor={`${panelId}-note`}
              hint={fields.includes("url") || fields.includes("value") ? "Só nomes e links. Senhas e chaves ficam na Vercel ou no cofre, nunca aqui." : "Para \"Não se aplica\", diga por quê."}
            >
              <Textarea ref={note} id={`${panelId}-note`} name="note" defaultValue={row?.note ?? ""} rows={3} maxLength={NOTE_LIMIT} />
              {voice && <DictationButton target={note} maxLength={NOTE_LIMIT} />}
            </FormField>
            <SubmitButton size="sm" className="self-start" pendingLabel="Salvando…">
              Salvar passo
            </SubmitButton>
          </ServerForm>
          {/* Outside the step's form: the confirmation brings a form of its own. */}
          {step.extra && (
            <ConfirmAction
              action={removeJourneyStep}
              fields={{ journeyId, key: def.key }}
              title="Tirar este passo?"
              description={`"${def.title}" sai desta jornada, com o que foi anotado nele.`}
              confirmLabel="Tirar passo"
              destructive
            >
              <Button type="button" variant="ghost" size="sm" className="self-start text-destructive">
                <Trash2Icon />
                Tirar passo
              </Button>
            </ConfirmAction>
          )}
          <StepAi journeyId={journeyId} step={step} onUseNote={useNote} />
        </div>
      )}
    </li>
  );
}
