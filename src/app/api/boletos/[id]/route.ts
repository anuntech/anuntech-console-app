import { getActor, canAccess } from "@/lib/access/access";
import { db } from "@/lib/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { interApi, interBase } from "@/lib/integrations/integrations";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  const { id } = await params;
  const [i] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (
    !i?.providerId ||
    !canAccess(actor, i.companyId, "finance") ||
    !["issued", "paid"].includes(i.status)
  )
    return new Response(null, { status: 404 });
  try {
    if (i.bankBase !== interBase()) return new Response(null, { status: 409 });
    const result = (await interApi(
      `/cobranca/v3/cobrancas/${encodeURIComponent(i.providerId)}/pdf`,
    )) as { pdf?: string };
    if (!result.pdf) throw new Error();
    const pdf = Buffer.from(result.pdf, "base64");
    if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error();
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="boleto-${i.id}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response(
      "Boleto ainda indisponível. Tente novamente mais tarde.",
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
