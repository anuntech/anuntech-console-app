"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  CheckCircle2Icon,
  CircleCheckIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, SectionTitle } from "@/components/console/page-header";
import { Fact } from "@/components/console/fact";
import { Disclosure } from "@/components/console/disclosure";
import { PersonAvatar } from "@/components/console/person-avatar";
import { PixelProgress } from "@/components/console/pixel-progress";
import { ConfirmDialog, ServerForm } from "@/components/console/server-form";
import { deleteJourney, setJourneyStatus } from "@/lib/journeys/journey-actions";
import { currency, dateTimeLabel, relativeLabel } from "@/lib/format";
import { quoteStatusLabels } from "@/lib/quotes/quote-model";
import { contractStatusLabels } from "@/lib/contracts/contract-table";
import { currentStage, journeyStatusLabels, type JourneyStatus, type ResolvedStep } from "@/lib/journeys/journey-model";
import { JourneyStep, type StepHandlers } from "./journey-step";
import { JourneyBriefingEditor } from "./journey-briefing";
import { GapsDialog } from "./journey-ai";
import { AddStepDialog, EditJourneySheet, LinkRecordDialog, LostDialog, type LinkKind } from "./journey-dialogs";
import type { JourneyDetailData } from "./journey-types";

const statusTones: Record<JourneyStatus, { pill: string; dot: string }> = {
  active: { pill: "bg-accent text-primary", dot: "bg-primary" },
  paused: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  done: { pill: "bg-success-soft text-success", dot: "bg-success" },
  lost: { pill: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground/60" },
};

export function JourneyStatusBadge({ status, className }: { status: JourneyStatus; className?: string }) {
  const tone = statusTones[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone.pill, className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
      {journeyStatusLabels[status]}
    </span>
  );
}

/**
 * Done over total as a thin bar, for counts too long for a pixel per step
 * (the whole journey). The fill slides in from the left (transform, not
 * width), so finishing a step moves it without reflowing anything.
 */
export function JourneyProgress({ done, total, className }: { done: number; total: number; className?: string }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-secondary", className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${done} de ${total} passos`}
      aria-label="Passos feitos"
    >
      <div
        className="h-full w-full rounded-full bg-primary transition-transform duration-(--anu-motion-slow) ease-brand"
        style={{ transform: `translateX(${percent - 100}%)` }}
      />
    </div>
  );
}

