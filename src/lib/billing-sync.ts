import "server-only";
import { randomBytes } from "node:crypto";
import { advanceSubscription } from "./billing-publication";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { invoices, auditEvents } from "@/db/schema";
import { interApi, interBase } from "./integrations";
import { bankCharge, bankReference, bankInvoiceStatus } from "./billing-rules";

// Both manual and scheduled checks verify the charge directly with the bank.
export async function reconcileCharge(
  id: string,
  requestedActorId?: string,
  suppliedProviderId?: unknown,
  source: "manual" | "scheduled" = "manual",
) {
  const uuid = z.string().uuid();
  const [i] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!i?.bankRequest || i.bankBase !== interBase())
    throw new Error("Cobrança ausente ou pertence a outro ambiente Inter.");
  const providerId = uuid.parse(i.providerId || suppliedProviderId);
  const result = bankCharge.parse(
    await interApi(`/cobranca/v3/cobrancas/${providerId}`),
  );
  const c = result.cobranca;
  const payer = i.bankRequest.pagador as { cpfCnpj: string };
  // The reference sent to the bank; reissued charges carry a suffix.
  const reference =
    typeof i.bankRequest.seuNumero === "string"
      ? i.bankRequest.seuNumero
      : bankReference(i.id);
  if (
    c.codigoSolicitacao !== providerId ||
    c.seuNumero !== reference ||
    Math.round(Number(c.valorNominal) * 100) !== i.amountCents ||
    c.pagador.cpfCnpj.replace(/\D/g, "") !== payer.cpfCnpj
  )
    throw new Error(
      "A cobrança retornada não corresponde aos dados desta fatura.",
    );
  const actorId =
    requestedActorId ||
    (
      await db
        .select({ actorId: auditEvents.actorId })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityId, id),
            eq(auditEvents.action, "invoice.bank_requested"),
          ),
        )
        .limit(1)
    )[0]?.actorId;
  if (!actorId) throw new Error("Responsável pela emissão não encontrado.");
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .for("update");
    if (!current || (current.providerId && current.providerId !== providerId))
      throw new Error();
    // Preserve terminal states against a concurrent stale response.
    const next = bankInvoiceStatus(c.situacao);
    if (current.status === "paid" && next !== "paid") return;
    if (current.status === "cancelled" && next === "issued") return;
    // The authenticated bank is authoritative for the effective due date
    // (for example, Sunday rolls to Monday). Identity, reference, amount and
    // payer must still match. Keep the requested date in the immutable request.
    // A past-due obligation keeps its own due date; the bank's date is the boleto's.
    const field = current.bankDueDate ? "bankDueDate" : "dueDate";
    const known = current[field] as string;
    if (known !== (i[field] ?? i.dueDate) && c.dataVencimento !== known)
      return; // A concurrent reconciliation already applied a newer date.
    await tx
      .update(invoices)
      .set({
        providerId,
        publicId: current.publicId || randomBytes(32).toString("base64url"),
        status: next,
        bankStatus: c.situacao,
        bankCheckedAt: new Date(),
        [field]: c.dataVencimento,
        ...(known !== c.dataVencimento ||
        current.boletoLine !== (result.boleto?.linhaDigitavel || null)
          ? { boletoPdf: null }
          : {}),
        boletoLine: result.boleto?.linhaDigitavel || null,
        pixCopyPaste: result.pix?.pixCopiaECola || null,
      })
      .where(eq(invoices.id, id));
    await advanceSubscription(tx, {
      ...current,
      status: next,
      dueDate: current.bankDueDate
        ? current.dueDate
        : z.iso.date().parse(current.bankRequest!.dataVencimento),
    });
    if (known !== c.dataVencimento)
      await tx.insert(auditEvents).values({
        actorId,
        companyId: i.companyId,
        action: "invoice.bank_due_date_updated",
        entityId: id,
        details: {
          previousDueDate: known,
          dueDate: c.dataVencimento,
          field,
          source,
        },
      });
    if (
      source === "manual" ||
      current.bankStatus !== c.situacao ||
      current.status !== next
    )
      await tx.insert(auditEvents).values({
        actorId,
        companyId: i.companyId,
        action: "invoice.bank_checked",
        entityId: id,
        details: { status: c.situacao, source },
      });
  });
  return { id, bankStatus: c.situacao };
}
