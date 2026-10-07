import "server-only";
import { interChargeTerms } from "./billing-terms";
import { enqueueBillingNotice } from "./billing-notice-queue";
import { randomBytes } from "node:crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { BILLING_SEND_HOUR, saoPauloDate, saoPauloTime } from "../dates";
import { issueDate } from "./recurrence";
import { db } from "../db";
import { invoices, companies, auditEvents, subscriptions } from "@/db/schema";
import { interApi, interBase, interToken, ProviderError } from "../integrations/integrations";
import { payerAddress, bankReference } from "./billing-rules";
import { advanceSubscription } from "./billing-publication";
const uuid = z.string().uuid();
export async function publishInvoice(
  id: string,
  actorId: string,
  numDiasAgenda: number,
  sendNotifications: boolean,
  activateRecurring: boolean,
  scheduled = false,
) {
  let lockedId: string | undefined;
  try {
    uuid.parse(id);
    payerAddress.shape.numDiasAgenda.parse(numDiasAgenda);
    await interToken(); // Não reserva a fatura quando a autenticação falha.
    const payload = await db.transaction(async (tx) => {
      const [i] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .for("update");
      if (!i || i.status !== "draft" || i.bankRequest || i.providerId)
        throw new Error("Esta fatura já tem uma tentativa de emissão.");
      let leadDays: number | null = null;
      if (i.amountCents < 250)
        throw new Error("O valor mínimo de uma cobrança Inter é R$ 2,50.");
      const today = saoPauloDate();
      // A past-due obligation goes to the bank with the boleto's own date.
      const payable = i.bankDueDate ?? i.dueDate;
      if (payable <= today)
        throw new Error(
          i.bankDueDate
            ? "A data para pagar já passou. Edite a fatura e informe uma nova data."
            : "Escolha um vencimento a partir de amanhã para emitir pelo Console.",
        );
      const [company] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, i.companyId));
      if (
        !company ||
        company.archived ||
        company.name.length > 100 ||
        !/^(\d{11}|\d{14})$/.test(company.document)
      )
        throw new Error(
          "Confira o cadastro do pagador (nome até 100 caracteres).",
        );
      const savedAddress = payerAddress
        .omit({ numDiasAgenda: true })
        .safeParse(company.billingAddress);
      if (!savedAddress.success)
        throw new Error(
          "Complete o endereço no cadastro do cliente antes de emitir a cobrança.",
        );
      if (i.subscriptionId) {
        const [sub] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.id, i.subscriptionId))
          .for("update");
        if (!sub || sub.status === "cancelled" || sub.status === "paused")
          throw new Error("A recorrência está pausada ou cancelada.");
        if (
          scheduled &&
          (sub.status !== "active" || sub.nextDueDate !== i.dueDate)
        )
          throw new Error("A recorrência não autoriza esta emissão.");
        if (!scheduled && !activateRecurring)
          throw new Error("Confirme a ativação da recorrência.");
        leadDays = sub.leadDays;
        await tx
          .update(subscriptions)
          .set({
            status: "active",
            lastError: null,
            collectionDays: numDiasAgenda,
          })
          .where(eq(subscriptions.id, sub.id));
      } else if (scheduled)
        throw new Error("Emissão automática exige recorrência.");
      // A recurring period issued early (the previous one was paid) is still announced on its usual day.
      const notBefore = scheduled && leadDays !== null ? saoPauloTime(issueDate(i.dueDate, leadDays), BILLING_SEND_HOUR) : undefined;
      if (sendNotifications)
        for (const channel of ["email", "whatsapp"] as const)
          await enqueueBillingNotice(
            tx,
            {
              invoiceId: i.id,
              companyId: i.companyId,
              actorId,
              channel,
              kind: "initial",
            },
            { notBefore },
          );
      const location = savedAddress.data;
      // Each reissue gets its own reference; the bank keeps the cancelled
      // charge under the previous one.
      const [{ reissues }] = await tx
        .select({ reissues: count() })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityId, i.id),
            eq(auditEvents.action, "invoice.bank_cancelled"),
          ),
        );
      const reference = bankReference(i.id);
      const data = {
        seuNumero: reissues
          ? `${reference.slice(0, 14)}${Math.min(reissues, 9)}`
          : reference,
        valorNominal: i.amountCents / 100,
        dataVencimento: payable,
        numDiasAgenda,
        ...interChargeTerms({
          discountCents: i.discountCents,
          fineBps: i.fineBps,
          interestMonthlyBps: i.interestMonthlyBps,
        }),
        formasRecebimento: ["BOLETO", "PIX"],
        // Comunicação é controlada pelo Console, sem e-mail/telefone enviado ao banco.
        pagador: {
          ...location,
          cpfCnpj: company.document,
          tipoPessoa: company.document.length === 14 ? "JURIDICA" : "FISICA",
          nome: company.name,
        },
      };
      await tx
        .update(invoices)
        .set({
          bankRequest: data,
          bankBase: interBase(),
          bankStatus: "ENVIANDO",
        })
        .where(eq(invoices.id, id));
      await tx.insert(auditEvents).values({
        actorId: actorId,
        companyId: i.companyId,
        action: "invoice.bank_requested",
        entityId: id,
      });
      return data;
    });
    lockedId = id;
    const result = z
      .object({ codigoSolicitacao: uuid })
      .parse(await interApi("/cobranca/v3/cobrancas", "POST", payload));
    await db.transaction(async (tx) => {
      const [i] = await tx
        .update(invoices)
        .set({
          providerId: result.codigoSolicitacao,
          status: "issued",
          bankStatus: "EM_PROCESSAMENTO",
          // A reissued charge keeps the link the client already received.
          publicId: sql`coalesce(${invoices.publicId}, ${randomBytes(32).toString("base64url")})`,
        })
        .where(and(eq(invoices.id, id), isNull(invoices.providerId)))
        .returning();
      if (i) await advanceSubscription(tx, i);
      if (i)
        await tx.insert(auditEvents).values({
          actorId: actorId,
          companyId: i.companyId,
          action: "invoice.bank_accepted",
          entityId: id,
          details: { providerId: result.codigoSolicitacao },
        });
    });

    return {
      success:
        "O Inter aceitou a solicitação. Depois do processamento, use Consultar cobrança no Inter para trazer o boleto e o Pix.",
    };
  } catch (error) {
    if (lockedId) {
      // Mesmo em timeout, não repetir POST: o banco pode ter aceitado a emissão.
      await db
        .update(invoices)
        .set({
          bankStatus:
            error instanceof ProviderError &&
            [400, 401, 403, 422].includes(error.status)
              ? "RECUSADA"
              : "RESPOSTA_INDEFINIDA",
        })
        .where(eq(invoices.id, lockedId));

      return {
        error:
          "A emissão não foi confirmada. A tentativa foi preservada para evitar duplicação. Consulte o Inter e informe o código da solicitação para reconciliar antes de criar outra cobrança.",
      };
    }
    return {
      error:
        error instanceof z.ZodError
          ? "Confira os campos obrigatórios e o prazo de cancelamento."
          : error instanceof Error
            ? error.message
            : "Não foi possível iniciar a emissão.",
    };
  }
}
