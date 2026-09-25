"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Building2Icon,
  CheckCircle2Icon,
  CircleDashedIcon,
  CopyPlusIcon,
  DownloadIcon,
  FolderKanbanIcon,
  FoldersIcon,
  MoreHorizontalIcon,
  PackageIcon,
  ReceiptTextIcon,
  SendIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Undo2Icon,
  XCircleIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, SectionTitle } from "@/components/console/page-header";
import { Fact } from "@/components/console/fact";
import { FormField } from "@/components/console/form-field";
import { CopyButton } from "@/components/console/copy-button";
import { DownloadLink } from "@/components/console/download-link";
import { ConfirmDialog, FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { answerQuote, cancelQuote, duplicateQuote, revertQuote, sendQuote } from "@/lib/quote-actions";
import { auditLabels, currency, dateLabel, dateTimeLabel, relativeLabel } from "@/lib/format";
import { quoteExpired, quoteTotals, type QuoteContent, type QuoteStatus } from "@/lib/quote-model";
import { QuoteStatusBadge, validityText } from "./quote-badges";
import { QuoteDocument } from "./quote-document";
import { QuoteEditor } from "./quote-editor";

export type QuoteDetailData = {
  quote: {
    id: string;
    number: string;
    title: string;
    status: QuoteStatus;
    revision: number;
    version: number;
    companyId: string;
    company: string;
    companyDocument: string;
    validUntil: string | null;
    /** The frozen proposal once sent; the draft otherwise. */
    content: QuoteContent;
    documentHash: string | null;
    sentAt: string | null;
    decidedAt: string | null;
    decision: { party: "client" | "anuntech"; name: string; email: string | null; ip: string | null; note: string | null } | null;
    createdAt: string;
    updatedAt: string;
  };
  /** Every send so far, newest first; `current` is the one in force. */
  versions: { version: number; sentAt: string; hash: string; current: boolean }[];
  viewer: { admin: boolean; party: "anuntech" | "client" | null; name: string };
  events: { id: string; action: string; createdAt: string }[];
  now: string;
  today: string;
};

/** A dialog that records an answer with an optional note. */
function AnswerDialog({
  open,
  onOpenChange,
  quoteId,
  decision,
  byStaff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  decision: "accept" | "decline";
  byStaff: boolean;
}) {
  const accepting = decision === "accept";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ServerForm key={open ? "open" : "closed"} action={answerQuote} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={quoteId} />
          <input type="hidden" name="decision" value={decision} />
          {byStaff && accepting && <input type="hidden" name="consent" value="yes" />}
          <DialogHeader>
            <DialogTitle>
              {byStaff ? (accepting ? "Registrar aceite" : "Registrar recusa") : "Recusar orçamento"}
            </DialogTitle>
            <DialogDescription>
              {byStaff
                ? "Para respostas que chegaram por outro canal. O registro dirá que foi feito pela Anuntech a pedido do cliente."
                : "Se quiser, conte o motivo. A Anuntech recebe a resposta e pode ajustar a proposta."}
            </DialogDescription>
          </DialogHeader>
          <FormError />
          <FormField label="Observação" htmlFor={`answer-note-${decision}`}>
            <Textarea id={`answer-note-${decision}`} name="note" rows={3} maxLength={1000} placeholder={accepting ? "Ex.: aceito por e-mail em 24/09." : "O que pesou na decisão."} />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <SubmitButton pendingLabel="Registrando…" variant={accepting ? "default" : "destructive"}>
              {byStaff ? (accepting ? "Registrar aceite" : "Registrar recusa") : "Recusar orçamento"}
            </SubmitButton>
          </DialogFooter>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}

export function QuoteDetail({ data }: { data: QuoteDetailData }) {
  const { quote: q, versions, viewer, events, now, today } = data;
  const [sending, setSending] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [recording, setRecording] = useState<"accept" | "decline" | null>(null);
  const [consent, setConsent] = useState(false);
  const expired = quoteExpired(q.status, q.validUntil, today);
  const waiting = q.status === "sent" && !expired;
  const editable = viewer.admin && q.status === "draft";
  const canAnswer = waiting && viewer.party === "client";
  const totals = quoteTotals(q.content);
  const validity = validityText(q.status, q.validUntil, today);
  const pdfHref = `/api/orcamentos/${q.id}/pdf`;
  const menu = (open: () => void) => () => setTimeout(open, 0);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Orçamentos", href: "/orcamentos" }, { label: `nº ${q.number}` }]}
        title={q.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <QuoteStatusBadge status={q.status} validUntil={q.validUntil} today={today} />
            <span className="tabular-nums">nº {q.number}</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            {viewer.admin ? (
              <Link href={`/empresas/${q.companyId}`} className="text-foreground hover:text-primary">
                {q.company}
              </Link>
            ) : (
              <span>{q.company}</span>
            )}
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="tabular-nums">{currency(totals.totalCents)}</span>
          </span>
        }
        actions={
          <>
            {(viewer.admin || q.status !== "draft") && q.status !== "cancelled" && (
              <Button variant="outline" asChild>
                <DownloadLink href={pdfHref} filename={`Orçamento ${q.number} — ${q.title}.pdf`}>
                  <DownloadIcon />
                  Baixar PDF
                </DownloadLink>
              </Button>
            )}
            {viewer.admin && q.status === "draft" && (
              <Button onClick={() => setSending(true)}>
                <SendIcon />
                Enviar ao cliente
              </Button>
            )}
            {viewer.admin && q.status === "accepted" && (
              <Button asChild>
                <Link href={`/contratos/novo?companyId=${q.companyId}`}>
                  <FoldersIcon />
                  Criar contrato
                </Link>
              </Button>
            )}
            {viewer.admin && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Mais ações">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem asChild>
                    <Link href={`/empresas/${q.companyId}`}>
                      <Building2Icon />
                      Ver empresa
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={menu(() => setDuplicating(true))}>
                    <CopyPlusIcon />
                    Duplicar como novo rascunho
                  </DropdownMenuItem>
                  {q.status === "sent" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={menu(() => setRecording("accept"))}>
                        <ThumbsUpIcon />
                        Registrar aceite
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={menu(() => setRecording("decline"))}>
                        <ThumbsDownIcon />
                        Registrar recusa
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={menu(() => setReverting(true))}>
                        <Undo2Icon />
                        Voltar para rascunho
                      </DropdownMenuItem>
                    </>
                  )}
                  {(q.status === "draft" || q.status === "sent") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={menu(() => setCancelling(true))}>
                        <XCircleIcon />
                        Cancelar orçamento
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {editable ? (
        <QuoteEditor
          key={q.revision}
          quote={{ id: q.id, revision: q.revision, title: q.title, validUntil: q.validUntil, content: q.content }}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <Card className="min-w-0">
            <CardContent className="px-6 py-8 sm:px-10 sm:py-10">
              <QuoteDocument
                data={{
                  ...q.content,
                  title: q.title,
                  number: q.number,
                  companyName: q.company,
                  companyDocument: q.companyDocument,
                  validUntil: q.validUntil,
                  date: q.sentAt ?? q.updatedAt,
                }}
              />
            </CardContent>
          </Card>

          <aside className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Resposta"
                  description={
                    q.status === "accepted"
                      ? "Proposta aceita."
                      : q.status === "declined"
                        ? "Proposta recusada."
                        : q.status === "cancelled"
                          ? "Cancelada pela Anuntech."
                          : expired
                            ? "A validade passou sem resposta."
                            : canAnswer
                              ? "Responda com o seu acesso ao Console."
                              : "Aguardando o cliente."
                  }
                />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {q.decision ? (
                  <div className="flex items-start gap-3">
                    {q.status === "accepted" ? (
                      <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" />
                    ) : (
                      <XCircleIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0 text-sm">
                      <p className="m-0 font-medium text-foreground">
                        {q.status === "accepted" ? "Aceito" : "Recusado"} por {q.decision.name}
                      </p>
                      <p className="m-0 text-xs text-muted-foreground">
                        {q.decision.party === "client" ? `por ${q.company}` : "registrado pela Anuntech a pedido do cliente"}
                        {q.decidedAt && ` · ${dateTimeLabel(q.decidedAt)}`}
                      </p>
                      {q.decision.email && q.decision.party === "client" && (
                        <p className="m-0 text-xs text-muted-foreground">{q.decision.email}{q.decision.ip ? ` · IP ${q.decision.ip}` : ""}</p>
                      )}
                      {q.decision.note && <p className="m-0 mt-2 text-sm text-foreground">“{q.decision.note}”</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <CircleDashedIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <p className="m-0 text-sm text-muted-foreground">
                      {q.status === "cancelled"
                        ? "Este orçamento não vale mais."
                        : expired
                          ? viewer.admin
                            ? "Volte para rascunho, ajuste a validade e envie de novo."
                            : "Peça à Anuntech uma nova versão."
                          : canAnswer
                            ? "Aguardando a sua resposta. Leia a proposta e responda abaixo."
                            : viewer.admin
                              ? "Se a resposta vier por outro canal, registre no menu de ações."
                              : "Só gestores da empresa respondem pelo Console."}
                    </p>
                  </div>
                )}
                {canAnswer && (
                  <ServerForm action={answerQuote} className="flex flex-col gap-3 border-t pt-5">
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="decision" value="accept" />
                    <FormError />
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <Checkbox name="consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} className="mt-0.5" />
                      <span>
                        Li a proposta e aceito o escopo, o prazo estimado e o valor de{" "}
                        <span className="font-medium tabular-nums">{currency(totals.totalCents)}</span>, como{" "}
                        <span className="font-medium">{viewer.name}</span> por {q.company}.
                      </span>
                    </label>
                    <SubmitButton disabled={!consent} pendingLabel="Registrando…">
                      <ThumbsUpIcon />
                      Aceitar orçamento
                    </SubmitButton>
                    <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setDeclining(true)}>
                      Recusar
                    </Button>
                    <p className="m-0 text-xs text-muted-foreground">Ficam registrados seu nome, e-mail, data, IP e o hash da proposta.</p>
                  </ServerForm>
                )}
              </CardContent>
            </Card>

            {viewer.admin && q.status === "accepted" && (
              <Card>
                <CardHeader>
                  <SectionTitle title="Próximos passos" description="Nada é criado sozinho. Parta do orçamento aceito." />
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  {[
                    { href: `/contratos/novo?companyId=${q.companyId}`, label: "Criar contrato", icon: FoldersIcon },
                    { href: `/projetos/novo?companyId=${q.companyId}`, label: "Criar projeto", icon: FolderKanbanIcon },
                    { href: `/produtos/novo?companyId=${q.companyId}`, label: "Vincular produto ou serviço", icon: PackageIcon },
                    { href: `/financeiro/nova?companyId=${q.companyId}`, label: "Nova cobrança", icon: ReceiptTextIcon },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      {label}
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <SectionTitle title="Validade" description={q.validUntil ? undefined : "Sem prazo definido."} />
              </CardHeader>
              {q.validUntil && (
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4">
                    <Fact label="Válido até">
                      <span className={cn(expired && "text-destructive")}>{dateLabel(q.validUntil)}</span>
                    </Fact>
                    {(validity || expired) && (
                      <Fact label="Situação">
                        <span className={cn("font-medium", expired ? "text-destructive" : "text-warning")}>{expired ? "Expirado" : validity}</span>
                      </Fact>
                    )}
                  </dl>
                </CardContent>
              )}
            </Card>

            {q.documentHash && (
              <Card>
                <CardHeader>
                  <SectionTitle title="Documento" />
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4">
                    {q.sentAt && <Fact label="Enviado em">{dateTimeLabel(q.sentAt)}</Fact>}
                    {q.decidedAt && <Fact label="Respondido em">{dateTimeLabel(q.decidedAt)}</Fact>}
                    {q.version > 1 && <Fact label="Versão">{q.version}ª</Fact>}
                    <Fact label="Hash SHA-256">
                      <span className="flex items-start gap-1">
                        <code className="min-w-0 break-all text-xs">{q.documentHash}</code>
                        <CopyButton value={q.documentHash} label="Copiar hash" />
                      </span>
                    </Fact>
                  </dl>
                </CardContent>
              </Card>
            )}

            {versions.some((v) => !v.current) && (
              <Card>
                <CardHeader>
                  <SectionTitle title="Versões" description="Cada envio congela uma proposta. As anteriores ficam para consulta, sem efeito." />
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col gap-3">
                    {versions.map((v) => (
                      <li key={v.version} className="flex items-start justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="m-0 font-medium text-foreground">
                            Versão {v.version}
                            {v.current && <span className="ml-2 text-xs font-normal text-success">atual</span>}
                          </p>
                          <p className="m-0 text-xs text-muted-foreground">Enviada em {dateLabel(new Date(v.sentAt))}</p>
                        </div>
                        <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" asChild>
                          <DownloadLink
                            href={v.current ? pdfHref : `${pdfHref}?versao=${v.version}`}
                            filename={`Orçamento ${q.number} v${v.version}.pdf`}
                            aria-label={`Baixar versão ${v.version}`}
                          >
                            <DownloadIcon />
                          </DownloadLink>
                        </Button>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {events.length > 0 && (
              <Card>
                <CardHeader>
                  <SectionTitle title="Histórico" />
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col gap-3">
                    {events.map((event) => (
                      <li key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-foreground">{auditLabels[event.action] ?? event.action}</span>
                        <time dateTime={event.createdAt} title={dateTimeLabel(event.createdAt)} className="shrink-0 text-xs text-muted-foreground">
                          {relativeLabel(event.createdAt, now)}
                        </time>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={sending}
        onOpenChange={setSending}
        action={sendQuote}
        fields={{ id: q.id }}
        title="Enviar ao cliente?"
        description={
          q.version > 0
            ? `A proposta vira a versão ${q.version + 1}. Os gestores da empresa recebem um aviso por e-mail, e a versão anterior deixa de valer.`
            : "A proposta é congelada e os gestores da empresa recebem um aviso por e-mail para ler e responder no Console. Depois disso, o conteúdo não muda mais."
        }
        confirmLabel="Enviar"
      />
      <ConfirmDialog
        open={reverting}
        onOpenChange={setReverting}
        action={revertQuote}
        fields={{ id: q.id }}
        title="Voltar para rascunho?"
        description="Você volta a editar a proposta. O envio atual fica registrado como versão anterior e o cliente deixa de poder responder até o novo envio."
        confirmLabel="Voltar para rascunho"
      />
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        action={cancelQuote}
        fields={{ id: q.id }}
        title="Cancelar orçamento?"
        description="Ele deixa de aparecer para o cliente. O número não é reaproveitado."
        confirmLabel="Cancelar orçamento"
        destructive
      />
      <ConfirmDialog
        open={duplicating}
        onOpenChange={setDuplicating}
        action={duplicateQuote}
        fields={{ id: q.id }}
        title="Duplicar como novo rascunho?"
        description="Um novo orçamento, com número próprio, nasce com as mesmas fases, tarefas e valores para você ajustar."
        confirmLabel="Duplicar"
      />
      <AnswerDialog open={declining} onOpenChange={setDeclining} quoteId={q.id} decision="decline" byStaff={false} />
      <AnswerDialog
        open={recording !== null}
        onOpenChange={(open) => !open && setRecording(null)}
        quoteId={q.id}
        decision={recording ?? "accept"}
        byStaff
      />
    </>
  );
}
