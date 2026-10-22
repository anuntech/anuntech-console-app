import Image from "next/image";
import { BrandLockup } from "@/components/shell/brand";
import type { ReactNode } from "react";
import {
  ArrowDownToLineIcon,
  BarcodeIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  QrCodeIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { BrandArt } from "@/components/ui/brand-art";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/console/copy-button";
import { DownloadLink } from "@/components/console/download-link";
import { InvoiceStatusBadge } from "@/components/financeiro/invoice-badges";
import { currency, dateLabel } from "@/lib/format";
import { lateFeesLabel, noChargeTerms, type ChargeTerms } from "@/lib/billing/billing-terms";
import { PaymentArrival, PaymentRefresh, PaymentStatusAnnouncer } from "./payment-live";

export type PublicInvoiceView = {
  description: string;
  company: string;
  amountCents: number;
  dueDate: string;
  /** The boleto's date when the obligation is already past due. */
  bankDueDate?: string | null;
  status: "issued" | "paid" | "cancelled";
  /**
   * Why a cancelled charge is closed when it was not the Anuntech's cancel:
   * the boleto and the Pix ran out unpaid (the amount is still owed), or a
   * new charge replaced this one (lib/billing/invoice-debt.ts).
   */
  closure?: "expired" | "replaced" | null;
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
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 id={id} className="text-body font-medium text-foreground">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/** "R$ 1.250,00" with the currency sign set smaller, so the figure leads. Read as one value. */
function Amount({ cents, className = "" }: { cents: number; className?: string }) {
  const text = currency(cents);
  const match = /^(\D+?)\s*(\d[\d.,]*)$/.exec(text);
  return (
    <p className={cn("tabular-nums break-words text-foreground", className)}>
      {match ? (
        <>
          <span className="mr-1.5 align-[0.45em] text-title-sm text-muted-foreground">{match[1]}</span>
          {match[2]}
        </>
      ) : (
        text
      )}
    </p>
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
  const success = tone === "success";
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center sm:px-10 sm:py-16">
      <span
        className={cn(
          "mb-5 flex size-14 items-center justify-center rounded-full [&_svg]:size-7",
          success
            ? // The one overshoot in the Console: only when the payment lands while the page is open.
              "bg-success-soft text-success motion-safe:group-data-[live]/arrival:animate-in motion-safe:group-data-[live]/arrival:fade-in motion-safe:group-data-[live]/arrival:zoom-in-85 motion-safe:group-data-[live]/arrival:duration-(--anu-motion-slow) motion-safe:group-data-[live]/arrival:ease-[cubic-bezier(0.34,1.36,0.64,1)]"
            : "bg-secondary text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "flex",
            success &&
              "motion-safe:group-data-[live]/arrival:animate-in motion-safe:group-data-[live]/arrival:fade-in motion-safe:group-data-[live]/arrival:fill-mode-both motion-safe:group-data-[live]/arrival:delay-80 motion-safe:group-data-[live]/arrival:duration-160",
          )}
        >
          {icon}
        </span>
      </span>
      <h2
        className={cn(
          "text-title text-balance text-foreground",
          success && "motion-safe:group-data-[live]/arrival:reveal motion-safe:group-data-[live]/arrival:[--i:1]",
        )}
      >
        {title}
      </h2>
      <div
        className={cn(
          "mt-2 max-w-[40ch] text-sm text-pretty text-muted-foreground",
          success && "motion-safe:group-data-[live]/arrival:reveal motion-safe:group-data-[live]/arrival:[--i:2]",
        )}
      >
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
      <PaymentStatusAnnouncer status={i.status} closure={i.closure ?? null} ready={ready} />
      <header className="mb-6 flex items-center justify-between gap-4 sm:mb-10">
        <BrandLockup className="h-7" />
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs whitespace-nowrap text-muted-foreground">
          <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Página oficial da Anuntech</span>
          <span className="sm:hidden">Página oficial</span>
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        {/* The bill, read like a receipt: who charges what, then the figure, then the dates. */}
        <section
          aria-labelledby="invoice-title"
          className="reveal rounded-2xl border bg-card shadow-card lg:sticky lg:top-8"
        >
          <div className="p-5 sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <p className="text-caption font-medium text-muted-foreground">Fatura da Anuntech</p>
              <InvoiceStatusBadge status={display} />
            </div>
            <h1
              id="invoice-title"
              className="mt-3 text-title text-balance break-words text-foreground"
            >
              {i.description}
            </h1>
            <p className="mt-1 text-sm break-words text-muted-foreground">
              {i.company}
            </p>
          </div>
          {/* The tear line of a receipt. */}
          <div aria-hidden="true" className="mx-5 border-t border-dashed sm:mx-7" />
          <div className="p-5 sm:p-7">
            <p className="text-xs font-medium text-muted-foreground">
              {paid ? "Valor pago" : "Valor da fatura"}
            </p>
            <Amount cents={i.amountCents} className="mt-1 text-display-sm" />
            {discountValid && (
              <p className="mt-3 rounded-lg border border-success-edge bg-success-soft px-3 py-2 text-sm text-success">
                Pagando até {dateLabel(i.dueDate)}:{" "}
                <span className="font-medium tabular-nums">
                  {currency(i.amountCents - terms.discountCents!)}
                </span>
                <span className="text-foreground/70"> (desconto de {currency(terms.discountCents!)})</span>
              </p>
            )}
            {payable && lateFees && (
              <p className={cn("mt-3 text-xs", display === "overdue" ? "text-destructive" : "text-muted-foreground")}>
                {display === "overdue" ? "Vencida: " : "Após o vencimento: "}
                {lateFees}, calculados pelo banco no pagamento.
              </p>
            )}
            <dl className="mt-6 grid gap-3 border-t pt-5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDaysIcon className="size-4" aria-hidden="true" />
                  Vencimento
                </dt>
                <dd
                  className={cn(
                    "font-medium tabular-nums",
                    display === "overdue" ? "text-destructive" : "text-foreground",
                  )}
                >
                  {dateLabel(i.dueDate)}
                </dd>
              </div>
              {payable && i.bankDueDate && i.bankDueDate !== i.dueDate && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Pague até</dt>
                  <dd className="font-medium text-foreground tabular-nums">{dateLabel(i.bankDueDate)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Emissor</dt>
                <dd className="font-medium text-foreground">Anuntech</dd>
              </div>
            </dl>
            {/* Paid says it once, on the right. */}
            {!paid && (
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                {cancelled
                  ? i.closure === "expired"
                    ? "O prazo do boleto e do Pix acabou sem pagamento."
                    : i.closure === "replaced"
                      ? "Esta cobrança foi substituída por uma nova."
                      : "Esta cobrança foi cancelada pela Anuntech."
                  : display === "overdue"
                    ? "O vencimento passou, mas o boleto e o Pix continuam válidos para pagamento."
                    : "Confira os dados e escolha como prefere pagar."}
              </p>
            )}
          </div>
        </section>

        <section
          aria-label="Pagamento da fatura"
          className="reveal overflow-hidden rounded-2xl border bg-card shadow-card [--i:1]"
        >
          <PaymentArrival status={i.status}>
            {paid ? (
              <Outcome
                icon={<CircleCheckIcon />}
                tone="success"
                title="Pagamento confirmado"
              >
                <p>O Banco Inter confirmou o pagamento. Obrigado.</p>
              </Outcome>
            ) : cancelled && i.closure === "expired" ? (
              <Outcome icon={<CircleSlashIcon />} tone="muted" title="Boleto e Pix vencidos">
                <p>O valor continua em aberto. Fale com a Anuntech para receber uma nova forma de pagamento.</p>
              </Outcome>
            ) : cancelled && i.closure === "replaced" ? (
              <Outcome icon={<CircleSlashIcon />} tone="muted" title="Cobrança substituída">
                <p>A Anuntech mandou uma nova cobrança no lugar desta. Use o link que chegou com ela.</p>
              </Outcome>
            ) : cancelled ? (
              <Outcome icon={<CircleSlashIcon />} tone="muted" title="Fatura cancelada">
                <p>Não é necessário pagar esta fatura.</p>
              </Outcome>
            ) : !ready ? (
              <>
                {/* No spinner: the brand's document builds once while the bank prepares the charge. */}
                <div className="flex flex-col items-center px-6 py-12 text-center sm:px-10 sm:py-14">
                  <BrandArt name="faturas" className="mb-5 w-36 sm:w-44" />
                  <h2 className="reveal text-title text-balance text-foreground [--i:2]">Preparando o pagamento</h2>
                  <p className="reveal mt-2 max-w-[40ch] text-sm text-pretty text-muted-foreground [--i:3]">
                    O banco está processando esta cobrança. O Pix e o boleto
                    aparecem aqui assim que ficarem prontos, sem precisar
                    recarregar a página.
                  </p>
                </div>
                <PaymentRefresh />
              </>
            ) : (
              <>
                <div className="divide-y">
                  {qr && i.pix && (
                    <section className="p-5 sm:p-7" aria-labelledby="pix-title">
                      <MethodHeading
                        id="pix-title"
                        icon={<QrCodeIcon />}
                        title="Pix"
                        hint="Confirmação em poucos minutos."
                      />
                      <div className="mt-5 grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                        {/* On a phone the payer copies the code; the QR Code is for paying from another device, so it comes last. */}
                        <div className="mx-auto w-fit rounded-xl border bg-white p-3 max-sm:order-last sm:mx-0">
                          <Image
                            unoptimized
                            src={qr}
                            alt="QR Code Pix desta fatura"
                            width={192}
                            height={192}
                            className="block size-44 sm:size-48"
                          />
                        </div>
                        <div className="min-w-0">
                          <ol className="grid gap-2 text-sm text-muted-foreground">
                            {[
                              "Abra o app do seu banco e escolha Pix.",
                              "Leia o QR Code ou cole o código abaixo.",
                              "Confira os dados e confirme.",
                            ].map((step, n) => (
                              <li key={step} className="flex items-start gap-2.5">
                                <span
                                  aria-hidden="true"
                                  className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-caption font-medium text-foreground tabular-nums"
                                >
                                  {n + 1}
                                </span>
                                <span>
                                  <span className="sr-only">{n + 1}. </span>
                                  {step}
                                </span>
                              </li>
                            ))}
                          </ol>
                          <label className="mt-5 block">
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
                    <section className="p-5 sm:p-7" aria-labelledby="boleto-title">
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
                        // The Pix is the quicker way; the boleto's button stays second.
                        variant={qr && i.pix ? "outline" : "default"}
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
          </PaymentArrival>
        </section>
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-xs text-muted-foreground">
        <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
        Pagamento processado pelo Banco Inter para a Anuntech.
      </footer>
    </div>
  );
}
