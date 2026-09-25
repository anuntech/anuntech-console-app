"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Building2Icon,
  HeadsetIcon,
  LockIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  RotateCcwIcon,
  SendIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, SectionTitle } from "@/components/console/page-header";
import { Fact } from "@/components/console/fact";
import { PersonAvatar } from "@/components/console/person-avatar";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { toast } from "@/components/notifications";
import { replyTicket, updateTicket } from "@/lib/actions";
import {
  dateLabel,
  dateTimeLabel,
  priorityLabels,
  relativeLabel,
  ticketLabels,
} from "@/lib/format";
import type { TicketPriority, TicketStatus } from "@/lib/ticket-table";
import { AttachmentField } from "@/components/console/attachment-field";
import { FileChip, FileRow } from "@/components/console/file-chip";
import { CloseTicketDialog, useTicketMove } from "./ticket-actions";
import { TicketPriorityMark, TicketStatusBadge } from "./ticket-badges";
import { useTicketUploads } from "./ticket-uploads";

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
export type TicketDetailData = {
  ticket: {
    id: string;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    assignedTo: string | null;
    createdAt: string;
    updatedAt: string;
    companyId: string;
    company: string;
    engagement: string | null;
    author: { name: string; email: string };
  };
  /** Messages and attachments in the order they happened. */
  entries: TicketEntry[];
  files: TicketFile[];
  viewer: { admin: boolean };
  now: string;
};

const STATUSES: TicketStatus[] = [
  "open",
  "in_progress",
  "waiting_customer",
  "resolved",
  "closed",
];


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

function Composer({ ticketId }: { ticketId: string }) {
  const uploads = useTicketUploads();
  return (
    <ServerForm
      action={replyTicket}
      prepare={uploads}
      reset
      className="flex flex-col gap-3 border-t pt-5"
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
      <Textarea
        id="reply-body"
        name="body"
        rows={4}
        maxLength={10000}
        placeholder="Escreva sua resposta…"
        className="min-h-24"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
            event.currentTarget.form?.requestSubmit();
        }}
      />
      <FormError />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AttachmentField variant="compact" className="flex-1" />
        <SubmitButton pendingLabel="Enviando…">
          <SendIcon />
          Enviar resposta
        </SubmitButton>
      </div>
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

