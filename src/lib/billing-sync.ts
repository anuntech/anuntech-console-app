import "server-only";
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
  if (
    c.codigoSolicitacao !== providerId ||
    c.seuNumero !== bankReference(i.id) ||
    Math.round(Number(c.valorNominal) * 100) !== i.amountCents ||
    c.dataVencimento !== i.dueDate ||
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
    await tx
      .update(invoices)
      .set({
        providerId,
        status: next,
        bankStatus: c.situacao,
        bankCheckedAt: new Date(),
        boletoLine: result.boleto?.linhaDigitavel || null,
        pixCopyPaste: result.pix?.pixCopiaECola || null,
      })
      .where(eq(invoices.id, id));
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
