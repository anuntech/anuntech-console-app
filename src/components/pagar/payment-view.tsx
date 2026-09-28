import Image from "next/image";
import type { ReactNode } from "react";
import {
  ArrowDownToLineIcon,
  BarcodeIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  Loader2Icon,
  QrCodeIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/console/copy-button";
import { DownloadLink } from "@/components/console/download-link";
import { InvoiceStatusBadge } from "@/components/financeiro/invoice-badges";
import { currency, dateLabel } from "@/lib/format";
import { lateFeesLabel, noChargeTerms, type ChargeTerms } from "@/lib/billing-terms";
import { PaymentRefresh, PaymentStatusAnnouncer } from "./payment-live";

export type PublicInvoiceView = {
  description: string;
  company: string;
  amountCents: number;
  dueDate: string;
  /** The boleto's date when the obligation is already past due. */
  bankDueDate?: string | null;
  status: "issued" | "paid" | "cancelled";
  pix: string | null;
  boletoLine: string | null;
  terms?: ChargeTerms;
};

function MethodHeading({
  id,
  icon,
  title,
  hint,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function Outcome({
  icon,
  tone,
  title,
  children,
}: {
  icon: ReactNode;
  tone: "success" | "muted";
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center sm:px-10">
      <span
        className={cn(
          "mb-5 flex size-14 items-center justify-center rounded-full [&_svg]:size-7",
          tone === "success"
            ? "bg-success-soft text-success"
            : "bg-secondary text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      <div className="mt-2 max-w-[40ch] text-sm text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

/**
 * The page a client lands on from an e-mail or WhatsApp: what is being
 * charged and the two ways to pay it, nothing else. Public, no login, so it
 * shows only what the payer needs.
 */
export function PaymentView({
  invoice: i,
  qr,
  publicId,
  today,
}: {
  invoice: PublicInvoiceView;
  /** Data URL of the Pix QR code, when there is a Pix to pay. */
  qr: string | null;
  publicId: string;
  /** Civil date in São Paulo, for the overdue mark. */
  today: string;
}) {
  const payable = i.status === "issued";
  const paid = i.status === "paid";
  const cancelled = i.status === "cancelled";
  const ready = Boolean(i.pix || i.boletoLine);
  const display = payable && i.dueDate < today ? "overdue" : i.status;
  const terms = i.terms ?? noChargeTerms;
  const discountValid = payable && !!terms.discountCents && i.dueDate >= today;
  const lateFees = lateFeesLabel(terms);
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <PaymentStatusAnnouncer status={i.status} ready={ready} />
      <header className="mb-8 flex items-center justify-between gap-4">
        <Image
          src="/brand/logo-anuntech.png"
          alt="Anuntech"
          width={1200}
          height={372}
          priority
          className="h-9 w-auto dark:brightness-0 dark:invert"
        />
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs whitespace-nowrap text-muted-foreground">
          <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Página oficial da Anuntech</span>
          <span className="sm:hidden">Página oficial</span>
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <section
          aria-labelledby="invoice-title"
          className="rounded-2xl border bg-card p-6 shadow-card sm:p-7 lg:sticky lg:top-8"
        >
          <div className="flex items-center justify-between gap-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
              <ReceiptTextIcon className="size-5" aria-hidden="true" />
            </span>
            <InvoiceStatusBadge status={display} />
          </div>
          <p className="mt-6 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Fatura Anuntech
          </p>
          <h1
            id="invoice-title"
            className="mt-2 text-2xl font-semibold tracking-[-0.02em] break-words text-foreground"
          >
            {i.description}
          </h1>
          <p className="mt-1 text-sm break-words text-muted-foreground">
            {i.company}
          </p>
          <div className="mt-7 border-t pt-6">
            <p className="text-xs text-muted-foreground">
              {paid ? "Valor pago" : "Valor da fatura"}
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-[-0.03em] tabular-nums break-words text-foreground">
              {currency(i.amountCents)}
            </p>
            {discountValid && (
              <p className="mt-2 text-sm text-success">
                Pagando até {dateLabel(i.dueDate)}:{" "}
                <span className="font-semibold tabular-nums">
                  {currency(i.amountCents - terms.discountCents!)}
                </span>
                <span className="text-muted-foreground"> (desconto de {currency(terms.discountCents!)})</span>
              </p>
            )}
            {payable && lateFees && (
              <p className={cn("mt-2 text-xs", display === "overdue" ? "text-destructive" : "text-muted-foreground")}>
                {display === "overdue" ? "Vencida: " : "Após o vencimento: "}
                {lateFees}, calculados pelo banco no pagamento.
              </p>
            )}
          </div>
          <dl className="mt-6 grid gap-3 border-t pt-5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <CalendarDaysIcon className="size-4" aria-hidden="true" />
                Vencimento
              </dt>
              <dd
                className={cn(
                  "font-semibold tabular-nums",
                  display === "overdue" ? "text-destructive" : "text-foreground",
                )}
              >
                {dateLabel(i.dueDate)}
              </dd>
            </div>
            {payable && i.bankDueDate && i.bankDueDate !== i.dueDate && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Pague até</dt>
                <dd className="font-semibold text-foreground tabular-nums">{dateLabel(i.bankDueDate)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Emissor</dt>
              <dd className="font-semibold text-foreground">Anuntech</dd>
            </div>
          </dl>
          {/* Paid says it once, on the right. */}
          {!paid && (
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              {cancelled
                ? "Esta cobrança foi cancelada pela Anuntech."
                : display === "overdue"
                  ? "O vencimento passou, mas o boleto e o Pix continuam válidos para pagamento."
                  : "Confira os dados e escolha como prefere pagar."}
            </p>
          )}
        </section>

        <section
          aria-label="Pagamento da fatura"
          className="overflow-hidden rounded-2xl border bg-card shadow-card"
        >
          {paid ? (
            <Outcome
              icon={<CircleCheckIcon />}
              tone="success"
              title="Pagamento confirmado"
            >
              <p>O Banco Inter confirmou o pagamento. Obrigado.</p>
            </Outcome>
          ) : cancelled ? (
            <Outcome icon={<CircleSlashIcon />} tone="muted" title="Fatura cancelada">
              <p>Não é necessário pagar esta fatura.</p>
            </Outcome>
          ) : !ready ? (
            <>
              <Outcome
                icon={<Loader2Icon className="animate-spin" />}
                tone="muted"
                title="Preparando o pagamento"
              >
                <p>
                  O banco está processando esta cobrança. O Pix e o boleto
                  aparecem aqui assim que ficarem prontos, sem precisar
                  recarregar a página.
                </p>
              </Outcome>
              <PaymentRefresh />
            </>
          ) : (
            <>
              <div className="divide-y">
                {qr && i.pix && (
                  <section className="p-6 sm:p-7" aria-labelledby="pix-title">
                    <MethodHeading
                      id="pix-title"
                      icon={<QrCodeIcon />}
                      title="Pix"
                      hint="Confirmação em poucos minutos."
                    />
                    <div className="mt-5 grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                      <div className="mx-auto w-fit rounded-xl border bg-white p-3 sm:mx-0">
                        <Image
                          unoptimized
                          src={qr}
                          alt="QR Code Pix desta fatura"
                          width={192}
                          height={192}
                          className="block size-48"
                        />
                      </div>
                      <div className="min-w-0">
                        <ol className="grid gap-1.5 text-sm text-muted-foreground">
                          <li>1. Abra o app do seu banco e escolha Pix.</li>
                          <li>2. Leia o QR Code ou cole o código abaixo.</li>
                          <li>3. Confira os dados e confirme.</li>
                        </ol>
                        <label className="mt-4 block">
                          <span className="text-xs font-medium text-foreground">
                            Pix copia e cola
                          </span>
                          <textarea
                            readOnly
                            value={i.pix}
                            rows={4}
                            aria-describedby="pix-hint"
                            className="mt-1.5 block field-sizing-content w-full resize-none rounded-md border border-input bg-field px-3 py-2 font-mono text-[11px] leading-5 break-all text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          />
                        </label>
                        <span id="pix-hint" className="sr-only">
                          Código completo. Você também pode selecionar o texto e
                          copiar.
                        </span>
                        <CopyButton
                          value={i.pix}
                          label="Código Pix"
                          variant="default"
                          size="default"
                          className="mt-3 w-full"
                        >
                          Copiar código Pix
                        </CopyButton>
                      </div>
                    </div>
                  </section>
                )}
                {i.boletoLine && (
                  <section className="p-6 sm:p-7" aria-labelledby="boleto-title">
                    <MethodHeading
                      id="boleto-title"
                      icon={<BarcodeIcon />}
                      title="Boleto"
                      hint="Compensa em até 3 dias úteis."
                    />
                    <div className="mt-5 flex items-center justify-between gap-2">
                      <label
                        htmlFor="boleto-line"
                        className="text-xs font-medium text-foreground"
                      >
                        Linha digitável
                      </label>
                      <Button variant="ghost" size="xs" asChild>
                        <DownloadLink
                          href={`/pagar/${publicId}/boleto`}
                          filename="boleto-anuntech.pdf"
                        >
                          <ArrowDownToLineIcon />
                          Baixar boleto PDF
                        </DownloadLink>
                      </Button>
                    </div>
                    <input
                      id="boleto-line"
                      readOnly
                      value={i.boletoLine}
                      className="mt-1.5 block h-9 w-full rounded-md border border-input bg-field px-3 font-mono text-[11px] tabular-nums text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                    <CopyButton
                      value={i.boletoLine}
                      label="Linha digitável"
                      variant="default"
                      size="default"
                      className="mt-3 w-full"
                    >
                      Copiar linha digitável
                    </CopyButton>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                      Pague pelo app do banco, internet banking ou em qualquer
                      lotérica.
                    </p>
                  </section>
                )}
              </div>
              <p className="flex items-center justify-center gap-1.5 border-t bg-secondary/40 px-6 py-3 text-center text-xs text-muted-foreground">
                <ShieldCheckIcon className="size-3.5 shrink-0" aria-hidden="true" />
                Depois de pagar, a confirmação aparece nesta página sozinha.
              </p>
              <PaymentRefresh />
            </>
          )}
        </section>
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
        Pagamento processado pelo Banco Inter · Anuntech
      </footer>
    </div>
  );
}