export function TicketDetail({ data }: { data: TicketDetailData }) {
  const { ticket, entries, files, viewer, now } = data;
  const admin = viewer.admin;
  const [closing, setClosing] = useState(false);
  const { move, form: moveForm } = useTicketMove(ticket.id);
  const messages = entries.filter((e) => e.kind === "message").length;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Chamados", href: "/chamados" }, { label: ticket.subject }]}
        title={ticket.subject}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <TicketStatusBadge status={ticket.status} />
            {ticket.priority === "high" && (
              <TicketPriorityMark priority={ticket.priority} />
            )}
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            {admin ? (
              <Link
                href={`/empresas/${ticket.companyId}`}
                className="text-foreground hover:text-primary"
              >
                {ticket.company}
              </Link>
            ) : (
              <span>{ticket.company}</span>
            )}
            {ticket.engagement && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span>{ticket.engagement}</span>
              </>
            )}
          </span>
        }
        actions={
          admin && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem asChild>
                  <Link href={`/empresas/${ticket.companyId}`}>
                    <Building2Icon />
                    Ver empresa
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/chamados/novo?companyId=${ticket.companyId}`}>
                    <HeadsetIcon />
                    Novo chamado para esta empresa
                  </Link>
                </DropdownMenuItem>
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
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <CardHeader>
            <SectionTitle
              title={
                <span className="flex items-center gap-2">
                  Conversa
                  <Count>{messages}</Count>
                </span>
              }
              description={
                ticket.status === "waiting_customer" && !admin
                  ? "A equipe aguarda sua resposta para continuar."
                  : "Mensagens e arquivos trocados neste chamado."
              }
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ol className="flex flex-col gap-6">
              {entries.map((entry) =>
                entry.kind === "message" ? (
                  <li key={entry.id} className="flex gap-3">
                    <PersonAvatar
                      person={{ id: entry.authorId, name: entry.author, image: entry.authorImage }}
                      size={32}
                      tone={entry.staff ? "staff" : "default"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-foreground">
                          {entry.author}
                        </span>
                        {entry.staff && (
                          <span className="rounded-full bg-accent px-1.5 py-px text-[11px] font-medium text-primary">
                            Equipe
                          </span>
                        )}
                        <When at={entry.createdAt} now={now} />
                      </div>
                      <p className="mt-1 text-sm leading-6 break-words whitespace-pre-wrap text-foreground">
                        {entry.body}
                      </p>
                    </div>
                  </li>
                ) : (
                  <li key={entry.file.id} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                    >
                      <PaperclipIcon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {entry.file.author}
                          </span>{" "}
                          anexou um arquivo
                        </span>
                        <When at={entry.file.createdAt} now={now} />
                      </div>
                      <FileChip file={entry.file} href={`/api/anexos/${entry.file.id}`} className="mt-1.5" />
                    </div>
                  </li>
                ),
              )}
            </ol>
            {ticket.status === "closed" ? (
              <ClosedNotice
                ticket={ticket}
                admin={admin}
                onReopen={() => move("open")}
              />
            ) : (
              <Composer ticketId={ticket.id} />
            )}
          </CardContent>
        </Card>

        <aside className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle
                title="Detalhes"
                description={
                  admin
                    ? "Situação, prioridade e quem atende."
                    : "Onde este chamado está."
                }
              />
            </CardHeader>
            <CardContent>
              {admin ? (
                <ServerForm
                  key={`${ticket.status}-${ticket.priority}-${ticket.assignedTo ?? ""}`}
                  action={updateTicket}
                  className="flex flex-col gap-4"
                >
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <FormError />
                  <div>
                    <Label htmlFor="ticket-status" className="mb-1.5">
                      Situação
                    </Label>
                    <Select name="status" defaultValue={ticket.status}>
                      <SelectTrigger id="ticket-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {ticketLabels[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ticket-priority" className="mb-1.5">
                      Prioridade
                    </Label>
                    <Select name="priority" defaultValue={ticket.priority}>
                      <SelectTrigger id="ticket-priority" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">{priorityLabels.normal}</SelectItem>
                        <SelectItem value="high">{priorityLabels.high}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ticket-assignee" className="mb-1.5">
                      Responsável
                    </Label>
                    <Input
                      id="ticket-assignee"
                      name="assignedTo"
                      type="email"
                      autoComplete="off"
                      defaultValue={ticket.assignedTo ?? ""}
                      placeholder="E-mail de quem atende"
                    />
                  </div>
                  <div className="flex justify-end">
                    <SubmitButton size="sm" pendingLabel="Salvando…">
                      Salvar
                    </SubmitButton>
                  </div>
                </ServerForm>
              ) : (
                <dl className="grid gap-4">
                  <Fact label="Situação">
                    <TicketStatusBadge status={ticket.status} />
                  </Fact>
                  <Fact label="Prioridade">
                    <TicketPriorityMark priority={ticket.priority} />
                  </Fact>
                  <Fact label="Responsável">
                    {ticket.assignedTo || (
                      <span className="text-muted-foreground">
                        Ainda não atribuído
                      </span>
                    )}
                  </Fact>
                </dl>
              )}
              <Separator className="my-5" />
              <dl className="grid gap-4">
                <Fact label="Empresa">
                  {admin ? (
                    <Link
                      href={`/empresas/${ticket.companyId}`}
                      className="hover:text-primary"
                    >
                      {ticket.company}
                    </Link>
                  ) : (
                    ticket.company
                  )}
                </Fact>
                {ticket.engagement && (
                  <Fact label="Produto ou projeto">{ticket.engagement}</Fact>
                )}
                <Fact label="Aberto por">
                  {ticket.author.name}
                  <span className="block truncate text-xs text-muted-foreground">
                    {ticket.author.email}
                  </span>
                </Fact>
                <Fact label="Aberto em">{dateTimeLabel(ticket.createdAt)}</Fact>
                <Fact label="Última atividade">
                  <When at={ticket.updatedAt} now={now} />
                </Fact>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle
                title={
                  <span className="flex items-center gap-2">
                    Anexos
                    <Count>{files.length}</Count>
                  </span>
                }
                description="Arquivos enviados nesta conversa."
              />
            </CardHeader>
            <CardContent>
              {files.length ? (
                <ul className="flex flex-col gap-2">
                  {files.map((file) => (
                    <li key={file.id}>
                      <FileRow file={file} href={`/api/anexos/${file.id}`} detail={dateLabel(new Date(file.createdAt))} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum arquivo ainda.
                  {ticket.status !== "closed" && " Anexe pela caixa de resposta."}
                </p>
              )}
            </CardContent>
          </Card>
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
    </>
  );
}
