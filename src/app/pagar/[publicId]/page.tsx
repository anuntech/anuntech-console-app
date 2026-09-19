import { notFound } from "next/navigation";
import QRCode from "qrcode";
import Image from "next/image";
import {
  ArrowDownToLine,
  Barcode,
  CalendarDays,
  Check,
  CircleCheck,
  CircleSlash,
  Clock3,
  QrCode,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { publicInvoice } from "@/lib/payment-link";
import { currency, dateLabel } from "@/lib/format";
import { Brand } from "@/components/brand";
import { PaymentCode, PaymentRefresh } from "@/components/payment-code";
import styles from "./payment.module.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pagar fatura | Anuntech",
  robots: { index: false, follow: false, noarchive: true },
};
export default async function Payment({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const i = await publicInvoice(publicId);
  if (!i) notFound();
  const payable = i.status === "issued";
  const paid = i.status === "paid";
  const cancelled = i.status === "cancelled";
  const qr =
    payable && i.pix
      ? await QRCode.toDataURL(i.pix, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: "M",
        })
      : null;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Brand />
        <span className={styles.official}>
          <ShieldCheck size={15} aria-hidden="true" /> Página oficial da
          Anuntech
        </span>
      </header>
      <div className={styles.layout}>
        <section className={styles.summary} aria-labelledby="invoice-title">
          <div className={styles.summaryTop}>
            <span className={styles.receiptIcon}>
              <ReceiptText size={21} aria-hidden="true" />
            </span>
            <span className={`${styles.badge} ${paid ? styles.paidBadge : ""}`}>
              {paid ? (
                <Check size={13} aria-hidden="true" />
              ) : cancelled ? (
                <CircleSlash size={13} aria-hidden="true" />
              ) : (
                <Clock3 size={13} aria-hidden="true" />
              )}
              {paid ? "Paga" : cancelled ? "Cancelada" : "Em aberto"}
            </span>
          </div>
          <p className={styles.eyebrow}>FATURA ANUNTECH</p>
          <h1 id="invoice-title">{i.description}</h1>
          <p className={styles.customer}>{i.company}</p>
          <div className={styles.total}>
            <span>{paid ? "Valor pago" : "Valor da fatura"}</span>
            <p className={styles.amount}>{currency(i.amountCents)}</p>
          </div>
          <dl className={styles.details}>
            <div>
              <dt>
                <CalendarDays size={15} aria-hidden="true" /> Vencimento
              </dt>
              <dd>{dateLabel(i.dueDate)}</dd>
            </div>
            <div>
              <dt>Emissor</dt>
              <dd>Anuntech</dd>
            </div>
          </dl>
          <p className={styles.summaryNote}>
            {paid
              ? "O pagamento desta fatura foi confirmado pelo banco."
              : cancelled
                ? "Esta cobrança foi cancelada pela Anuntech."
                : "Confira os dados da fatura e escolha como prefere pagar."}
          </p>
        </section>
        <section className={styles.payment} aria-label="Pagamento da fatura">
          {paid ? (
            <div className={styles.complete} role="status">
              <div className={styles.successIcon}>
                <CircleCheck size={32} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <h2>Pagamento confirmado</h2>
              <p>Esta fatura já foi paga. Obrigado!</p>
              <div className={styles.confirmation}>
                <ShieldCheck size={16} aria-hidden="true" /> Confirmado pelo
                Banco Inter
              </div>
            </div>
          ) : cancelled ? (
            <div className={styles.complete} role="status">
              <div className={styles.stateIcon}>
                <CircleSlash size={30} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <h2>Fatura cancelada</h2>
              <p>Não é necessário pagar esta fatura.</p>
            </div>
          ) : (
            <>
              {qr && i.pix && (
                <section className={styles.method} aria-labelledby="pix-title">
                  <div className={styles.methodHeading}>
                    <span className={styles.methodIcon}>
                      <QrCode size={19} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id="pix-title">Pagar com Pix</h2>
                      <p>Rápido, direto pelo aplicativo do seu banco.</p>
                    </div>
                  </div>
                  <div className={styles.pixInstructions}>
                    <div className={styles.qrFrame}>
                      <Image
                        unoptimized
                        src={qr}
                        alt="QR Code Pix desta fatura"
                        width={256}
                        height={256}
                        className={styles.qr}
                      />
                    </div>
                    <ol>
                      <li>Abra o aplicativo do seu banco.</li>
                      <li>Escolha Pix e leia o QR Code.</li>
                      <li>Confira os dados e confirme o pagamento.</li>
                    </ol>
                  </div>
                  <PaymentCode
                    value={i.pix}
                    label="Pix copia e cola"
                    buttonLabel="Copiar código Pix"
                  />
                </section>
              )}
              {i.boletoLine && (
                <section
                  className={styles.method}
                  aria-labelledby="boleto-title"
                >
                  <div className={styles.methodHeading}>
                    <span className={styles.methodIcon}>
                      <Barcode size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id="boleto-title">Pagar com boleto</h2>
                      <p>Copie a linha digitável ou baixe o documento.</p>
                    </div>
                  </div>
                  <PaymentCode
                    value={i.boletoLine}
                    label="Linha digitável"
                    buttonLabel="Copiar linha digitável"
                  />
                  <a
                    className={`button ${styles.download}`}
                    href={`/pagar/${publicId}/boleto`}
                  >
                    <ArrowDownToLine size={16} aria-hidden="true" /> Baixar
                    boleto PDF
                  </a>
                </section>
              )}
              {!i.pix && !i.boletoLine && (
                <div className={styles.complete}>
                  <div className={styles.stateIcon}>
                    <ReceiptText
                      size={30}
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                  </div>
                  <h2>Preparando o pagamento</h2>
                  <p>
                    O banco está processando esta cobrança. Os dados de
                    pagamento aparecerão aqui assim que estiverem disponíveis.
                  </p>
                </div>
              )}
              <PaymentRefresh />
              <p className={styles.note}>
                <ShieldCheck size={14} aria-hidden="true" /> Após o pagamento, a
                confirmação pode levar alguns minutos.
              </p>
            </>
          )}
        </section>
      </div>
      <footer className={styles.footer}>
        <ShieldCheck size={14} aria-hidden="true" /> Pagamento processado pelo
        Banco Inter · Anuntech
      </footer>
    </main>
  );
}
