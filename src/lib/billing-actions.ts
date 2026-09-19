"use server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { saoPauloDate } from "./dates";
import { db } from "./db";
import { getActor } from "./access";
import { invoices, companies, auditEvents } from "@/db/schema";
import { interApi, interBase, interToken, ProviderError } from "./integrations";
import {
  payerAddress,
  bankReference,
  bankInvoiceStatus,
  bankCharge,
} from "./billing-rules";
import type { ActionState } from "./action-state";
const uuid = z.string().uuid();
function refresh(id: string) {
  revalidatePath(`/financeiro/${id}`);
  revalidatePath("/financeiro");
  revalidatePath("/painel");
}

export async function issueCharge(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  let lockedId: string | undefined;
  try {
    const id = uuid.parse(form.get("id"));
    if (form.get("confirm") !== "yes")
      return { error: "Confirme a emissão e confira os dados do pagador." };
    const numDiasAgenda = payerAddress.shape.numDiasAgenda.parse(
      form.get("numDiasAgenda"),
    );
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
        actorId: actor.user.id,
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
        })
        .where(and(eq(invoices.id, id), isNull(invoices.providerId)))
        .returning();
      if (i)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: i.companyId,
          action: "invoice.bank_accepted",
          entityId: id,
          details: { providerId: result.codigoSolicitacao },
        });
    });
    refresh(id);
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
      refresh(lockedId);
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

export async function syncCharge(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const id = uuid.parse(form.get("id"));
    const [i] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!i?.bankRequest || i.bankBase !== interBase())
      return { error: "Cobrança ausente ou pertence a outro ambiente Inter." };
    const providerId = uuid.parse(i.providerId || form.get("providerId"));
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
      return {
        error: "A cobrança retornada não corresponde aos dados desta fatura.",
      };
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
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: i.companyId,
        action: "invoice.bank_checked",
        entityId: id,
        details: { status: c.situacao },
      });
    });
    refresh(id);
    return { success: "Situação consultada diretamente no Inter." };
  } catch {
    return {
      error:
        "Não foi possível reconciliar a cobrança. Confira o código e tente consultar novamente; nenhuma nova cobrança foi emitida.",
    };
  }
}
