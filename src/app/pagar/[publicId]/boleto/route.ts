import { publicInvoice } from "@/lib/billing/payment-link";
import { db } from "@/lib/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { interApi, interBase } from "@/lib/integrations/integrations";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const publicRow = await publicInvoice(publicId);
  if (!publicRow || publicRow.status !== "issued" || !publicRow.boletoLine)
    return new Response(null, { status: 404 });
  try {
    const pdf = await db.transaction(async (tx) => {
      const [i] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, publicRow.id))
        .for("update");
      if (
        !i ||
        i.status !== "issued" ||
        !i.publicEnabled ||
        i.publicId !== publicId ||
        !i.providerId ||
        i.bankBase !== interBase()
      )
        throw Error();
      if (i.boletoPdf) return Buffer.from(i.boletoPdf, "base64");
      const result = (await interApi(
        `/cobranca/v3/cobrancas/${encodeURIComponent(i.providerId)}/pdf`,
      )) as { pdf?: string };
      if (!result.pdf) throw Error();
      const buffer = Buffer.from(result.pdf, "base64");
      if (
        buffer.subarray(0, 5).toString() !== "%PDF-" ||
        buffer.length > 6000000
      )
        throw Error();
      await tx
        .update(invoices)
        .set({ boletoPdf: result.pdf })
        .where(eq(invoices.id, i.id));
      return buffer;
    });
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="boleto-anuntech.pdf"',
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response(
      "Boleto ainda indisponível. Tente novamente em instantes.",
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
