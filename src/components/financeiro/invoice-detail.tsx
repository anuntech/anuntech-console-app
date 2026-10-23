"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FocusEvent, type ReactNode } from "react";
import {
  BanIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  Clock3Icon,
  ExternalLinkIcon,
  FileDownIcon,
  Link2Icon,
  Link2OffIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  SendIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CopyButton } from "@/components/console/copy-button";
import { DownloadLink } from "@/components/console/download-link";
import {
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { cancelDraft } from "@/lib/actions";
import { cancelCharge, closeDebt, confirmPaidOutside, issueCharge, locateCharge, markFiscalIssued, syncCharge } from "@/lib/billing/billing-actions";
import {
  changePaymentLink,
  changeSubscription,
  resendBillingNotice,
  resendNoticeAgain,
  sendInvoiceNotice,
} from "@/lib/billing/billing-public-actions";
import {
  daysOverdue,
  noticeChannelLabels,
  noticeKindLabel,
} from "@/lib/billing/billing-notice-rules";
import { bankStatusLabels } from "@/lib/billing/billing-rules";
import { formatDocument, formatPhone } from "@/lib/companies/company-input";
import { companyDisplayName } from "@/lib/companies/display-name";
import { auditLabels, currency, dateLabel, dateTimeLabel } from "@/lib/format";
import type { InvoiceDisplayStatus, InvoiceTableStatus } from "@/lib/billing/invoice-table";
import { BankSync, SyncControl } from "./bank-sync";
import {
  InvoiceStatusBadge,
  NoticeStatusBadge,
  SubscriptionStatusBadge,
} from "./invoice-badges";
import { InvoiceSheet, type InvoiceEditMode } from "./invoice-sheet";
import { hasTerms, lateFeesLabel, type ChargeTerms } from "@/lib/billing/billing-terms";
import { DeleteInvoiceDialog } from "./invoices-table";
import { HelpLink } from "@/components/console/help-link";

export type InvoiceDetailData = {
  invoice: {
    id: string;
    description: string;
    amountCents: number;
    dueDate: string;
    /** The boleto's date when the obligation is already past due. */
    bankDueDate?: string | null;
    status: InvoiceTableStatus;
    display: InvoiceDisplayStatus;
    createdAt: string;
    engagement: string | null;
    providerId: string | null;
    bankStatus: string | null;
    bankCheckedAt: string | null;
    /** An emission was requested from the bank (even if it failed). */
    bankRequested: boolean;
    /** The due date sent to the bank, when the bank later moved it. */
    requestedDueDate: string | null;
    boletoLine: string | null;
    pixCopyPaste: string | null;
    publicUrl: string | null;
    publicEnabled: boolean;
    fiscalStatus: string;
    fiscalUrl: string | null;
    editable: "draft" | "issued" | null;
    /** Staff only: a draft (or cancelled draft) that never reached the Inter. */
    deletable?: boolean;
    bankClosed?: boolean;
    terms: ChargeTerms;
  };
  company: {
    id: string;
    name: string;
    document: string;
    address: string | null;
    autoIssueNfse: boolean;
  };
  subscription: {
    id: string;
    status: string;
    interval: "monthly" | "yearly";
    nextDueDate: string;
    issueDate: string;
    amountCents: number;
    description: string;
    lastError: string | null;
    /** Monthly plans: the next period is issued as soon as this one is paid. Null for yearly. */
    issueOnPayment: boolean | null;
    /** Paying this invoice now would issue the next period right away (lib/billing/recurrence.ts earlyIssueAllowed). */
    earlyReady: boolean;
    /** The next period, when it is already at the bank. */
    ahead: { id: string; dueDate: string; amountCents: number; status: "issued" | "paid" } | null;
    /** Staff, paused past its due date: the due dates that went by and the next one ahead. */
    resume?: { missed: string[]; dropped: number; drafted: string[]; next: string } | null;
    terms: ChargeTerms;
  } | null;
  /** Draft waiting for its automatic emission date. */
  scheduled: boolean;
  /** Inter closed it unpaid: still a debt until it is billed again or written off (staff only). */
  debt:
    | { state: "open" }
    | { state: "rebilled"; invoiceId: string; at: string }
    | { state: "closed"; reason: string; at: string }
    | null;
  scheduledIssueDate: string | null;
  notices: {
    id: string;
    channel: string;
    kind: string;
    status: string;
    error: string | null;
    createdAt: string;
    /** The e-mail or phone it went to; empty when there was no contact. */
    recipient: string;
    /** Failed: requeue it as it was (resendBillingNotice). */
    resendable: boolean;
    /** Delivered: send it again to the same contact (resendNoticeAgain). */
    again: boolean;
  }[];
  contacts: {
    email: string;
    emailEnabled: boolean;
    phone: string;
    whatsappEnabled: boolean;
  } | null;
  canSend: { email: boolean; whatsapp: boolean };
  events: { id: string; action: string; createdAt: string }[];
  /** `companies`: how many companies the viewer sees invoices of; a client with one is not named back to itself. */
  viewer: { admin: boolean; companies?: number };
  /** "once" checks stale data on open; "poll" keeps checking while the bank processes. */
  sync: "poll" | "once" | "off";
  today: string;
  now: string;
};

function selectAll(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  event.currentTarget.select();
}

/** A read-only code (Pix, boleto line) with its own copy button. */
function CodeField({
  label,
  value,
  rows,
  actions,
}: {
  label: string;
  value: string;
  rows?: number;
  /** Other quiet actions beside "Copiar" (the boleto PDF). */
  actions?: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="flex items-center gap-1">
          {actions}
          <CopyButton value={value} label={label} size="xs" variant="ghost">
            Copiar
          </CopyButton>
        </span>
      </div>
      {rows ? (
        <Textarea
          id={id}
          readOnly
          value={value}
          rows={rows}
          onFocus={selectAll}
          className="min-h-0 font-mono text-xs leading-5 break-all"
        />
      ) : (
        <Input
          id={id}
          readOnly
          value={value}
          onFocus={selectAll}
          className="font-mono text-xs tabular-nums"
        />
      )}
    </div>
  );
}

function Notice({
  tone = "default",
  icon,
  children,
}: {
  tone?: "default" | "success" | "warning";
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        tone === "success" && "border-success-edge bg-success-soft text-success",
        tone === "warning" && "border-warning-edge bg-warning-soft text-warning",
        tone === "default" && "bg-secondary/50 text-muted-foreground",
      )}
    >
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
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

/** Whole days from one civil date to another. */
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

/** A charge Inter closed unpaid: bill it again (prefilled) or write it off with a reason. */
/** Staff: Inter shows the charge as marked received by hand; confirm the money came in another way. */
function PaidOutsideCard({ invoiceId }: { invoiceId: string }) {
  return (
    <Card>
      <CardHeader>
        <SectionTitle title="Marcada como recebida no Inter" description="O Inter mostra esta cobrança como recebida fora do boleto e do Pix." />
      </CardHeader>
      <ServerForm data-assistant-ignore="" action={confirmPaidOutside} className="contents">
        <input type="hidden" name="id" value={invoiceId} />
        <CardContent className="flex flex-col gap-3">
          <FormError />
          <p className="m-0 text-sm text-muted-foreground">
            Se o pagamento entrou por outro meio (transferência, dinheiro), confirme aqui. A fatura passa a contar como paga e os lembretes param.
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            Se o dinheiro não entrou, a baixa foi por engano e o boleto não pode mais ser pago. Confira no Internet Banking e, se for o caso, cancele no Inter e crie outra cobrança.
          </p>
          <div>
            <Label htmlFor={`outside-${invoiceId}`} className="mb-1.5">
              Como o pagamento entrou
            </Label>
            <Input id={`outside-${invoiceId}`} name="note" required maxLength={300} placeholder="Ex.: transferência em 05/10" />
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <SubmitButton pendingLabel="Confirmando…">Confirmar recebimento</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}

function DebtCard({ invoiceId, debt, amountCents }: { invoiceId: string; debt: NonNullable<InvoiceDetailData["debt"]>; amountCents: number }) {
  const [closing, setClosing] = useState(false);
  return (
    <Card className={debt.state === "open" ? "border-warning-edge" : undefined}>
      <CardHeader>
        <SectionTitle
          title={debt.state === "open" ? "Expirou no Inter sem pagamento" : debt.state === "rebilled" ? "Cobrada de novo" : "Dívida encerrada"}
          description={
            debt.state === "open"
              ? `O Inter encerrou o boleto e o Pix, mas os ${currency(amountCents)} continuam devidos. Cobre de novo com uma nova data para pagar, ou encerre a dívida dizendo por quê.`
              : debt.state === "rebilled"
                ? `Em ${dateLabel(new Date(debt.at))} esta dívida virou uma nova cobrança.`
                : `Em ${dateLabel(new Date(debt.at))}: ${debt.reason}`
          }
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {debt.state === "open" &&
          (closing ? (
            <ServerForm data-assistant-ignore="" action={closeDebt} onSuccess={() => setClosing(false)} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={invoiceId} />
              <FormError />
              <Label htmlFor="debt-reason">Por que a dívida foi encerrada</Label>
              <Textarea id="debt-reason" name="reason" required minLength={3} maxLength={300} rows={2} placeholder="Ex.: pago por transferência em 10/10; acordo com o cliente" />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setClosing(false)}>
                  Voltar
                </Button>
                <SubmitButton size="sm" pendingLabel="Encerrando…">
                  Encerrar a dívida
                </SubmitButton>
              </div>
            </ServerForm>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href={`/financeiro/nova?de=${invoiceId}`}>Cobrar de novo</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setClosing(true)}>
                Encerrar a dívida
              </Button>
            </div>
          ))}
        {debt.state === "rebilled" && debt.invoiceId && (
          <Button size="sm" variant="outline" className="self-start" asChild>
            <Link href={`/financeiro/${debt.invoiceId}`}>Abrir a nova cobrança</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** "10/08/2026, 10/09/2026 e 10/10/2026". */
function dateList(dates: string[]) {
  const labels = dates.map((due) => dateLabel(due));
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}` : (labels[0] ?? "");
}

export function InvoiceDetail({ data }: { data: InvoiceDetailData }) {
  const {
    invoice,
    company,
    subscription: sub,
    scheduled,
    debt,
    scheduledIssueDate,
    notices,
    contacts,
    canSend,
    events,
    viewer,
    sync,
    today,
    now,
  } = data;
  const admin = viewer.admin;
  const [editing, setEditing] = useState<null | "invoice" | "subscription">(
    null,
  );
  const [confirm, setConfirm] = useState<
    null | "link" | "subscription" | "cancel" | "delete" | "bank"
  >(null);
  const [send, setSend] = useState<null | "email" | "whatsapp">(null);
  const [resend, setResend] = useState<string | null>(null);
  const [again, setAgain] = useState<string | null>(null);
  const router = useRouter();
  // A resend goes out right after the click, in the background: show its result once it settles.
  const refreshSoon = () => setTimeout(() => router.refresh(), 4000);
  const [allEvents, setAllEvents] = useState(false);
  const ask = (which: "link" | "subscription" | "cancel" | "delete" | "bank") =>
    setTimeout(() => setConfirm(which), 0);
  const deletable = admin && !!invoice.deletable;

  const paid = invoice.status === "paid";
  const issued = invoice.status === "issued";
  const settled = issued || paid;
  const processing =
    issued && !!invoice.providerId && !invoice.pixCopyPaste && !invoice.boletoLine;
  const late = invoice.display === "overdue" ? daysOverdue(invoice.dueDate, today) : 0;
  // Recurrence lives in the Recorrência card (team); the client, without it, reads it in the charge.
  const intervalLabel = sub ? (sub.interval === "yearly" ? "Anual" : "Mensal") : null;
  // The name people read; the razão social stays in the payer block, the document data.
  const companyName = companyDisplayName(company.name, company.document);
  const nameCompany = admin || (viewer.companies ?? 1) > 1;
  const showFiscal =
    invoice.fiscalStatus !== "not_requested" || (admin ? settled : paid);
  // The side column only when something goes in it; otherwise the charge takes the width.
  const hasAside = (admin && (settled || !!sub || events.length > 0)) || showFiscal;
  const hasMenu =
    settled || invoice.editable === "draft" || deletable || (issued && !!invoice.providerId);
  const editMode: InvoiceEditMode =
    editing === "subscription"
      ? "subscription"
      : invoice.editable === "draft"
        ? "draft"
        : "issued";
  const editTarget =
    editing === "subscription" && sub
      ? {
          id: sub.id,
          description: sub.description,
          amountCents: sub.amountCents,
          dueDate: sub.nextDueDate,
          bankDueDate: null,
          terms: sub.terms,
          recurring: true,
          issueOnPayment: sub.issueOnPayment ?? undefined,
        }
      : {
          id: invoice.id,
          description: invoice.description,
          amountCents: invoice.amountCents,
          dueDate: invoice.dueDate,
          bankDueDate: invoice.bankDueDate ?? null,
          terms: invoice.terms,
          recurring: !!sub,
        };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Financeiro", href: "/financeiro" }]}
        title={invoice.description}
        meta={[
          <InvoiceStatusBadge key="status" status={invoice.display} />,
          admin ? (
            <Link
              key="company"
              href={`/empresas/${company.id}`}
              className="text-foreground hover:text-primary"
            >
              {companyName}
            </Link>
          ) : (
            nameCompany && <span key="company">{companyName}</span>
          ),
        ]}
        actionsInline
        actions={
          admin && (
            <>
            {hasMenu && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {settled && (
                  <DropdownMenuItem onSelect={() => ask("link")}>
                    {invoice.publicEnabled ? <Link2OffIcon /> : <Link2Icon />}
                    {invoice.publicEnabled
                      ? "Desativar link de pagamento"
                      : "Ativar link de pagamento"}
                  </DropdownMenuItem>
                )}
                {settled && (invoice.editable === "draft" || deletable || (issued && invoice.providerId)) && (
                  <DropdownMenuSeparator />
                )}
                {issued && invoice.providerId && (
                  <DropdownMenuItem variant="destructive" onSelect={() => ask("bank")}>
                    <CircleSlashIcon />
                    Cancelar no Inter
                  </DropdownMenuItem>
                )}
                {invoice.editable === "draft" && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => ask("cancel")}
                  >
                    <BanIcon />
                    Cancelar rascunho
                  </DropdownMenuItem>
                )}
                {deletable && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => ask("delete")}
                  >
                    <Trash2Icon />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            )}
            </>
          )
        }
      />

      {admin && sync !== "off" && <BankSync id={invoice.id} mode={sync} />}

      {/* items-start: the main card ends with its content, not at the sidebar's height. */}
      <div className={cn("grid gap-6 lg:items-start", hasAside ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "max-w-4xl")}>
        <div className="reveal-fade flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle
                title="Cobrança"
                description={
                  // Said only when the title does not already name it ("Synova · outubro").
                  invoice.engagement &&
                  !invoice.description.toLocaleLowerCase("pt-BR").includes(invoice.engagement.toLocaleLowerCase("pt-BR"))
                    ? `Produto ou projeto: ${invoice.engagement}`
                    : undefined
                }
                action={
                  admin &&
                  invoice.editable && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing("invoice")}
                    >
                      <PencilIcon />
                      Editar
                    </Button>
                  )
                }
              />
            </CardHeader>
            <CardContent>
              {/* From sm, a two-column grid whose rows both blocks share (subgrid): the
                  labels sit on one baseline and the figures on another, whatever their sizes. */}
              <div className="flex flex-col gap-4 border-b pb-5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:grid-rows-[auto_auto_auto] sm:gap-x-8 sm:gap-y-0">
                <div className="min-w-0 sm:row-span-3 sm:grid sm:grid-rows-subgrid sm:items-baseline">
                  <p className="text-xs font-medium text-muted-foreground">Valor</p>
                  <p className="mt-1 text-title-lg break-words text-foreground tabular-nums sm:text-display-sm">
                    {currency(invoice.amountCents)}
                  </p>
                </div>
                <div className="sm:row-span-3 sm:grid sm:grid-rows-subgrid sm:items-baseline sm:text-right">
                  <p className="text-xs font-medium text-muted-foreground">
                    Vencimento
                  </p>
                  <p className={cn("mt-1 text-title tabular-nums", late ? "text-destructive" : "text-foreground")}>
                    {dateLabel(invoice.dueDate)}
                  </p>
                  {/* The notes below the date share the grid's third row, as one item. */}
                  <div>
                    {invoice.bankDueDate && invoice.bankDueDate !== invoice.dueDate && (
                      <p className="text-xs text-muted-foreground">
                        Boleto e Pix válidos até {dateLabel(invoice.bankDueDate)}
                      </p>
                    )}
                    {late > 0 && (
                      <p className="text-xs text-destructive">
                        {late === 1 ? "1 dia de atraso" : `${late} dias de atraso`}
                      </p>
                    )}
                    {!admin && invoice.status === "issued" && (
                      <HelpLink slug="pagar-uma-fatura" className="mt-1">
                        Como pagar
                      </HelpLink>
                    )}
                    {scheduled && scheduledIssueDate && !admin && (
                      <p className={cn("text-xs", scheduledIssueDate <= today ? "text-warning" : "text-muted-foreground")}>
                        {scheduledIssueDate <= today
                          ? "Emissão automática em instantes"
                          : `Emissão automática em ${dateLabel(scheduledIssueDate)}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {/* The billing data as the boleto carries it: razão social, CNPJ and, for the team, the address. */}
                <Fact label="Pagador" className={admin ? "sm:col-span-2" : undefined}>
                  {company.name}
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {formatDocument(company.document)}
                  </span>
                  {admin &&
                    (company.address ? (
                      <span className="block text-xs text-muted-foreground">{company.address}</span>
                    ) : (
                      <span className="mt-1 block text-xs">
                        <span className="text-warning">
                          Falta o endereço de cobrança. Sem ele, o Inter não emite a cobrança.
                        </span>{" "}
                        <Link
                          href={`/empresas/${company.id}?editar=1`}
                          className="font-medium text-primary hover:underline"
                        >
                          Cadastrar endereço
                        </Link>
                      </span>
                    ))}
                </Fact>
                {!admin && intervalLabel && <Fact label="Recorrência">{intervalLabel}</Fact>}
                {!admin && sub && sub.status === "active" && settled && (
                  <Fact label="Próxima cobrança">
                    {sub.ahead ? (
                      <>
                        <Link href={`/financeiro/${sub.ahead.id}`} className="font-medium text-foreground hover:text-primary">
                          <span className="tabular-nums">{currency(sub.ahead.amountCents)}</span>, vence {dateLabel(sub.ahead.dueDate)}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {sub.ahead.status === "paid" ? "Já paga." : "Boleto e Pix já disponíveis."}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="tabular-nums">{currency(sub.amountCents)}</span>, vence {dateLabel(sub.nextDueDate)}
                        <span className="block text-xs text-muted-foreground">
                          {sub.earlyReady && !paid
                            ? `Boleto e Pix saem assim que esta for paga, ou até ${dateLabel(sub.issueDate)}.`
                            : `Boleto e Pix chegam até ${dateLabel(sub.issueDate)}.`}
                        </span>
                      </>
                    )}
                  </Fact>
                )}
                {/* Discount and late fees matter only while the charge can still be paid. */}
                {hasTerms(invoice.terms) && !paid && invoice.status !== "cancelled" && (
                  <Fact label="Condições" className="sm:col-span-2">
                    {invoice.terms.discountCents ? (
                      <span className="block">
                        Desconto de {currency(invoice.terms.discountCents)} até o vencimento
                        <span className="text-muted-foreground">
                          {" "}
                          ({currency(invoice.amountCents - invoice.terms.discountCents)} pagando em dia)
                        </span>
                      </span>
                    ) : null}
                    {lateFeesLabel(invoice.terms) && (
                      <span className="block">
                        Após o vencimento: {lateFeesLabel(invoice.terms)}
                      </span>
                    )}
                  </Fact>
                )}
              </dl>
              {/* Record facts, on demand: they do not change what anyone does with the charge. */}
              <Disclosure className="mt-5">
                <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  <Fact label="Criada em">{dateLabel(new Date(invoice.createdAt))}</Fact>
                  {admin && invoice.bankStatus && (
                    <Fact label="Situação no Inter">
                      {bankStatusLabels[invoice.bankStatus] ?? invoice.bankStatus}
                    </Fact>
                  )}
                </dl>
              </Disclosure>
            </CardContent>
          </Card>

          {admin && debt && <DebtCard invoiceId={invoice.id} debt={debt} amountCents={invoice.amountCents} />}
          {admin && invoice.status === "issued" && invoice.bankStatus === "MARCADO_RECEBIDO" && <PaidOutsideCard invoiceId={invoice.id} />}

          {admin && invoice.status === "draft" && !invoice.bankRequested && !scheduled && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Publicar no Inter"
                  description={
                    sub
                      ? sub.interval === "monthly"
                        ? "Ativa a recorrência: cada cobrança sai assim que a anterior é paga, ou 5 dias antes do vencimento, e o aviso vai 5 dias antes."
                        : "Ativa a recorrência: esta e as próximas cobranças são emitidas e avisadas 5 dias antes de cada vencimento."
                      : "Emite boleto e Pix com os dados acima."
                  }
                />
              </CardHeader>
              <ServerForm data-assistant-ignore="" action={issueCharge} className="contents">
                <input type="hidden" name="id" value={invoice.id} />
                <CardContent className="flex flex-col gap-5">
                  <FormError />
                  {/* The payer is in the charge above; here only what blocks publishing. */}
                  {!company.address && (
                    <Notice tone="warning" icon={<TriangleAlertIcon />}>
                      Falta o endereço de cobrança. Sem ele, o Inter não emite a cobrança.{" "}
                      <Link
                        href={`/empresas/${company.id}?editar=1`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        Cadastrar endereço
                      </Link>
                    </Notice>
                  )}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="collection-days" className="mb-1.5">
                        Cancelar no banco após o vencimento
                      </Label>
                      <div className="relative">
                        <Input
                          id="collection-days"
                          name="numDiasAgenda"
                          type="number"
                          min={0}
                          max={60}
                          defaultValue={30}
                          required
                          className="pr-12 tabular-nums"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                          dias
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {sub ? (
                      <label className="flex items-start gap-3 text-sm text-foreground">
                        <Checkbox
                          name="activateRecurring"
                          value="yes"
                          required
                          className="mt-0.5"
                        />
                        <span>
                          {sub.interval === "monthly" && sub.issueOnPayment
                            ? "Ativar a recorrência mensal: cada período é emitido assim que o anterior é pago (ou 5 dias antes do vencimento) e avisado por e-mail e WhatsApp 5 dias antes."
                            : `Ativar a recorrência ${sub.interval === "yearly" ? "anual" : "mensal"}: cada período é emitido e avisado por e-mail e WhatsApp 5 dias antes do vencimento.`}
                        </span>
                      </label>
                    ) : (
                      <label className="flex items-start gap-3 text-sm text-foreground">
                        <Checkbox
                          name="sendNotifications"
                          value="yes"
                          defaultChecked
                          className="mt-0.5"
                        />
                        <span>
                          Avisar o cliente por e-mail e WhatsApp com o link de
                          pagamento assim que boleto e Pix estiverem prontos.
                        </span>
                      </label>
                    )}
                    <label className="flex items-start gap-3 text-sm text-foreground">
                      <Checkbox name="confirm" value="yes" required className="mt-0.5" />
                      <span>Conferi valor, vencimento e pagador.</span>
                    </label>
                  </div>
                </CardContent>
                <CardFooter className="justify-end gap-2 border-t">
                  <SubmitButton pendingLabel="Publicando…">
                    {sub ? "Publicar cobrança recorrente" : "Publicar cobrança no Inter"}
                  </SubmitButton>
                </CardFooter>
              </ServerForm>
            </Card>
          )}

          {admin && scheduled && (
            <Card>
              <CardHeader>
                <SectionTitle title="Emissão agendada" />
              </CardHeader>
              <CardContent>
                <Notice icon={<Loader2Icon />}>
                  {scheduledIssueDate && scheduledIssueDate <= today ? (
                    <>
                      A data de emissão ({dateLabel(scheduledIssueDate)}) já chegou: a rotina automática roda a cada 5
                      minutos e emite na próxima passagem. Os avisos saem logo depois.
                    </>
                  ) : scheduledIssueDate ? (
                    <>
                      O Console emite sozinho em{" "}
                      <span className="font-medium text-foreground">{dateLabel(scheduledIssueDate)}</span>,{" "}
                      {daysBetween(scheduledIssueDate, invoice.dueDate)} dias antes do vencimento. Os avisos saem logo depois.
                    </>
                  ) : (
                    "O Console emite sozinho, e os avisos saem logo depois."
                  )}
                </Notice>
              </CardContent>
            </Card>
          )}

          {admin && invoice.bankRequested && !invoice.providerId && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Emissão sem confirmação"
                  description="O Inter não confirmou a solicitação. Nenhuma outra cobrança será criada até reconciliar."
                />
              </CardHeader>
              <ServerForm data-assistant-ignore="" action={syncCharge} className="contents">
                <input type="hidden" name="id" value={invoice.id} />
                <CardContent className="flex flex-col gap-4">
                  <FormError />
                  <Notice tone="warning" icon={<TriangleAlertIcon />}>
                    Situação registrada:{" "}
                    <span className="font-medium">
                      {bankStatusLabels[invoice.bankStatus ?? ""] ?? invoice.bankStatus}
                    </span>
                    . Localize a solicitação no Inter e informe o código para
                    ligar esta fatura à cobrança do banco.
                  </Notice>
                  <div>
                    <Label htmlFor="provider-id" className="mb-1.5">
                      Código da solicitação no Inter
                    </Label>
                    <Input
                      id="provider-id"
                      name="providerId"
                      required
                      placeholder="00000000-0000-0000-0000-000000000000"
                      className="font-mono text-xs"
                    />
                  </div>
                </CardContent>
                <CardFooter className="justify-end border-t">
                  <SubmitButton pendingLabel="Consultando…">
                    Consultar cobrança no Inter
                  </SubmitButton>
                </CardFooter>
              </ServerForm>
              {invoice.bankStatus === "RESPOSTA_INDEFINIDA" && (
                <ServerForm data-assistant-ignore="" action={locateCharge} className="flex flex-wrap items-center justify-between gap-3 border-t px-6 pt-4">
                  <input type="hidden" name="id" value={invoice.id} />
                  <p className="m-0 min-w-0 flex-1 text-xs text-muted-foreground">
                    Sem o código? O Console procura no Inter a cobrança desta fatura pela referência, nos dias do pedido. A rotina também tenta a cada hora, por 7 dias.
                  </p>
                  <SubmitButton variant="outline" size="sm" pendingLabel="Procurando…">
                    Localizar no Inter
                  </SubmitButton>
                </ServerForm>
              )}
            </Card>
          )}

          {/* An expired charge is told by its debt card; the payment card would say it again. */}
          {(settled || (invoice.status === "cancelled" && invoice.providerId && !(admin && debt))) && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Pagamento"
                  action={
                    admin &&
                    invoice.providerId && (
                      <SyncControl
                        id={invoice.id}
                        checkedAt={invoice.bankCheckedAt}
                        now={now}
                      />
                    )
                  }
                />
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {paid && (
                  <Notice tone="success" icon={<CircleCheckIcon />}>
                    <span className="font-medium">Pagamento confirmado pelo Inter.</span>
                    {/* The team reads the last check beside the title (SyncControl). */}
                    {!admin && invoice.bankCheckedAt && (
                      <span className="block text-xs opacity-80">
                        Última consulta {dateTimeLabel(invoice.bankCheckedAt)}.
                      </span>
                    )}
                  </Notice>
                )}
                {invoice.status === "cancelled" && (
                  <Notice icon={<CircleSlashIcon />}>
                    Esta cobrança foi cancelada no banco e não pode mais ser paga.
                  </Notice>
                )}
                {issued && !processing && !invoice.pixCopyPaste && !invoice.boletoLine && (
                  <Notice icon={<Clock3Icon />}>
                    O Inter ainda não enviou o boleto e o Pix desta cobrança.
                  </Notice>
                )}
                {processing && (
                  <Notice icon={<Loader2Icon className="animate-spin" />}>
                    Boleto e Pix aparecem aqui assim que o Inter concluir a
                    emissão. {/* Only the team's view polls the bank (BankSync). */}
                    {admin ? "Esta página atualiza sozinha." : "Atualize a página em alguns minutos."}
                  </Notice>
                )}
                {issued && invoice.pixCopyPaste && (
                  <CodeField label="Pix copia e cola" value={invoice.pixCopyPaste} rows={3} />
                )}
                {issued && invoice.boletoLine && (
                  <CodeField
                    label="Linha digitável do boleto"
                    value={invoice.boletoLine}
                    actions={
                      <Button variant="ghost" size="xs" asChild>
                        <DownloadLink
                          href={`/api/boletos/${invoice.id}`}
                          filename={`boleto-${invoice.id}.pdf`}
                        >
                          <FileDownIcon />
                          Baixar PDF
                        </DownloadLink>
                      </Button>
                    }
                  />
                )}
                {admin && invoice.requestedDueDate && (
                  <p className="text-xs text-muted-foreground">
                    O Inter moveu o vencimento de {dateLabel(invoice.requestedDueDate)} para{" "}
                    {dateLabel(invoice.dueDate)}.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {admin && contacts && (issued || notices.length > 0) && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title={
                    <span className="flex items-center gap-2">
                      Avisos ao cliente
                      {notices.length > 0 && <Count>{notices.length}</Count>}
                    </span>
                  }
                  description="Com o link de pagamento: nova cobrança, vencimento e 5, 10, 15, 20 e 25 dias de atraso, a partir das 8h. Param com o pagamento."
                />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {contacts.email || contacts.phone ? (
                  <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    <Fact label="E-mail">
                      {contacts.email && (
                        <>
                          {contacts.email}
                          {!contacts.emailEnabled && <span className="text-muted-foreground"> · desativado</span>}
                        </>
                      )}
                    </Fact>
                    <Fact label="WhatsApp">
                      {contacts.phone && (
                        <>
                          {formatPhone(contacts.phone)}
                          {!contacts.whatsappEnabled && <span className="text-muted-foreground"> · desativado</span>}
                        </>
                      )}
                    </Fact>
                  </dl>
                ) : (
                  <Notice tone="warning" icon={<TriangleAlertIcon />}>
                    Ninguém recebe os avisos de cobrança. O cliente escolhe em Notificações.
                  </Notice>
                )}
                {notices.length > 0 && (
                  <ul className="divide-y rounded-lg border">
                    {notices.map((notice) => (
                      <li
                        key={notice.id}
                        className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground [&_svg]:size-3.5">
                          {notice.channel === "email" ? <MailIcon /> : <MessageCircleIcon />}
                        </span>
                        {/* min-w-40: at 320 px the badge drops below instead of squeezing the title to a word per line. */}
                        <span className="min-w-40 flex-1">
                          <span className="block font-medium text-foreground">
                            {noticeChannelLabels[notice.channel] ?? notice.channel} ·{" "}
                            {noticeKindLabel(notice.kind)}
                          </span>
                          <span className="block text-xs break-all text-muted-foreground">
                            {notice.recipient &&
                              `${notice.channel === "whatsapp" ? formatPhone(notice.recipient) : notice.recipient} · `}
                            {dateTimeLabel(notice.createdAt)}
                            {notice.error && ` · ${notice.error}`}
                          </span>
                        </span>
                        <NoticeStatusBadge status={notice.status} />
                        {(notice.resendable || notice.again) && (
                          <Button
                            size="icon-sm"
                            variant="outline"
                            aria-label={`Reenviar ${noticeChannelLabels[notice.channel] ?? notice.channel} · ${noticeKindLabel(notice.kind)}`}
                            title="Reenviar"
                            onClick={() => (notice.resendable ? setResend(notice.id) : setAgain(notice.id))}
                          >
                            <SendIcon />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {(canSend.email || canSend.whatsapp) && (
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <span>Enviar a cobrança</span>
                    {canSend.email && (
                      <Button size="xs" variant="ghost" onClick={() => setSend("email")}>
                        <MailIcon />
                        por e-mail
                      </Button>
                    )}
                    {canSend.whatsapp && (
                      <Button size="xs" variant="ghost" onClick={() => setSend("whatsapp")}>
                        <MessageCircleIcon />
                        por WhatsApp
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Supporting cards recede (quiet), so the charge leads. */}
        {hasAside && (
        <aside className="reveal-fade flex min-w-0 flex-col gap-6">
          {admin && settled && (
            <Card variant="quiet">
              <CardHeader>
                <SectionTitle
                  title="Link de pagamento"
                  description="Sem login: quem tem o endereço vê a fatura e paga."
                />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {invoice.publicUrl ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Input
                        readOnly
                        value={invoice.publicUrl}
                        aria-label="Link de pagamento"
                        onFocus={selectAll}
                        className="text-xs"
                      />
                      <CopyButton
                        value={invoice.publicUrl}
                        label="Link de pagamento"
                        variant="outline"
                        size="icon"
                      />
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={invoice.publicUrl} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon />
                        Abrir página de pagamento
                      </a>
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      O link está desativado: o endereço compartilhado não abre
                      esta fatura.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setConfirm("link")}>
                      <Link2Icon />
                      Ativar link
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {admin && sub && (
            <Card variant="quiet">
              <CardHeader>
                <SectionTitle
                  title={
                    // Active is the normal state: only an exception gets a badge.
                    <span className="flex flex-wrap items-center gap-2">
                      Recorrência {intervalLabel?.toLocaleLowerCase("pt-BR")}
                      {sub.status !== "active" && <SubscriptionStatusBadge status={sub.status} />}
                    </span>
                  }
                  action={
                    sub.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing("subscription")}
                      >
                        <PencilIcon />
                        Editar
                      </Button>
                    )
                  }
                />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="grid gap-4">
                  {sub.ahead && sub.status === "active" && (
                    // Same name the client reads on the charge: the next period, already issued.
                    <Fact label="Próxima cobrança">
                      <Link href={`/financeiro/${sub.ahead.id}`} className="font-medium text-foreground hover:text-primary">
                        <span className="tabular-nums">{currency(sub.ahead.amountCents)}</span>, vence {dateLabel(sub.ahead.dueDate)}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {sub.ahead.status === "paid" ? "Já paga." : "Boleto e Pix já disponíveis."}
                      </span>
                    </Fact>
                  )}
                  <Fact label={sub.ahead && sub.status === "active" ? "Depois dela" : "Próxima cobrança"}>
                    {dateLabel(sub.nextDueDate)}
                    {/* The value per period, only when it is not the value of this charge. */}
                    {sub.amountCents !== invoice.amountCents && (
                      <span className="tabular-nums">, {currency(sub.amountCents)}</span>
                    )}
                  </Fact>
                  {sub.issueOnPayment ? (
                    <>
                      <Fact label="Próxima emissão">
                        Quando a anterior for paga, ou em {dateLabel(sub.issueDate)}
                      </Fact>
                      <Fact label="Aviso ao cliente">{dateLabel(sub.issueDate)}</Fact>
                    </>
                  ) : (
                    <Fact label="Emissão e aviso ao cliente">{dateLabel(sub.issueDate)}</Fact>
                  )}
                </dl>
                {sub.lastError && (
                  <p
                    role="alert"
                    className="rounded-md border border-destructive-edge bg-destructive-soft px-3 py-2 text-xs text-destructive"
                  >
                    {sub.lastError}
                  </p>
                )}
                {["active", "paused"].includes(sub.status) && (
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirm("subscription")}
                    >
                      {sub.status === "active" ? <PauseIcon /> : <PlayIcon />}
                      {sub.status === "active" ? "Pausar recorrência" : "Retomar recorrência"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {showFiscal && (
          <Card variant="quiet">
            <CardHeader>
              <SectionTitle title="Nota fiscal" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">
                {invoice.fiscalStatus === "authorized" ? (
                  <>
                    Nota fiscal emitida.
                    {invoice.fiscalUrl && (
                      <>
                        {" "}
                        <a href={invoice.fiscalUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary">
                          Abrir a nota
                        </a>
                      </>
                    )}
                  </>
                ) : invoice.fiscalStatus === "not_requested" ? (
                  "Emissão ainda não solicitada."
                ) : (
                  "Emissão em andamento com a equipe da Anuntech."
                )}
              </p>
              {admin && invoice.status === "paid" && (invoice.fiscalStatus === "not_requested" || invoice.fiscalStatus === "error") && (
                <ServerForm data-assistant-ignore="" action={markFiscalIssued} className="flex flex-col gap-2 rounded-lg border bg-field/60 px-3 py-3">
                  <input type="hidden" name="id" value={invoice.id} />
                  <FormError />
                  <p className="m-0 text-xs text-muted-foreground">Emitiu a nota por fora? Registre o número ou o link e a fatura sai da lista de notas a emitir.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input name="number" aria-label="Número da nota" maxLength={60} placeholder="Número da nota" />
                    <Input name="url" type="url" aria-label="Link da nota" placeholder="https://… (opcional)" />
                  </div>
                  <SubmitButton size="sm" variant="outline" className="self-start" pendingLabel="Registrando…">
                    Registrar nota emitida
                  </SubmitButton>
                </ServerForm>
              )}
              {admin && (
                <p className="text-xs text-muted-foreground">
                  {company.autoIssueNfse
                    ? "Nota automática ativada para este cliente. A emissão depende da integração fiscal."
                    : "Nota automática desativada para este cliente."}{" "}
                  <Link
                    href={`/empresas/${company.id}?editar=1`}
                    className="font-medium text-primary"
                  >
                    Alterar no cadastro
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
          )}

          {admin && events.length > 0 && (
            <Card variant="quiet">
              <CardHeader>
                <SectionTitle title="Histórico" />
              </CardHeader>
              <CardContent>
                <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
                    {(allEvents ? events : events.slice(0, 5)).map((event) => (
                      <li key={event.id} className="relative text-sm">
                        <span
                          aria-hidden="true"
                          className="absolute top-[7px] -left-[24px] size-2 rounded-full bg-primary/70"
                        />
                        <span className="block text-foreground">
                          {auditLabels[event.action] || "Registro atualizado"}
                        </span>
                        <time
                          dateTime={event.createdAt}
                          className="text-xs text-muted-foreground"
                        >
                          {dateTimeLabel(event.createdAt)}
                        </time>
                      </li>
                    ))}
                  </ol>
                {events.length > 5 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="mt-4 text-muted-foreground"
                    onClick={() => setAllEvents((value) => !value)}
                  >
                    {allEvents ? "Ver menos" : `Ver todos (${events.length})`}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
        )}
      </div>

      {admin && (
        <>
          <InvoiceSheet
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            mode={editMode}
            invoice={editTarget}
          />
          <ConfirmDialog
            open={confirm === "link"}
            onOpenChange={(open) => !open && setConfirm(null)}
            action={changePaymentLink}
            fields={{ id: invoice.id, enabled: invoice.publicEnabled ? "no" : "yes" }}
            title={
              invoice.publicEnabled
                ? "Desativar o link de pagamento?"
                : "Ativar o link de pagamento?"
            }
            description={
              invoice.publicEnabled
                ? "O endereço compartilhado deixa de abrir esta fatura. A cobrança no banco não muda."
                : "Quem tiver o endereço poderá consultar e pagar esta fatura sem login."
            }
            confirmLabel={invoice.publicEnabled ? "Desativar link" : "Ativar link"}
            destructive={invoice.publicEnabled}
          />
          {sub && (
            <ConfirmDialog
              open={confirm === "subscription"}
              onOpenChange={(open) => !open && setConfirm(null)}
              action={changeSubscription}
              fields={{
                id: sub.id,
                status: sub.status === "active" ? "paused" : "active",
              }}
              title={
                sub.status === "active" ? "Pausar a recorrência?" : "Retomar a recorrência?"
              }
              description={
                sub.status === "active"
                  ? sub.ahead?.status === "issued"
                    ? `As próximas emissões automáticas param. A fatura de ${dateLabel(sub.ahead.dueDate)} já está no Inter e continua valendo; se não for devida, abra essa fatura e use Cancelar no Inter.`
                    : "As próximas emissões automáticas param. Faturas já emitidas não mudam."
                  : sub.resume
                    ? `${sub.resume.missed.length === 1 ? `O vencimento de ${dateLabel(sub.resume.missed[0])} passou` : `Os vencimentos de ${dateList(sub.resume.missed)} passaram`} sem cobrança.${sub.resume.dropped ? ` ${sub.resume.dropped === 1 ? "Um vencimento mais antigo fica" : `${sub.resume.dropped} vencimentos mais antigos ficam`} de fora; cobre à parte se for devido.` : ""} A recorrência volta no vencimento de ${dateLabel(sub.resume.next)}, ${currency(sub.amountCents)}.`
                    : `As emissões e avisos voltam. Próximo vencimento: ${dateLabel(sub.nextDueDate)}, ${currency(sub.amountCents)}.`
              }
              confirmLabel={sub.status === "active" ? "Pausar" : "Retomar"}
              extra={
                sub.status !== "active" && sub.resume
                  ? (formId) => (
                      <fieldset className="grid gap-2 rounded-lg border bg-field/60 px-3 py-3 text-sm">
                        <legend className="sr-only">O que fazer com os vencimentos que passaram</legend>
                        <label className="flex items-start gap-2">
                          <input type="radio" form={formId} name="catchUp" value="drafts" defaultChecked className="mt-1 size-4 min-h-0 shrink-0 p-0 accent-primary" />
                          <span>
                            {sub.resume!.missed.length === 1
                              ? sub.resume!.drafted.length
                                ? "Cobrar esse vencimento com o rascunho que já existe"
                                : "Criar um rascunho avulso para cobrar esse vencimento"
                              : `Criar ${sub.resume!.missed.length} rascunhos avulsos para cobrar esses vencimentos`}
                            <span className="block text-xs text-muted-foreground">
                              {sub.resume!.missed.length === 1 ? "Fica" : "Cada um fica"} com o vencimento original e uma nova data para pagar.
                              {sub.resume!.drafted.length && sub.resume!.missed.length > 1 ? ` ${dateList(sub.resume!.drafted)} ${sub.resume!.drafted.length === 1 ? "usa o rascunho" : "usam os rascunhos"} que já existe${sub.resume!.drafted.length === 1 ? "" : "m"}.` : ""} Nada vai ao Inter até você emitir.
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2">
                          <input type="radio" form={formId} name="catchUp" value="skip" className="mt-1 size-4 min-h-0 shrink-0 p-0 accent-primary" />
                          <span>
                            Seguir só a partir de {dateLabel(sub.resume!.next)}, sem cobrar o que passou
                            {sub.resume!.drafted.length ? (
                              <span className="block text-xs text-muted-foreground">
                                {sub.resume!.drafted.length === 1 ? `O rascunho de ${dateLabel(sub.resume!.drafted[0])} é cancelado.` : `Os rascunhos de ${dateList(sub.resume!.drafted)} são cancelados.`}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </fieldset>
                    )
                  : undefined
              }
            />
          )}
          <ConfirmDialog
            open={confirm === "bank"}
            onOpenChange={(open) => !open && setConfirm(null)}
            action={cancelCharge}
            fields={{ id: invoice.id }}
            title="Cancelar esta cobrança no Inter?"
            description={`O boleto e o Pix de ${currency(invoice.amountCents)} para ${companyName} deixam de valer e os avisos param. Não dá para desfazer: para cobrar de novo, crie outra cobrança.${sub?.status === "active" ? " A recorrência fica pausada para não emitir o próximo período; retome se o cliente continuar." : ""}`}
            confirmLabel="Cancelar no Inter"
            destructive
          />
          <ConfirmDialog
            open={confirm === "cancel"}
            onOpenChange={(open) => !open && setConfirm(null)}
            action={cancelDraft}
            fields={{ id: invoice.id }}
            title="Cancelar este rascunho?"
            description={`A cobrança de ${currency(invoice.amountCents)} para ${companyName} não será emitida.`}
            confirmLabel="Cancelar rascunho"
            destructive
          />
          {deletable && (
            <DeleteInvoiceDialog
              invoice={invoice}
              company={companyName}
              recurring={!!sub}
              open={confirm === "delete"}
              onOpenChange={(open) => !open && setConfirm(null)}
            />
          )}
          <ConfirmDialog
            open={send !== null}
            onOpenChange={(open) => !open && setSend(null)}
            action={sendInvoiceNotice}
            fields={{ id: invoice.id, channel: send ?? "email" }}
            title={`Enviar a cobrança por ${send === "whatsapp" ? "WhatsApp" : "e-mail"}?`}
            description={`${companyName} recebe o aviso desta fatura de ${currency(invoice.amountCents)} com o link de pagamento.`}
            confirmLabel="Enviar"
            onSuccess={() => setSend(null)}
          />
          <ConfirmDialog
            open={again !== null}
            onOpenChange={(open) => !open && setAgain(null)}
            action={resendNoticeAgain}
            fields={{ noticeId: again ?? "" }}
            title="Reenviar este aviso?"
            description={(() => {
              const n = notices.find((x) => x.id === again);
              const to = n ? (n.channel === "whatsapp" ? `o WhatsApp ${formatPhone(n.recipient)}` : n.recipient) : "o mesmo contato";
              return `A cobrança de ${currency(invoice.amountCents)} vai de novo para ${to}, com o link de pagamento. A mensagem fala da situação de hoje: em aberto, vence hoje ou em atraso.`;
            })()}
            confirmLabel="Reenviar"
            onSuccess={() => {
              setAgain(null);
              refreshSoon();
            }}
          />
          <ConfirmDialog
            open={resend !== null}
            onOpenChange={(open) => !open && setResend(null)}
            action={resendBillingNotice}
            fields={{ noticeId: resend ?? "" }}
            title="Reenviar este aviso?"
            description={`${companyName} recebe novamente o aviso desta fatura. Se o contato foi corrigido nas preferências, o envio também vai para o novo endereço.`}
            confirmLabel="Reenviar"
            onSuccess={() => {
              setResend(null);
              refreshSoon();
            }}
          />
        </>
      )}
    </>
  );
}
