import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { publicInvoice } from "@/lib/billing/payment-link";
import { invoiceDebt } from "@/lib/billing/invoice-debt";
import { saoPauloDate } from "@/lib/dates";
import { PaymentView } from "@/components/pagar/payment-view";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pagar fatura",
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
  const debt = await invoiceDebt(i);
  const qr =
    i.status === "issued" && i.pix
      ? await QRCode.toDataURL(i.pix, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: "M",
        })
      : null;
  return (
    <main id="main-content" tabIndex={-1} className="min-h-svh bg-background">
      <PaymentView
        invoice={{
          description: i.description,
          company: i.company,
          amountCents: i.amountCents,
          dueDate: i.dueDate,
          bankDueDate: i.bankDueDate,
          status: i.status as "issued" | "paid" | "cancelled",
          // Written off counts as cancelled: nothing left to pay.
          closure: debt?.state === "open" ? "expired" : debt?.state === "rebilled" ? "replaced" : null,
          pix: i.pix,
          boletoLine: i.boletoLine,
          terms: {
            discountCents: i.discountCents,
            fineBps: i.fineBps,
            interestMonthlyBps: i.interestMonthlyBps,
          },
        }}
        qr={qr}
        publicId={publicId}
        today={saoPauloDate()}
      />
    </main>
  );
}
