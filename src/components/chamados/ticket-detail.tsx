"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import {
  SparklesIcon,
  CalculatorIcon,
  ClockIcon,
  HeadsetIcon,
  HourglassIcon,
  LockIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  SendIcon,
  Trash2Icon,
  RouteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Disclosure } from "@/components/console/disclosure";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PageHeader, SectionTitle } from "@/components/console/page-header";
import { AnimatedValue } from "@/components/console/motion";
import { Fact } from "@/components/console/fact";
import { FormField } from "@/components/console/form-field";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { toast } from "@/components/shell/notifications";
import { setNativeValue } from "@/components/console/insert-text";
import { replyTicket, updateTicket } from "@/lib/actions";
import {
  dateLabel,
  dateTimeLabel,
  dueLabel,
  priorityLabels,
  relativeLabel,
  ticketLabels,
} from "@/lib/format";
import {
  ticketChannelLabels,
  ticketImpactLabels,
  ticketKindLabels,
  type TicketChannel,
  type TicketImpact,
  type TicketKind,
} from "@/lib/tickets/ticket-intake";
import type { TicketPriority, TicketStatus } from "@/lib/tickets/ticket-table";
import { AttachmentField } from "@/components/console/attachment-field";
import { FileRow } from "@/components/console/file-chip";
import { canDeleteTicket } from "@/lib/deletion-rules";
import {
  CloseTicketDialog,
  DeleteTicketDialog,
  useTicketMove,
} from "./ticket-actions";
import { TicketPriorityMark, TicketStatusBadge } from "./ticket-badges";
import { useTicketUploads } from "./ticket-uploads";
import { EstimateCard, TicketHoursCard, type TicketHoursData } from "./ticket-hours";
import { TicketFollowCard, type TicketFollowUp } from "./ticket-follow-card";
import { TicketTriageNotice } from "./ticket-triage-notice";
import { TicketThread } from "./ticket-thread";
import type { TicketTriage } from "@/lib/tickets/ticket-triage";

export type TicketFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  createdAt: string;
  author: string;
};
export type TicketEntry =
  | {
      kind: "message";
      id: string;
      body: string;
      createdAt: string;
      author: string;
      authorId?: string;
      authorImage?: string | null;
      staff: boolean;
    }
  | { kind: "file"; file: TicketFile; staff: boolean };
/** `email` is what `updateTicket` stores in `assignedTo`. */
/** `aliases` are other e-mails of the same person (a staff alias), so an older assignment still matches. */
export type TicketAssignee = { name: string; email: string; aliases?: string[] };
/** The ticket's deadlines under its company's conditions, as this viewer may see them. */
export type TicketClock = {
  label: string;
  responseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  respondedIn: string | null;
  /** While the clock stands still waiting for the client. */
  pausedSince: string | null;
  /** Team only: the client sees these dates from this instant. */
  clientFrom: string | null;
};
export type TicketDetailData = {
  ticket: {
    id: string;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    assignedTo: string | null;
    /** For clients: the assignee's name (or "Equipe Anuntech"), never the e-mail. */
    assigneeName?: string | null;
    kind?: TicketKind | null;
    impact?: TicketImpact | null;
    channel?: TicketChannel;
    /** While waiting for the client: what the team needs. */
    waitingFor?: string | null;
    createdAt: string;
    updatedAt: string;
    companyId: string;
    /** The display name (companyDisplayName), never the razão social. */
    company: string;
    engagement: string | null;
    author: { name: string; email: string };
  };
  /** Messages and attachments in the order they happened. */
  entries: TicketEntry[];
  files: TicketFile[];
  /** `showCompany`: the team, or a client who sees more than one company; a client is not told its own name. */
  viewer: { admin: boolean; showCompany?: boolean };
  /** Staff: a reply prepared elsewhere (a proposal sent or answered), ready to review and send. */
  replyDraft?: string;
  /** Staff: remind or resolve a ticket that waits on the client; say a finished one took no hours. */
  followUp?: TicketFollowUp;
  /** Staff: Jev read the text as worse than what was ticked; the suggested priority. */
  triage?: TicketTriage | null;
  /** Staff, on a "projeto novo" request: the project journey it started, if any. */
  journeyId?: string | null;
  /** Staff who can take the ticket; loaded only for admins. */
  assignees?: TicketAssignee[];
  clock?: TicketClock | null;
  hours?: TicketHoursData | null;
  now: string;
};

