import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { publicInvoice } from "@/lib/payment-link";
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
          status: i.status as "issued" | "paid" | "cancelled",
          pix: i.pix,
          boletoLine: i.boletoLine,
        }}
        qr={qr}
        publicId={publicId}
        today={saoPauloDate()}
      />
    </main>
  );
}
