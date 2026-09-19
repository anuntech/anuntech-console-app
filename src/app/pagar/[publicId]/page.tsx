import { notFound } from "next/navigation";
import QRCode from "qrcode";
import Image from "next/image";
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
      <header>
        <Brand />
      </header>
      <section className={styles.card}>
        <p className={styles.eyebrow}>FATURA ANUNTECH</p>
        <h1>{i.description}</h1>
        <p className={styles.customer}>{i.company}</p>
        <p className={styles.amount}>{currency(i.amountCents)}</p>
        <p>
          Vencimento em <strong>{dateLabel(i.dueDate)}</strong>
        </p>
        {i.status === "paid" ? (
          <div className={styles.success}>
            <h2>Pagamento confirmado</h2>
            <p>Esta fatura já foi paga. Obrigado!</p>
          </div>
        ) : i.status === "cancelled" ? (
          <div className={styles.notice}>
            <h2>Fatura cancelada</h2>
            <p>Não é necessário pagar esta fatura.</p>
          </div>
        ) : (
          <>
            {qr && i.pix && (
              <section className={styles.method}>
                <h2>Pagar com Pix</h2>
                <p>
                  Leia o QR Code no aplicativo do seu banco ou copie o código.
                </p>
                <Image
                  unoptimized
                  src={qr}
                  alt="QR Code Pix desta fatura"
                  width={256}
                  height={256}
                  className={styles.qr}
                />
                <PaymentCode
                  value={i.pix}
                  label="Código Pix"
                  buttonLabel="Copiar código Pix"
                />
              </section>
            )}
            {i.boletoLine && (
              <section className={styles.method}>
                <h2>Pagar com boleto</h2>
                <PaymentCode
                  value={i.boletoLine}
                  label="Linha digitável"
                  buttonLabel="Copiar linha digitável"
                />
                <a
                  className="button primary"
                  href={`/pagar/${publicId}/boleto`}
                >
                  Baixar boleto PDF
                </a>
              </section>
            )}
            {!i.pix && !i.boletoLine && (
              <div className={styles.notice}>
                <h2>Preparando o pagamento</h2>
                <p>
                  O banco está processando esta cobrança. Atualize a página em
                  alguns instantes.
                </p>
              </div>
            )}
            <PaymentRefresh />
            <p className={styles.note}>
              Após o pagamento, a confirmação pode levar alguns minutos.
            </p>
          </>
        )}
      </section>
      <footer>Pagamento processado pelo Banco Inter · Anuntech</footer>
    </main>
  );
}
