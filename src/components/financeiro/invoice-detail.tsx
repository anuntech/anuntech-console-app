"use client";
import Link from "next/link";
import { useId, useState, type FocusEvent, type ReactNode } from "react";
import {
  BanIcon,
  Building2Icon,
  CircleCheckIcon,
  CircleSlashIcon,
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
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "cn";
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
import { CopyButton } from "@/components/console/copy-button";
import { DownloadLink } from "@/components/console/download-link";
import {
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { cancelDraft } from "@/lib/actions";
import { issueCharge, syncCharge } from "@/lib/billing/billing-actions";
import {
  changePaymentLink,
  changeSubscription,
  resendBillingNotice,
  sendInvoiceNotice,
} from "@/lib/billing/billing-public-actions";
import {
  daysOverdue,
  noticeChannelLabels,
  noticeKindLabel,
} from "@/lib/billing/billing-notice-rules";
import { bankStatusLabels } from "@/lib/billing/billing-rules";
import { formatDocument, formatPhone } from "@/lib/companies/company-input";
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
import { billingTypeLabel, DeleteInvoiceDialog } from "./invoices-table";

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
    editable: "draft" | "issued" | null;
    /** Staff only: a draft (or cancelled draft) that never reached the Inter. */
    deletable?: boolean;
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
    terms: ChargeTerms;
  } | null;
  /** Draft waiting for its automatic emission date. */
  scheduled: boolean;
  scheduledIssueDate: string | null;
  notices: {
    id: string;
    channel: string;
    kind: string;
    status: string;
    error: string | null;
    createdAt: string;
    resendable: boolean;
  }[];
  contacts: {
    email: string;
    emailEnabled: boolean;
    phone: string;
    whatsappEnabled: boolean;
  } | null;
  canSend: { email: boolean; whatsapp: boolean };
  events: { id: string; action: string; createdAt: string }[];
  viewer: { admin: boolean };
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

export function InvoiceDetail({ data }: { data: InvoiceDetailData }) {
  const {
    invoice,
    company,
    subscription: sub,
    scheduled,
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
    null | "link" | "subscription" | "cancel" | "delete"
  >(null);
  const [send, setSend] = useState<null | "email" | "whatsapp">(null);
  const [resend, setResend] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState(false);
  const ask = (which: "link" | "subscription" | "cancel" | "delete") =>
    setTimeout(() => setConfirm(which), 0);
  const deletable = admin && !!invoice.deletable;

  const paid = invoice.status === "paid";
  const issued = invoice.status === "issued";
  const settled = issued || paid;
  const processing =
    issued && !!invoice.providerId && !invoice.pixCopyPaste && !invoice.boletoLine;
  const late = invoice.display === "overdue" ? daysOverdue(invoice.dueDate, today) : 0;
  const typeLabel = billingTypeLabel(!!sub, sub?.interval ?? null);
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
        crumbs={[
          { label: "Financeiro", href: "/financeiro" },
          { label: invoice.description },
        ]}
        title={invoice.description}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <InvoiceStatusBadge status={invoice.display} />
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            {admin ? (
              <Link
                href={`/empresas/${company.id}`}
                className="text-foreground hover:text-primary"
              >
                {company.name}
              </Link>
            ) : (
              <span>{company.name}</span>
            )}
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span>{typeLabel}</span>
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
                  <Link href={`/empresas/${company.id}`}>
                    <Building2Icon />
                    Ver empresa
                  </Link>
                </DropdownMenuItem>
                {invoice.publicUrl && (
                  <DropdownMenuItem asChild>
                    <a href={invoice.publicUrl} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon />
                      Abrir página de pagamento
                    </a>
                  </DropdownMenuItem>
                )}
                {settled && (
                  <DropdownMenuItem onSelect={() => ask("link")}>
                    {invoice.publicEnabled ? <Link2OffIcon /> : <Link2Icon />}
                    {invoice.publicEnabled
                      ? "Desativar link de pagamento"
                      : "Ativar link de pagamento"}
                  </DropdownMenuItem>
                )}
                {sub && ["active", "paused"].includes(sub.status) && (
                  <DropdownMenuItem onSelect={() => ask("subscription")}>
                    {sub.status === "active" ? <PauseIcon /> : <PlayIcon />}
                    {sub.status === "active"
                      ? "Pausar recorrência"
                      : "Retomar recorrência"}
                  </DropdownMenuItem>
                )}
                {(invoice.editable === "draft" || deletable) && (
                  <DropdownMenuSeparator />
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
          )
        }
      />

      {admin && sync !== "off" && <BankSync id={invoice.id} mode={sync} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle
                title="Cobrança"
                description={
                  invoice.engagement
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
              <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Valor</p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-0.02em] tabular-nums text-foreground">
                    {currency(invoice.amountCents)}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs font-medium text-muted-foreground">
                    Vencimento
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-lg font-semibold tabular-nums",
                      late ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {dateLabel(invoice.dueDate)}
                  </p>
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
                  {scheduled && scheduledIssueDate && (
                    <p className={cn("text-xs", scheduledIssueDate <= today ? "text-warning" : "text-muted-foreground")}>
                      {scheduledIssueDate <= today
                        ? "Emissão automática em instantes"
                        : `Emissão automática em ${dateLabel(scheduledIssueDate)}`}
                    </p>
                  )}
                </div>
              </div>
              <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <Fact label="Cliente">
                  {admin ? (
                    <Link
                      href={`/empresas/${company.id}`}
                      className="hover:text-primary"
                    >
                      {company.name}
                    </Link>
                  ) : (
                    company.name
                  )}
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {formatDocument(company.document)}
                  </span>
                </Fact>
                <Fact label="Tipo">{typeLabel}</Fact>
                {hasTerms(invoice.terms) && (
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
                {admin && (
                  <Fact label="Endereço de cobrança" className="sm:col-span-2">
                    {company.address || (
                      <span className="text-warning">
                        Não cadastrado. Sem ele, o Inter não emite a cobrança.
                      </span>
                    )}
                  </Fact>
                )}
                <Fact label="Criada em">{dateLabel(new Date(invoice.createdAt))}</Fact>
              </dl>
            </CardContent>
          </Card>

          {admin && invoice.status === "draft" && !invoice.bankRequested && !scheduled && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Publicar no Inter"
                  description={
                    sub
                      ? "Ativa a recorrência: esta e as próximas cobranças são emitidas e avisadas 5 dias antes de cada vencimento."
                      : "Emite boleto e Pix no Inter com os dados abaixo."
                  }
                />
              </CardHeader>
              <ServerForm action={issueCharge} className="contents">
                <input type="hidden" name="id" value={invoice.id} />
                <CardContent className="flex flex-col gap-5">
                  <FormError />
                  <div className="rounded-lg border bg-secondary/40 px-4 py-3 text-sm">
                    <p className="font-medium text-foreground">
                      {company.name}{" "}
                      <span className="font-normal tabular-nums text-muted-foreground">
                        · {formatDocument(company.document)}
                      </span>
                    </p>
                    {company.address ? (
                      <p className="mt-0.5 text-muted-foreground">{company.address}</p>
                    ) : (
                      <p className="mt-0.5 text-warning">
                        Endereço de cobrança não cadastrado. Complete o cadastro
                        antes de publicar.
                      </p>
                    )}
                    <Link
                      href={`/empresas/${company.id}?editar=1`}
                      className="mt-1.5 inline-block text-xs font-medium text-primary"
                    >
                      Editar cadastro do cliente
                    </Link>
                  </div>
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
                          Ativar a recorrência{" "}
                          {sub.interval === "yearly" ? "anual" : "mensal"}: cada
                          período é emitido e avisado por e-mail e WhatsApp 5
                          dias antes do vencimento.
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
                <SectionTitle
                  title="Emissão agendada"
                  description="A recorrência está ativa; o Console emite e avisa sozinho."
                />
              </CardHeader>
              <CardContent>
                <Notice icon={<Loader2Icon />}>
                  {scheduledIssueDate && scheduledIssueDate <= today ? (
                    <>
                      A data de emissão ({dateLabel(scheduledIssueDate)}) já chegou: a rotina automática roda a cada 5
                      minutos e emite na próxima passagem. Os avisos saem logo depois.
                    </>
                  ) : (
                    <>
                      Emissão prevista para{" "}
                      <span className="font-medium text-foreground">
                        {scheduledIssueDate ? dateLabel(scheduledIssueDate) : "—"}
                      </span>
                      {scheduledIssueDate &&
                        `, ${daysBetween(scheduledIssueDate, invoice.dueDate)} dias antes do vencimento`}
                      . Os avisos saem após a emissão.
                    </>
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
              <ServerForm action={syncCharge} className="contents">
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
            </Card>
          )}

          {(settled || (invoice.status === "cancelled" && invoice.providerId)) && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Pagamento"
                  description={
                    paid
                      ? "Confirmado pelo Inter."
                      : processing
                        ? "O Inter está processando a emissão."
                        : invoice.status === "cancelled"
                          ? "Cobrança cancelada no banco."
                          : "Boleto e Pix desta cobrança."
                  }
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
                    {invoice.bankCheckedAt && (
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
                {processing && (
                  <Notice icon={<Loader2Icon className="animate-spin" />}>
                    Boleto e Pix aparecem aqui assim que o Inter concluir a
                    emissão. Esta página atualiza sozinha.
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
                {admin && invoice.bankStatus && (
                  <p className="text-xs text-muted-foreground">
                    Situação no Inter:{" "}
                    <span className="font-medium text-foreground">
                      {bankStatusLabels[invoice.bankStatus] ?? invoice.bankStatus}
                    </span>
                    {invoice.requestedDueDate && (
                      <>
                        {" "}
                        · o banco moveu o vencimento de{" "}
                        {dateLabel(invoice.requestedDueDate)} para{" "}
                        {dateLabel(invoice.dueDate)}
                      </>
                    )}
                    .
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {admin && settled && contacts && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title={
                    <span className="flex items-center gap-2">
                      Avisos ao cliente
                      <Count>{notices.length}</Count>
                    </span>
                  }
                  description="E-mail e WhatsApp com o link de pagamento: nova cobrança, vencimento e lembretes aos 5, 10, 15, 20 e 25 dias de atraso, a partir das 8h. Param com o pagamento."
                />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <Fact label="E-mail">
                    {contacts.email || (
                      <span className="text-muted-foreground">Não cadastrado</span>
                    )}
                    {contacts.email && !contacts.emailEnabled && (
                      <span className="text-muted-foreground"> · desativado</span>
                    )}
                  </Fact>
                  <Fact label="WhatsApp">
                    {contacts.phone ? (
                      formatPhone(contacts.phone)
                    ) : (
                      <span className="text-muted-foreground">Não cadastrado</span>
                    )}
                    {contacts.phone && !contacts.whatsappEnabled && (
                      <span className="text-muted-foreground"> · desativado</span>
                    )}
                  </Fact>
                </dl>
                {notices.length ? (
                  <ul className="divide-y rounded-lg border">
                    {notices.map((notice) => (
                      <li
                        key={notice.id}
                        className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground [&_svg]:size-3.5">
                          {notice.channel === "email" ? <MailIcon /> : <MessageCircleIcon />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-foreground">
                            {noticeChannelLabels[notice.channel] ?? notice.channel} ·{" "}
                            {noticeKindLabel(notice.kind)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {dateTimeLabel(notice.createdAt)}
                            {notice.error && ` · ${notice.error}`}
                          </span>
                        </span>
                        <NoticeStatusBadge status={notice.status} />
                        {notice.resendable && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setResend(notice.id)}
                          >
                            Reenviar
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum aviso enviado ainda.
                  </p>
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

        <aside className="flex min-w-0 flex-col gap-6">
          {admin && settled && (
            <Card>
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
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Recorrência"
                  description={sub.interval === "yearly" ? "Cobrança anual" : "Cobrança mensal"}
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
                  <Fact label="Situação">
                    <SubscriptionStatusBadge status={sub.status} />
                  </Fact>
                  <Fact label="Próximo vencimento">{dateLabel(sub.nextDueDate)}</Fact>
                  <Fact label="Próxima emissão e avisos">{dateLabel(sub.issueDate)}</Fact>
                  <Fact label="Valor por período">
                    <span className="tabular-nums">{currency(sub.amountCents)}</span>
                  </Fact>
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

          <Card>
            <CardHeader>
              <SectionTitle title="Nota fiscal" description="Documento fiscal desta cobrança." />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">
                {invoice.fiscalStatus === "not_requested"
                  ? "Emissão ainda não solicitada."
                  : "Emissão em andamento com a equipe da Anuntech."}
              </p>
              {admin && (
                <p className="text-xs text-muted-foreground">
                  Nota fiscal automática{" "}
                  {company.autoIssueNfse ? "ativada" : "desativada"} para este
                  cliente; a emissão depende da integração fiscal.{" "}
                  <Link
                    href={`/empresas/${company.id}?editar=1`}
                    className="font-medium text-primary"
                  >
                    Configurar no cadastro
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {admin && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Histórico"
                  description="O que aconteceu com esta cobrança."
                />
              </CardHeader>
              <CardContent>
                {events.length ? (
                  <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
                    {(allEvents ? events : events.slice(0, 5)).map((event) => (
                      <li key={event.id} className="relative text-sm">
                        <span
                          aria-hidden="true"
                          className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-primary/70"
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
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum registro ainda.
                  </p>
                )}
                {events.length > 5 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="mt-4 text-muted-foreground"
                    onClick={() => setAllEvents((value) => !value)}
                  >
                    {allEvents ? "Mostrar menos" : `Mostrar mais ${events.length - 5}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
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
                  ? "As próximas emissões automáticas param. Faturas já emitidas não mudam."
                  : `As emissões e avisos voltam. Próximo vencimento: ${dateLabel(sub.nextDueDate)}, ${currency(sub.amountCents)}.`
              }
              confirmLabel={sub.status === "active" ? "Pausar" : "Retomar"}
            />
          )}
          <ConfirmDialog
            open={confirm === "cancel"}
            onOpenChange={(open) => !open && setConfirm(null)}
            action={cancelDraft}
            fields={{ id: invoice.id }}
            title="Cancelar este rascunho?"
            description={`A cobrança de ${currency(invoice.amountCents)} para ${company.name} não será emitida.`}
            confirmLabel="Cancelar rascunho"
            destructive
          />
          {deletable && (
            <DeleteInvoiceDialog
              invoice={invoice}
              company={company.name}
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
            description={`${company.name} recebe o aviso desta fatura de ${currency(invoice.amountCents)} com o link de pagamento.`}
            confirmLabel="Enviar"
            onSuccess={() => setSend(null)}
          />
          <ConfirmDialog
            open={resend !== null}
            onOpenChange={(open) => !open && setResend(null)}
            action={resendBillingNotice}
            fields={{ noticeId: resend ?? "" }}
            title="Reenviar este aviso?"
            description={`${company.name} recebe novamente o aviso desta fatura. Se o contato foi corrigido nas preferências, o envio também vai para o novo endereço.`}
            confirmLabel="Reenviar"
            onSuccess={() => setResend(null)}
          />
        </>
      )}
    </>
  );
}