/** The six stages across the top: where the journey is and how much of each is done. */
function StageRail({ data, current }: { data: JourneyDetailData; current: string }) {
  const { stages, done, total } = data.resolved;
  const index = Math.max(0, stages.findIndex((s) => s.key === current));
  return (
    <nav aria-label="Etapas da jornada" className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground md:hidden">
        <span>
          Etapa {index + 1} de {stages.length} · <span className="font-medium text-foreground">{stages[index]?.title}</span>
        </span>
        <span className="tabular-nums">
          {done} de {total}
        </span>
      </div>
      <JourneyProgress done={done} total={total} className="md:hidden" />
      <ol className="m-0 hidden list-none grid-cols-6 gap-2 p-0 md:grid">
        {stages.map((stage) => {
          const complete = stage.total > 0 && stage.done === stage.total;
          return (
            <li key={stage.key} className="min-w-0">
              <a
                href={`#${stage.key}`}
                aria-current={stage.key === current ? "step" : undefined}
                className={cn(
                  "flex h-full flex-col gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-accent/50",
                  stage.key === current ? "border-primary/50 bg-accent/60" : "bg-card",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {complete && <CheckCircle2Icon className="size-3.5 shrink-0 text-success" />}
                  <span className={cn("truncate font-medium", stage.key === current ? "text-primary" : "text-foreground")}>{stage.title}</span>
                </span>
                {/* One pixel per step, as in the logo's pixel half: the journey goes from raw to product. */}
                <PixelProgress
                  done={stage.done}
                  total={stage.total}
                  label={`Etapa ${stage.title}`}
                  className="gap-[3px] [&>span]:size-2 lg:gap-1 lg:[&>span]:size-2.5"
                />
                {/* The count and "Em paralelo" are on the stage's own card; here the pixels say it. */}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** "Agora": the one step to do next, why, and its button. */
function NowCard({ data, className }: { data: JourneyDetailData; className?: string }) {
  const next = data.resolved.next;
  const finished = data.resolved.total > 0 && data.resolved.done === data.resolved.total;
  return (
    <Card className={cn("gap-3 border-primary/25 py-5", className)}>
      <CardHeader>
        <SectionTitle title="Agora" description={next ? undefined : finished ? "Todos os passos foram feitos." : "Nada pronto para fazer: os passos esperam o cliente ou outro passo."} />
      </CardHeader>
      {next && (
        <CardContent className="flex flex-col gap-3">
          <div>
            <p className="m-0 text-sm font-medium text-foreground">{next.def.title}</p>
            <p className="m-0 mt-1 text-sm text-muted-foreground">{next.detail ?? next.def.help}</p>
          </div>
          <Button size="sm" className="self-start" asChild>
            <a href={`#passo-${next.def.key}`}>
              <ArrowDownIcon />
              Ir para o passo
            </a>
          </Button>
        </CardContent>
      )}
      {!next && finished && data.journey.status === "active" && (
        <CardContent>
          <p className="m-0 text-sm text-muted-foreground">Concluir a jornada tira ela da lista em andamento.</p>
        </CardContent>
      )}
    </Card>
  );
}

const invoiceLabel = (invoice: { status: string; amountCents: number } | null) =>
  !invoice ? null : `${currency(invoice.amountCents)} · ${{ draft: "rascunho", issued: "emitida", paid: "paga", cancelled: "cancelada" }[invoice.status] ?? invoice.status}`;

/** Every record the journey knows, with a way to link the ones it does not. */
function RecordsCard({ data, onLink }: { data: JourneyDetailData; onLink: (kind: LinkKind) => void }) {
  const { journey, facts, resolved } = data;
  const rows = resolved.stages.flatMap((s) => [...s.steps, ...s.optional]).filter((s) => s.row?.url || s.row?.value);
  const linkButton = (kind: LinkKind, label = "Vincular") => (
    <button type="button" onClick={() => onLink(kind)} className="text-xs font-medium text-primary hover:underline">
      {label}
    </button>
  );
  return (
    <Card variant="quiet" className="gap-4 py-5">
      <CardHeader>
        <SectionTitle title="Registros" />
      </CardHeader>
      <CardContent>
        <dl className="m-0 grid gap-4">
          {/* The company is in the header, as a link; "Trocar empresa" is in the "…" menu. */}
          {!journey.company && <Fact label="Empresa">{linkButton("company", "Vincular empresa")}</Fact>}
          {journey.company && (
            <>
              <Fact label="Pedido">
                <span className="flex flex-wrap items-center gap-x-2">
                  {facts.ticket ? (
                    <Link href={`/chamados/${facts.ticket.id}`} className="text-primary hover:underline">
                      {facts.ticket.subject}
                    </Link>
                  ) : null}
                  {linkButton("ticket", facts.ticket ? "Trocar" : "Vincular")}
                </span>
              </Fact>
              <Fact label="Orçamento">
                <span className="flex flex-wrap items-center gap-x-2">
                  {facts.quote ? (
                    <Link href={`/orcamentos/${facts.quote.id}`} className="text-primary hover:underline">
                      {facts.quote.number} · {quoteStatusLabels[facts.quote.status]}
                    </Link>
                  ) : null}
                  {linkButton("quote", facts.quote ? "Trocar" : "Vincular")}
                </span>
              </Fact>
              {facts.contract && (
                <Fact label="Contrato">
                  <Link href={`/contratos/${facts.contract.id}`} className="text-primary hover:underline">
                    {contractStatusLabels[facts.contract.status as keyof typeof contractStatusLabels] ?? facts.contract.status}
                  </Link>
                </Fact>
              )}
              {facts.upfront && (
                <Fact label="Entrada">
                  <Link href={`/financeiro/${facts.upfront.id}`} className="text-primary hover:underline">
                    {invoiceLabel(facts.upfront)}
                  </Link>
                </Fact>
              )}
              {facts.balance && (
                <Fact label="Saldo">
                  <Link href={`/financeiro/${facts.balance.id}`} className="text-primary hover:underline">
                    {invoiceLabel(facts.balance)}
                  </Link>
                </Fact>
              )}
              <Fact label="Projeto">
                <span className="flex flex-wrap items-center gap-x-2">
                  {facts.project ? (
                    <Link href={`/projetos/${facts.project.id}`} className="text-primary hover:underline">
                      {facts.project.name}
                    </Link>
                  ) : null}
                  {linkButton("project", facts.project ? "Trocar" : "Vincular")}
                </span>
              </Fact>
              <Fact label="Hospedagem">
                <span className="flex flex-wrap items-center gap-x-2">
                  {facts.hosting ? (
                    <Link href={`/produtos/${facts.hosting.id}`} className="text-primary hover:underline">
                      {facts.hosting.name}
                    </Link>
                  ) : null}
                  {linkButton("hosting", facts.hosting ? "Trocar" : "Vincular")}
                </span>
              </Fact>
            </>
          )}
          {rows.map((step) => (
            <Fact key={step.def.key} label={step.def.title}>
              {step.row?.url ? (
                <a href={step.row.url} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
                  {step.row.value ? `${step.row.value} · ` : ""}
                  {step.row.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              ) : (
                step.row?.value
              )}
            </Fact>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function ActivityList({ events, now }: { events: JourneyDetailData["activity"]; now: string }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {events.map((event) => (
        <li key={event.id} className="text-sm">
          <span className="block text-foreground">{event.label}</span>
          <time dateTime={event.at} title={dateTimeLabel(event.at)} className="text-xs text-muted-foreground">
            {event.who} · {relativeLabel(event.at, now)}
          </time>
        </li>
      ))}
    </ol>
  );
}

function ActivityCard({ data }: { data: JourneyDetailData }) {
  if (!data.activity.length) return null;
  return (
    <Card variant="quiet" className="gap-4 py-5">
      <CardHeader>
        <SectionTitle title="Atividade" />
      </CardHeader>
      <CardContent>
        <ActivityList events={data.activity.slice(0, 5)} now={data.now} />
        {data.activity.length > 5 && (
          <Disclosure summary={`Ver todos (${data.activity.length})`} className="mt-3">
            <ActivityList events={data.activity.slice(5)} now={data.now} />
          </Disclosure>
        )}
      </CardContent>
    </Card>
  );
}

/** What a stage waits for outside itself: its steps' unfinished prerequisites in other stages, by title. */
function stageBlockers(steps: ResolvedStep[], statusOf: Map<string, ResolvedStep["status"]>, titleOf: Map<string, string>) {
  const inside = new Set(steps.map((s) => s.def.key));
  const keys = [...new Set(steps.flatMap((s) => s.def.after ?? []))].filter((key) => {
    const status = statusOf.get(key);
    return !inside.has(key) && status !== "done" && status !== "skipped";
  });
  return keys.map((key) => titleOf.get(key)).filter((title): title is string => !!title).map((title) => title.charAt(0).toLowerCase() + title.slice(1));
}

/** The journey: the stages with their steps on the left, "Agora", the records and the history on the right. */
export function JourneyDetail({ data }: { data: JourneyDetailData }) {
  const { journey, resolved } = data;
  const [editing, setEditing] = useState(false);
  const [link, setLink] = useState<LinkKind | null>(null);
  const [adding, setAdding] = useState(false);
  const [gaps, setGaps] = useState(false);
  const [confirm, setConfirm] = useState<null | "lost" | "done" | "delete">(null);
  const later = (fn: () => void) => setTimeout(fn, 0);
  const statusForm = useRef<HTMLFormElement>(null);
  const handlers: StepHandlers = { onLinkHosting: () => setLink("hosting"), onLinkCompany: () => setLink("company") };
  const current = currentStage(resolved);
  const everyStep = resolved.stages.flatMap((s) => [...s.steps, ...s.optional]);
  const statusOf = new Map(everyStep.map((s) => [s.def.key, s.status]));
  const titleOf = new Map(everyStep.map((s) => [s.def.key, s.def.title]));
  const owner = journey.owner;
  const step = (s: ResolvedStep) => (
    <JourneyStep
      key={s.def.key}
      step={s}
      journeyId={journey.id}
      quoteId={journey.quoteId}
      voice={data.voice}
      handlers={handlers}
      highlight={resolved.next?.def.key === s.def.key}
      panel={s.def.key === "briefing" ? <JourneyBriefingEditor journeyId={journey.id} briefing={data.briefing} voice={data.voice} /> : undefined}
    />
  );
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jornadas", href: "/jornadas" }]}
        title={journey.title}
        className="mb-5"
        // In progress is the normal state; the next step lives in "Agora", once.
        meta={[
          journey.status !== "active" && <JourneyStatusBadge key="status" status={journey.status} />,
          journey.company ? (
            <Link key="company" href={`/empresas/${journey.company.id}`} className="text-primary hover:underline">
              {journey.company.name}
            </Link>
          ) : (
            <span key="company">{journey.lead ? `Contato: ${journey.lead.name}` : "Sem cadastro"}</span>
          ),
          owner && (
            <span key="owner" className="inline-flex items-center gap-1.5">
              <PersonAvatar person={owner} size={18} tone="staff" />
              {owner.name || owner.email}
            </span>
          ),
        ]}
        actionsInline
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações da jornada">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => later(() => setEditing(true))}>
                  <PencilIcon />
                  Editar jornada
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => later(() => setLink("company"))}>
                  <LinkIcon />
                  {journey.company ? "Trocar empresa" : "Vincular empresa"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => later(() => setAdding(true))}>
                  <PlusIcon />
                  Acrescentar passo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => later(() => setGaps(true))}>
                  <SparklesIcon />
                  O que está faltando?
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {journey.status === "active" ? (
                  <DropdownMenuItem onSelect={() => later(() => statusForm.current?.requestSubmit())}>
                    <PauseIcon />
                    Pausar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => later(() => statusForm.current?.requestSubmit())}>
                    <PlayIcon />
                    Retomar
                  </DropdownMenuItem>
                )}
                {journey.status !== "done" && (
                  <DropdownMenuItem onSelect={() => later(() => setConfirm("done"))}>
                    <CircleCheckIcon />
                    Concluir jornada
                  </DropdownMenuItem>
                )}
                {journey.status !== "lost" && (
                  <DropdownMenuItem onSelect={() => later(() => setConfirm("lost"))}>
                    <XCircleIcon />
                    Marcar como perdida
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => later(() => setConfirm("delete"))}>
                  <Trash2Icon />
                  Excluir jornada
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <StageRail data={data} current={current} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <NowCard data={data} className="xl:hidden" />
          {resolved.stages.map((stage) => {
            const all = [...stage.steps, ...stage.optional];
            // A warning several steps share is said once, under the stage title.
            const warnings = [...new Set(all.map((s) => s.warning).filter((w): w is string => !!w))];
            const quiet = (s: ResolvedStep) => (s.warning ? { ...s, warning: null } : s);
            // Nothing to do yet and nothing done: the stage opens closed, said by what it waits for.
            const blocked = stage.steps.length > 0 && all.every((s) => s.status === "waiting");
            const waitsFor = blocked ? stageBlockers(all, statusOf, titleOf) : [];
            const list = (
              <>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">{stage.steps.map((s) => step(quiet(s)))}</ul>
                {stage.optional.length > 0 && (
                  <details className="group mt-2">
                    <summary className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                      Também vale conferir ({stage.optional.length})
                    </summary>
                    <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">{stage.optional.map((s) => step(quiet(s)))}</ul>
                  </details>
                )}
              </>
            );
            return (
            <Card key={stage.key} id={stage.key} className="scroll-mt-24 gap-3 py-5">
              <CardHeader>
                <SectionTitle
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {stage.title}
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground tabular-nums">
                        {stage.done} de {stage.total}
                      </span>
                    </span>
                  }
                  description={stage.description}
                />
              </CardHeader>
              <CardContent className="px-3 sm:px-4">
                {warnings.map((warning) => (
                  <p key={warning} className="m-0 mb-2 flex items-start gap-1.5 px-3 text-xs text-warning">
                    <AlertTriangleIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    {warning}
                  </p>
                ))}
                {blocked ? (
                  <Disclosure
                    className="px-3"
                    summary={waitsFor.length ? `Depende de: ${waitsFor.join(", ")}` : "Esperando outro passo"}
                  >
                    <div className="-mx-3">{list}</div>
                  </Disclosure>
                ) : (
                  list
                )}
              </CardContent>
            </Card>
            );
          })}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setAdding(true)}>
              <PlusIcon />
              Acrescentar passo
            </Button>
            <Button variant="ghost" onClick={() => setGaps(true)}>
              <SparklesIcon />
              O que está faltando?
            </Button>
          </div>
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          <NowCard data={data} className="max-xl:hidden" />
          <RecordsCard data={data} onLink={setLink} />
          <ActivityCard data={data} />
        </aside>
      </div>
      {/* Pause and resume straight from the menu: no question, it is easy to undo. */}
      <ServerForm ref={statusForm} action={setJourneyStatus} className="hidden">
        <input type="hidden" name="id" value={journey.id} />
        <input type="hidden" name="status" value={journey.status === "active" ? "paused" : "active"} />
      </ServerForm>
      <EditJourneySheet data={data} open={editing} onOpenChange={setEditing} />
      {link && <LinkRecordDialog key={link} data={data} kind={link} open onOpenChange={(open) => !open && setLink(null)} />}
      <AddStepDialog journeyId={journey.id} open={adding} onOpenChange={setAdding} />
      <GapsDialog journeyId={journey.id} open={gaps} onOpenChange={setGaps} />
      <LostDialog journeyId={journey.id} open={confirm === "lost"} onOpenChange={(open) => !open && setConfirm(null)} />
      <ConfirmDialog
        open={confirm === "done"}
        onOpenChange={(open) => !open && setConfirm(null)}
        action={setJourneyStatus}
        fields={{ id: journey.id, status: "done" }}
        title="Concluir a jornada?"
        description={
          resolved.done < resolved.total
            ? `Faltam ${resolved.total - resolved.done} de ${resolved.total} passos. A jornada sai da lista em andamento e pode ser retomada depois.`
            : "A jornada sai da lista em andamento e pode ser retomada depois."
        }
        confirmLabel="Concluir"
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        action={deleteJourney}
        fields={{ id: journey.id }}
        title="Excluir a jornada?"
        description="Some a jornada e o que foi marcado nela. A empresa, o orçamento, o contrato e o projeto continuam como estão."
        confirmLabel="Excluir"
        destructive
      />
    </>
  );
}