const STATUSES: TicketStatus[] = [
  "open",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
];

/**
 * The assignee options and the one to preselect. An assignee who is no longer
 * staff (or was typed by hand before this was a list) stays as an option;
 * otherwise the select would fall back to "Sem responsável" and saving the
 * status would silently unassign the ticket.
 */
function assigneeOptions(people: TicketAssignee[], current: string | null) {
  if (!current) return { options: people, selected: "" };
  const wanted = current.trim().toLowerCase();
  const match = people.find(
    (person) => person.email === wanted || person.aliases?.includes(wanted),
  );
  if (match) return { options: people, selected: match.email };
  return {
    options: [...people, { name: current, email: current }],
    selected: current,
  };
}


function When({ at, now }: { at: string; now: string }) {
  return (
    <time
      dateTime={at}
      title={dateTimeLabel(at)}
      className="text-xs text-muted-foreground"
    >
      {relativeLabel(at, now)}
    </time>
  );
}

/** Staff: a reply drafted from the conversation and the conditions, into the box to edit before sending. */
function SuggestReply({ ticketId, field }: { ticketId: string; field: React.RefObject<HTMLTextAreaElement | null> }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const res = await fetch(`/api/chamados/${ticketId}/sugestao`, { method: "POST" });
          const data = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
          if (!res.ok || !data?.text) throw new Error(data?.error ?? "Não foi possível sugerir agora.");
          const el = field.current;
          if (el) {
            setNativeValue(el, el.value.trim() ? `${el.value.trim()}\n\n${data.text}` : data.text);
            el.focus();
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Não foi possível sugerir agora.");
        } finally {
          setPending(false);
        }
      }}
    >
      <SparklesIcon />
      {pending ? "Escrevendo…" : "Sugerir resposta"}
    </Button>
  );
}

function Composer({ ticketId, draft, suggest }: { ticketId: string; draft?: string; suggest?: boolean }) {
  const uploads = useTicketUploads();
  const field = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  return (
    <ServerForm
      action={replyTicket}
      prepare={uploads}
      reset
      onSuccess={() => {
        // A prepared reply is used once: the reset would bring it back from the URL.
        if (!draft) return;
        if (field.current) {
          field.current.defaultValue = "";
          field.current.value = "";
        }
        router.replace(pathname, { scroll: false });
      }}
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        const form = event.currentTarget;
        const body = (
          form.elements.namedItem("body") as HTMLTextAreaElement
        ).value.trim();
        const files = (form.elements.namedItem("files") as HTMLInputElement)
          .files?.length;
        if (!body && !files) {
          event.preventDefault();
          toast.error("Escreva uma resposta ou anexe um arquivo.");
        }
      }}
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <Label htmlFor="reply-body" className="sr-only">
        Sua resposta
      </Label>
      {/* One surface: the box and its tools share the border and the focus ring. */}
      <div className="rounded-xl border border-input bg-field transition-[border-color,box-shadow] hover:border-field-hover has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-[3px] has-[textarea:focus-visible]:ring-ring/20 has-[[data-dragging]]:border-ring">
        <Textarea
          ref={field}
          id="reply-body"
          name="body"
          rows={3}
          maxLength={10000}
          placeholder="Escreva sua resposta…"
          defaultValue={draft}
          className="max-h-80 min-h-20 resize-none rounded-none border-0 bg-transparent px-4 pt-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
              event.currentTarget.form?.requestSubmit();
          }}
        />
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3 pt-1 pb-3">
          <AttachmentField variant="compact" className="min-w-0 flex-1 basis-48" />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {suggest && <SuggestReply ticketId={ticketId} field={field} />}
            <SubmitButton pendingLabel="Enviando…">
              <SendIcon />
              Enviar resposta
            </SubmitButton>
          </div>
        </div>
      </div>
      <FormError />
    </ServerForm>
  );
}

