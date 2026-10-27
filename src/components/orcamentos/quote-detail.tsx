"use client";
import Link from "next/link";
import { useState } from "react";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CopyPlusIcon,
  DownloadIcon,
  FoldersIcon,
  MoreHorizontalIcon,
  SendIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
  MailIcon,
  PencilIcon,
  XCircleIcon,
  RouteIcon,
  ReceiptTextIcon,
} from "lucide-react";
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
import { Disclosure } from "@/components/console/disclosure";
import { companyDisplayName } from "@/lib/companies/display-name";
import { FormField } from "@/components/console/form-field";
import { CopyButton } from "@/components/console/copy-button";
import { DownloadLink } from "@/components/console/download-link";
import { ConfirmDialog, FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { answerQuote, cancelQuote, duplicateQuote, resendQuote, revertQuote, sendQuote } from "@/lib/quotes/quote-actions";
import { deleteQuote } from "@/lib/quotes/quote-deletion";
import { canDeleteQuote, quoteDecisionNotice } from "@/lib/deletion-rules";
import { auditLabels, currency, dateLabel, dateTimeLabel, relativeLabel } from "@/lib/format";
import { quoteExpired, quoteTotals, type QuoteContent, type QuoteStatus } from "@/lib/quotes/quote-model";
import { QuoteStatusBadge, validityText } from "./quote-badges";
import { QuoteDocument } from "./quote-document";
import { QuoteEditor } from "./quote-editor";
import { QuoteHandoffCard, type QuoteHandoff } from "./quote-handoff-card";
import { InviteManagerField } from "@/components/console/invite-manager-field";
import { HelpLink } from "@/components/console/help-link";

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
  /** `companies`: how many companies a client sees; with one, the page does not name it back. */
  viewer: { admin: boolean; party: "anuntech" | "client" | null; name: string; companies?: number };
  events: { id: string; action: string; createdAt: string }[];
  /** Staff: what the proposal already became and the request it answers. */
  handoff?: QuoteHandoff;
  /** Staff, before sending: the company has no Administrador yet, and who to suggest. */
  invite?: { suggestion: string } | null;
  /** Staff: the project journey this proposal belongs to, if any. */
  journey?: { id: string } | null;
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
        <ServerForm
          key={open ? "open" : "closed"}
          action={answerQuote}
          onSuccess={() => onOpenChange(false)}
          className="flex flex-col gap-5"
          // The answer is the client's own: the assistant leaves it alone.
          data-assistant-ignore=""
        >
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
  const [deleting, setDeleting] = useState(false);
  // "Editar" on an answered or cancelled proposal: the original stays, a copy opens for editing.
  const [editCopy, setEditCopy] = useState(false);
  const [resending, setResending] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [recording, setRecording] = useState<"accept" | "decline" | null>(null);
  const [consent, setConsent] = useState(false);
  const expired = quoteExpired(q.status, q.validUntil, today);
  const waiting = q.status === "sent" && !expired;
  const editable = viewer.admin && q.status === "draft";
  const answered = q.status === "accepted" || q.status === "declined" || q.status === "cancelled";
  // Like a contract before signature: the same proposal gets a new version, unless something was already made from it.
  const handoff = data.handoff;
  const madeFrom = !!(handoff && (handoff.contract || handoff.project || handoff.upfrontInvoiceId || handoff.balanceInvoiceId));
  const newVersion = q.status === "sent" || q.status === "declined" || (q.status === "accepted" && !madeFrom);
  const deletable = viewer.admin && canDeleteQuote(q.status, { validUntil: q.validUntil, today });
  const decisionNotice = quoteDecisionNotice(q.status);
  const canAnswer = waiting && viewer.party === "client";
  const totals = quoteTotals(q.content);
  const charge =
    totals.upfrontCents > 0 && !handoff?.upfrontInvoiceId
      ? { label: "Cobrar entrada", href: `/financeiro/nova?orcamento=${q.id}&parte=entrada` }
      : totals.balanceCents > 0 && !handoff?.balanceInvoiceId
        ? { label: "Cobrar saldo", href: `/financeiro/nova?orcamento=${q.id}&parte=saldo` }
        : null;
  const validity = validityText(q.status, q.validUntil, today);
  const pdfHref = `/api/orcamentos/${q.id}/pdf`;
  const menu = (open: () => void) => () => setTimeout(open, 0);
  // The name people read; the proposal keeps the razão social and CNPJ.
  const companyName = companyDisplayName(q.company, q.companyDocument);
  const nameCompany = viewer.admin || (viewer.companies ?? 1) > 1;
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Orçamentos", href: "/orcamentos" }]}
        title={q.title}
        // The proposal below carries the number and the total; the editor (draft) does not.
        meta={[
          <QuoteStatusBadge key="status" status={q.status} validUntil={q.validUntil} today={today} />,
          viewer.admin ? (
            <Link key="company" href={`/empresas/${q.companyId}`} className="text-foreground hover:text-primary">
              {companyName}
            </Link>
          ) : (
            nameCompany && <span key="company">{companyName}</span>
          ),
          editable && (
            <span key="number" className="tabular-nums">
              nº {q.number}
            </span>
          ),
        ]}
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
            {viewer.admin && (q.status === "sent" || answered) && (
              <Button variant="outline" onClick={() => (newVersion ? setReverting(true) : setEditCopy(true))}>
                <PencilIcon />
                Editar
              </Button>
            )}
            {viewer.admin && q.status === "draft" && (
              <Button onClick={() => setSending(true)}>
                <SendIcon />
                Enviar ao cliente
              </Button>
            )}
            {viewer.admin && q.status === "accepted" && charge && (
              // The next charge of the proposal, prepared as a draft in Financeiro: the entrada, then the saldo.
              <Button variant="outline" asChild>
                <Link href={charge.href}>
                  <ReceiptTextIcon />
                  {charge.label}
                </Link>
              </Button>
            )}
            {viewer.admin && q.status === "accepted" && (
              <Button asChild>
                <Link href={`/contratos/novo?orcamento=${q.id}`}>
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
                  {q.status !== "cancelled" && (
                    <DropdownMenuItem asChild>
                      <Link href={data.journey ? `/jornadas/${data.journey.id}` : `/jornadas/nova?orcamento=${q.id}`}>
                        <RouteIcon />
                        {data.journey ? "Ver jornada do projeto" : "Começar jornada do projeto"}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {!answered && (
                    <DropdownMenuItem onSelect={menu(() => setDuplicating(true))}>
                      <CopyPlusIcon />
                      Duplicar como novo rascunho
                    </DropdownMenuItem>
                  )}
                  {q.status === "sent" && (
                    <>
                      {!expired && (
                        <DropdownMenuItem onSelect={menu(() => setResending(true))}>
                          <MailIcon />
                          Reenviar e-mail
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={menu(() => setRecording("accept"))}>
                        <ThumbsUpIcon />
                        Registrar aceite
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={menu(() => setRecording("decline"))}>
                        <ThumbsDownIcon />
                        Registrar recusa
                      </DropdownMenuItem>
                    </>
                  )}
                  {(q.status === "draft" || q.status === "sent" || deletable) && <DropdownMenuSeparator />}
                  {(q.status === "draft" || q.status === "sent") && (
                    <DropdownMenuItem variant="destructive" onSelect={menu(() => setCancelling(true))}>
                      <XCircleIcon />
                      Cancelar orçamento
                    </DropdownMenuItem>
                  )}
                  {deletable && (
                    <DropdownMenuItem variant="destructive" onSelect={menu(() => setDeleting(true))}>
                      <Trash2Icon />
                      Excluir
                    </DropdownMenuItem>
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
          <Card className="reveal-fade min-w-0">
            <CardContent className="px-5 py-8 sm:px-10 sm:py-10">
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

          {/* The answer leads the column; the rest are supporting cards (quiet). */}
          <aside className="reveal-fade flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader>
                {/* The badge above says the situation; the card says who answered or what to do. */}
                <SectionTitle title="Resposta" />
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
                        {[
                          q.decision.party === "client"
                            ? nameCompany && `por ${companyName}`
                            : "registrado pela Anuntech a pedido do cliente",
                          q.decidedAt && dateTimeLabel(q.decidedAt),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {q.decision.note && <p className="m-0 mt-2 text-sm text-foreground">“{q.decision.note}”</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <CircleDashedIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <p className="m-0 text-sm text-muted-foreground">
                      {/* While it waits, how long the proposal still holds; the date is in the proposal. */}
                      {waiting && validity && <span className="mb-1 block text-xs font-medium text-warning">{validity}</span>}
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
                              : "Só um Administrador da sua empresa aceita ou recusa orçamentos."}
                    </p>
                  </div>
                )}
                {canAnswer && (
                  <ServerForm action={answerQuote} className="flex flex-col gap-3 border-t pt-5" data-assistant-ignore="">
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="decision" value="accept" />
                    <FormError />
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <Checkbox name="consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} className="mt-0.5" />
                      <span>
                        Li a proposta e aceito o escopo, as condições e o valor de{" "}
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
                    <HelpLink slug="responder-um-orcamento">Como funciona o aceite</HelpLink>
                  </ServerForm>
                )}
                {/* The sent proposal's record and the answer's (who, from where), on demand. */}
                {q.documentHash && (
                  <Disclosure>
                    <dl className="grid gap-4">
                      {q.sentAt && <Fact label="Enviado em">{dateTimeLabel(q.sentAt)}</Fact>}
                      {q.version > 1 && <Fact label="Versão">{q.version}ª</Fact>}
                      {q.decision?.party === "client" && <Fact label="E-mail de quem respondeu">{q.decision.email}</Fact>}
                      {q.decision?.party === "client" && <Fact label="IP">{q.decision.ip}</Fact>}
                      <Fact label="Hash SHA-256">
                        <span className="flex items-start gap-1">
                          <code className="min-w-0 break-all text-xs">{q.documentHash}</code>
                          <CopyButton value={q.documentHash} label="Copiar hash" />
                        </span>
                      </Fact>
                    </dl>
                  </Disclosure>
                )}
              </CardContent>
            </Card>

            {!viewer.admin && q.status === "accepted" && (
              <Card variant="quiet">
                <CardHeader>
                  <SectionTitle title="Próximos passos" />
                </CardHeader>
                <CardContent>
                  <ol className="m-0 flex list-none flex-col gap-3 p-0">
                    {[
                      { title: "Contrato", text: "A Anuntech prepara e envia para assinatura. Você pode pedir alterações em cada cláusula.", href: "/contratos" },
                      totals.upfrontCents > 0 && { title: "Entrada", text: "A cobrança aparece em Financeiro.", href: "/financeiro" },
                      { title: "Acessos", text: "A equipe pede o que precisa por chamado.", href: "/chamados" },
                      {
                        title: "Início",
                        text: `A reunião de início é marcada depois ${totals.upfrontCents > 0 ? "dos três passos" : "do contrato assinado e dos acessos"}. O andamento fica em Projetos.`,
                        href: "/projetos",
                      },
                    ]
                      .filter((step) => !!step)
                      .map((step, i) => (
                      <li key={step.title} className="flex gap-3 text-sm">
                        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-primary tabular-nums">
                          {i + 1}
                        </span>
                        <span className="min-w-0">
                          <Link href={step.href} className="font-medium text-foreground hover:text-primary">
                            {step.title}
                          </Link>
                          <span className="block text-muted-foreground">{step.text}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {viewer.admin && data.handoff && (
              <QuoteHandoffCard
                quote={{ id: q.id, number: q.number, title: q.title, status: q.status, companyId: q.companyId }}
                handoff={data.handoff}
                upfrontCents={totals.upfrontCents}
                balanceCents={totals.balanceCents}
              />
            )}

            {versions.some((v) => !v.current) && (
              <Card variant="quiet">
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
              <Card variant="quiet">
                <CardHeader>
                  <SectionTitle title="Histórico" />
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col gap-3">
                    {events.slice(0, 5).map((event) => (
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
        extra={data.invite ? (formId) => <InviteManagerField formId={formId} suggestion={data.invite!.suggestion} /> : undefined}
        title="Enviar ao cliente?"
        description={
          q.version > 0
            ? `A proposta vira a versão ${q.version + 1}. Os Administradores da empresa recebem um aviso por e-mail, e a versão anterior deixa de valer.`
            : "A proposta é congelada e os Administradores da empresa recebem um aviso por e-mail para ler e responder no Console. Depois disso, o conteúdo não muda mais."
        }
        confirmLabel="Enviar"
      />
      <ConfirmDialog
        open={reverting}
        onOpenChange={setReverting}
        action={revertQuote}
        fields={{ id: q.id }}
        title={q.status === "sent" ? "Editar o orçamento?" : "Gerar uma nova versão?"}
        description={
          q.status === "sent"
            ? "Ele volta para rascunho para você ajustar. O cliente deixa de poder responder até você enviar de novo, e o envio atual fica registrado como versão anterior."
            : `O orçamento volta para rascunho como versão ${q.version + 1}, com o mesmo número. ${
                q.status === "accepted" ? "O aceite" : "A recusa"
              } da versão ${q.version} fica no histórico, com quem respondeu, quando e de onde, e o cliente responde de novo ao próximo envio.`
        }
        confirmLabel={q.status === "sent" ? "Editar" : "Gerar nova versão"}
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
        open={resending}
        onOpenChange={setResending}
        action={resendQuote}
        fields={{ id: q.id }}
        title="Reenviar o aviso por e-mail?"
        description="Os Administradores da empresa recebem de novo o e-mail com o link para ver e responder. A proposta não muda."
        confirmLabel="Reenviar"
      />
      <ConfirmDialog
        open={editCopy}
        onOpenChange={setEditCopy}
        action={duplicateQuote}
        fields={{ id: q.id }}
        title="Editar em uma cópia?"
        description={
          q.status === "cancelled"
            ? "Este orçamento foi cancelado e fica como está. Você edita uma cópia, com número próprio, e envia de novo quando quiser."
            : "Já existe contrato, projeto ou cobrança feitos a partir deste orçamento aceito, então ele fica como está. Você edita uma cópia, com número próprio, e envia de novo."
        }
        confirmLabel="Criar cópia para editar"
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
      {deletable && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          action={deleteQuote}
          fields={{ id: q.id }}
          title="Excluir orçamento?"
          description={`O orçamento nº ${q.number} sai do Console${
            versions.length ? `, com ${versions.length === 1 ? "a versão enviada" : `as ${versions.length} versões enviadas`}` : ""
          }.${decisionNotice ? ` ${decisionNotice}` : ""} Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          destructive
        />
      )}
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
