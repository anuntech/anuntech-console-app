import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { saoPauloDate } from "./dates";
import { db } from "./db";
import {
  invoices,
  companies,
  auditEvents,
  subscriptions,
  billingNotices,
} from "@/db/schema";
import { interApi, interBase, interToken, ProviderError } from "./integrations";
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
      if (i.amountCents < 250)
        throw new Error("O valor mínimo de uma cobrança Inter é R$ 2,50.");
      const today = saoPauloDate();
      if (i.dueDate <= today)
        throw new Error(
          "Escolha um vencimento a partir de amanhã para emitir pela Console.",
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
      if (sendNotifications)
        await tx
          .insert(billingNotices)
          .values(
            (["email", "whatsapp"] as const).map((channel) => ({
              id: crypto.randomUUID(),
              invoiceId: i.id,
              actorId,
              channel,
              kind: "initial" as const,
            })),
          )
          .onConflictDoNothing();
      const location = savedAddress.data;
      const data = {
        seuNumero: bankReference(i.id),
        valorNominal: i.amountCents / 100,
        dataVencimento: i.dueDate,
        numDiasAgenda,
        formasRecebimento: ["BOLETO", "PIX"],
        // Comunicação é controlada pela Console, sem e-mail/telefone enviado ao banco.
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
          publicId: randomBytes(32).toString("base64url"),
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
        "Solicitação aceita pelo Inter. Clique em consultar cobrança para obter boleto e Pix após o processamento.",
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
