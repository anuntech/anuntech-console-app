import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { companies, invoices } from "@/db/schema";
export function paymentUrl(publicId: string) {
  const url = new URL(process.env.BETTER_AUTH_URL!);
  if (
    url.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(url.hostname)
  )
    throw new Error("Configure o endereço público HTTPS.");
  return new URL(`/pagar/${publicId}`, url.origin).href;
}
export async function publicInvoice(publicId: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(publicId)) return null;
  const [row] = await db
    .select({
      id: invoices.id,
      publicId: invoices.publicId,
      company: companies.name,
      description: invoices.description,
      amountCents: invoices.amountCents,
      dueDate: invoices.dueDate,
      bankDueDate: invoices.bankDueDate,
      status: invoices.status,
      pix: invoices.pixCopyPaste,
      boletoLine: invoices.boletoLine,
      bankCheckedAt: invoices.bankCheckedAt,
      discountCents: invoices.discountCents,
      fineBps: invoices.fineBps,
      interestMonthlyBps: invoices.interestMonthlyBps,
    })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .where(
      and(
        eq(invoices.publicId, publicId),
        eq(invoices.publicEnabled, true),
        inArray(invoices.status, ["issued", "paid", "cancelled"]),
      ),
    );
  return row || null;
}