function ClosedNotice({
  ticket,
  admin,
  onReopen,
}: {
  ticket: TicketDetailData["ticket"];
  admin: boolean;
  onReopen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
      <span className="flex items-center gap-2">
        <LockIcon className="size-4" />
        Este chamado foi encerrado.
      </span>
      {admin ? (
        <Button size="sm" variant="outline" onClick={onReopen}>
          <RotateCcwIcon />
          Reabrir chamado
        </Button>
      ) : (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/chamados/novo?companyId=${ticket.companyId}`}>
            Abrir novo chamado
          </Link>
        </Button>
      )}
    </div>
  );
}

function Count({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground">
      {children}
    </span>
  );
}

/** What the team needs from the client to go on, in their words. The paused deadline reads in Prazos. */
function WaitingNotice({ waitingFor, admin }: { waitingFor?: string | null; admin: boolean }) {
  return (
    <div className="flex gap-3 rounded-xl border border-warning-edge bg-warning-soft px-4 py-3 text-sm">
      <HourglassIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="min-w-0 space-y-1">
        <p className="m-0 font-medium text-foreground">
          {admin ? "Aguardando o cliente" : "A equipe precisa de você para continuar"}
        </p>
        {waitingFor && <p className="m-0 whitespace-pre-wrap text-foreground">{waitingFor}</p>}
      </div>
    </div>
  );
}

/** Status, with "what is missing" asked for as soon as the ticket is set to wait for the client. */
function StatusField({ ticket }: { ticket: TicketDetailData["ticket"] }) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  return (
    <>
      <FormField label="Situação" htmlFor="ticket-status">
        <NativeSelect id="ticket-status" name="status" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
          {STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {ticketLabels[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>
      {status === "waiting_customer" && (
        <FormField label="O que falta" htmlFor="ticket-waiting" hint="O cliente lê este texto no chamado e no e-mail.">
          <Textarea
            id="ticket-waiting"
            name="waitingFor"
            required
            maxLength={500}
            rows={3}
            defaultValue={ticket.waitingFor ?? ""}
            placeholder="Ex.: o acesso ao painel da hospedagem e um print do erro."
          />
        </FormField>
      )}
    </>
  );
}

/** First response and goal under the company's conditions; the team also sees lateness. */
function ClockCard({ clock, status, admin, now }: { clock: TicketClock; status: TicketStatus; admin: boolean; now: string }) {
  const done = status === "resolved" || status === "closed";
  const late = (iso: string | null) => admin && !!iso && new Date(iso) < new Date(now);
  return (
    <Card variant="quiet">
      <CardHeader>
        <SectionTitle title="Prazos" description={clock.label} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-4">
          <Fact label="Primeira resposta">
            {clock.firstResponseAt ? (
              <>
                Respondido em {clock.respondedIn}
                <span className="block text-xs text-muted-foreground">{dateTimeLabel(clock.firstResponseAt)}</span>
              </>
            ) : clock.responseDueAt ? (
              <span className="flex flex-wrap items-center gap-2">
                Até {dueLabel(clock.responseDueAt, now)}
                {late(clock.responseDueAt) && !clock.pausedSince && <LateMark />}
              </span>
            ) : (
              "Sem prazo"
            )}
          </Fact>
          {clock.resolutionDueAt && !done && (
            <Fact label="Meta de solução">
              <span className="flex flex-wrap items-center gap-2">
                Até {dueLabel(clock.resolutionDueAt, now)}
                {late(clock.resolutionDueAt) && !clock.pausedSince && <LateMark />}
              </span>
            </Fact>
          )}
        </dl>
        {/* The status already says who it waits for; this says what that does to the deadline. */}
        {clock.pausedSince && (
          <p className="m-0 flex items-start gap-2 text-xs text-muted-foreground">
            <ClockIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Prazo pausado desde {dateTimeLabel(clock.pausedSince)}.
          </p>
        )}
        {clock.clientFrom && (
          <p className="m-0 text-xs text-muted-foreground">O cliente vê estes prazos a partir de {dateLabel(new Date(clock.clientFrom))}.</p>
        )}
        <Link href="/como-trabalhamos#tempo" className="text-xs font-medium text-primary hover:underline">
          Como contamos o tempo
        </Link>
      </CardContent>
    </Card>
  );
}

function LateMark() {
  return <span className="rounded-md bg-destructive-soft px-1.5 py-px text-[11px] font-medium text-destructive">Atrasado</span>;
}

export function TicketDetail({ data }: { data: TicketDetailData }) {
  const { ticket, entries, files, viewer, now } = data;
  const admin = viewer.admin;
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { move, form: moveForm } = useTicketMove(ticket.id);
  const messages = entries.filter((e) => e.kind === "message").length;
  const deletable = admin && canDeleteTicket(ticket.status);
  const assignee = assigneeOptions(data.assignees ?? [], ticket.assignedTo);
  const showCompany = viewer.showCompany ?? admin;
  // Who opened it: the e-mail only when it is one (a client reads "Equipe Anuntech" for the team).
  const authorEmail = ticket.author.email.includes("@") ? ticket.author.email : null;

  return (
    <>
      {/* Header: the status, an Alta or Crítica priority and, for the team, the company. The body tells what it is about. */}
      <PageHeader
        crumbs={[{ label: "Chamados", href: "/chamados" }]}
        title={ticket.subject}
        meta={[
          <TicketStatusBadge key="status" status={ticket.status} client={!admin} />,
          (ticket.priority === "high" || ticket.priority === "critical") && (
            <TicketPriorityMark key="priority" priority={ticket.priority} label="Prioridade" />
          ),
          showCompany &&
            (admin ? (
              <Link key="company" href={`/empresas/${ticket.companyId}`} className="text-foreground hover:text-primary">
                {ticket.company}
              </Link>
            ) : (
              <span key="company">{ticket.company}</span>
            )),
        ]}
        actionsInline
        actions={
          admin && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {/* The company is a link under the title; the menu keeps what has no other place. */}
                <DropdownMenuItem asChild>
                  <Link href={`/chamados/novo?companyId=${ticket.companyId}`}>
                    <HeadsetIcon />
                    Novo chamado para esta empresa
                  </Link>
                </DropdownMenuItem>
                {(ticket.kind === "change" || ticket.kind === "new_project") && (
                  <DropdownMenuItem asChild>
                    <Link href={`/orcamentos/novo?companyId=${ticket.companyId}&chamado=${ticket.id}`}>
                      <CalculatorIcon />
                      Criar orçamento deste pedido
                    </Link>
                  </DropdownMenuItem>
                )}
                {ticket.kind === "new_project" && (
                  <DropdownMenuItem asChild>
                    <Link href={data.journeyId ? `/jornadas/${data.journeyId}` : `/jornadas/nova?chamado=${ticket.id}`}>
                      <RouteIcon />
                      {data.journeyId ? "Ver jornada do projeto" : "Começar jornada do projeto"}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {ticket.status === "closed" ? (
                  <DropdownMenuItem onSelect={() => move("open")}>
                    <RotateCcwIcon />
                    Reabrir chamado
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setTimeout(() => setClosing(true), 0)}
                  >
                    <LockIcon />
                    Encerrar chamado
                  </DropdownMenuItem>
                )}
                {deletable && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setTimeout(() => setDeleting(true), 0)}
                    >
                      <Trash2Icon />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      {admin && data.triage && (
        <div className="reveal-fade mb-6">
          <TicketTriageNotice ticketId={ticket.id} triage={data.triage} />
        </div>
      )}

      {/* items-start: the conversation ends at the composer instead of stretching to the side column. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <Card className="reveal-fade min-w-0">
          <CardHeader>
            <SectionTitle
              title={
                <span className="flex items-center gap-2">
                  Conversa
                  <Count>
                    <AnimatedValue value={messages} />
                  </Count>
                </span>
              }
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <TicketThread entries={entries} now={now} admin={admin} closed={ticket.status === "closed"} />
            {/* The latest word in the conversation: what the team still needs, right above the reply. */}
            {ticket.status === "waiting_customer" && (
              <WaitingNotice waitingFor={ticket.waitingFor} admin={admin} />
            )}
            {ticket.status === "closed" ? (
              <ClosedNotice
                ticket={ticket}
                admin={admin}
                onReopen={() => move("open")}
              />
            ) : (
              <Composer ticketId={ticket.id} draft={data.replyDraft} suggest={admin} />
            )}
          </CardContent>
        </Card>

        <aside className="reveal-fade flex min-w-0 flex-col gap-6">
          <Card variant="quiet">
            <CardHeader>
              <SectionTitle title="Detalhes" />
            </CardHeader>
            <CardContent>
              {admin && (
                <>
                  <ServerForm
                    key={`${ticket.status}-${ticket.priority}-${ticket.assignedTo ?? ""}-${ticket.waitingFor ?? ""}`}
                    action={updateTicket}
                    className="flex flex-col gap-5"
                  >
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <FormError />
                    <StatusField ticket={ticket} />
                    <FormField label="Prioridade" htmlFor="ticket-priority">
                      <NativeSelect
                        id="ticket-priority"
                        name="priority"
                        defaultValue={ticket.priority}
                      >
                        <NativeSelectOption value="normal">
                          {priorityLabels.normal}
                        </NativeSelectOption>
                        <NativeSelectOption value="high">
                          {priorityLabels.high}
                        </NativeSelectOption>
                        <NativeSelectOption value="critical">
                          {priorityLabels.critical}
                        </NativeSelectOption>
                      </NativeSelect>
                    </FormField>
                    <FormField label="Responsável" htmlFor="ticket-assignee">
                      <NativeSelect
                        id="ticket-assignee"
                        name="assignedTo"
                        defaultValue={assignee.selected}
                      >
                        <NativeSelectOption value="">
                          Sem responsável
                        </NativeSelectOption>
                        {assignee.options.map((person) => (
                          <NativeSelectOption key={person.email} value={person.email}>
                            {person.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </FormField>
                    <div className="flex justify-end">
                      <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
                    </div>
                  </ServerForm>
                  <Separator className="my-5" />
                </>
              )}
              {/* What the ticket is about. Status and priority are in the header; an unassigned ticket says nothing here. */}
              <dl className="grid gap-4">
                {!admin && <Fact label="Responsável">{ticket.assigneeName || ticket.assignedTo}</Fact>}
                {ticket.kind && (
                  <Fact label="Tipo">
                    {ticketKindLabels[ticket.kind]}
                    {ticket.impact && (
                      <span className="block text-xs text-muted-foreground">{ticketImpactLabels[ticket.impact]}</span>
                    )}
                  </Fact>
                )}
                <Fact label="Produto ou projeto">{ticket.engagement}</Fact>
                {admin && ticket.channel && ticket.channel !== "console" && (
                  <Fact label="Recebido por">{ticketChannelLabels[ticket.channel]}</Fact>
                )}
                <Fact label="Aberto por">{ticket.author.name}</Fact>
              </dl>
              <Disclosure className="mt-4">
                <dl className="grid gap-4">
                  <Fact label="E-mail de quem abriu">
                    {authorEmail && <span className="block truncate">{authorEmail}</span>}
                  </Fact>
                  <Fact label="Aberto em">{dateTimeLabel(ticket.createdAt)}</Fact>
                  <Fact label="Última atividade">
                    <When at={ticket.updatedAt} now={now} />
                  </Fact>
                </dl>
              </Disclosure>
            </CardContent>
          </Card>

          {data.clock && <ClockCard clock={data.clock} status={ticket.status} admin={admin} now={now} />}
          {data.hours && (admin ? <TicketHoursCard ticketId={ticket.id} data={data.hours} /> : <EstimateCard ticketId={ticket.id} data={data.hours} />)}
          {admin && data.followUp && <TicketFollowCard ticketId={ticket.id} followUp={data.followUp} />}

          {/* Every file of the conversation in one list; with none, the composer's Anexar is enough. */}
          {files.length > 0 && (
            <Card variant="quiet">
              <CardHeader>
                <SectionTitle
                  title={
                    <span className="flex items-center gap-2">
                      Anexos
                      <Count>{files.length}</Count>
                    </span>
                  }
                />
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {files.map((file) => (
                    <li key={file.id}>
                      <FileRow file={file} href={`/api/anexos/${file.id}`} detail={dateLabel(new Date(file.createdAt))} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {admin && moveForm}
      {admin && (
        <CloseTicketDialog
          ticketId={ticket.id}
          open={closing}
          onOpenChange={setClosing}
        />
      )}
      {deletable && (
        <DeleteTicketDialog
          ticketId={ticket.id}
          subject={ticket.subject}
          open={deleting}
          onOpenChange={setDeleting}
          counts={{ messages, files: files.length }}
        />
      )}
    </>
  );
}
