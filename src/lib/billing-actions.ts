"use server";
import { db } from "./db";
import { invoices, subscriptions, auditEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { issueDate } from "./recurrence";
import { saoPauloDate } from "./dates";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { publishInvoice } from "./billing-publish";
import { processBillingNotices } from "./billing-notices";
import { getActor } from "./access";
import { reconcileCharge } from "./billing-sync";
import { interApi, interBase, interToken } from "./integrations";
import { moneyToCents } from "./permissions";
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
  try {
    const id = uuid.parse(form.get("id"));
    if (form.get("confirm") !== "yes")
      return { error: "Confirme a emissão e confira os dados do pagador." };
    const collectionDays = z.coerce
      .number()
      .int()
      .min(0)
      .max(60)
      .parse(form.get("numDiasAgenda"));
    const scheduled = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .for("update");
      if (!invoice?.subscriptionId) return false;
      if (form.get("activateRecurring") !== "yes")
        throw new Error("Confirme a recorrência.");
      const [sub] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, invoice.subscriptionId))
        .for("update");
      if (!sub || sub.status === "paused" || sub.status === "cancelled")
        throw new Error("Recorrência indisponível.");
      if (invoice.status !== "draft" || invoice.bankRequest) return false;
      if (issueDate(invoice.dueDate, sub.leadDays) <= saoPauloDate())
        return false;
      await tx
        .update(subscriptions)
        .set({ status: "active", lastError: null, collectionDays })
        .where(eq(subscriptions.id, sub.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: invoice.companyId,
        action: "subscription.activated",
        entityId: sub.id,
      });
      return true;
    });
    if (scheduled) {
      refresh(id);
      return {
        success:
          "Recorrência ativada. Esta cobrança e as próximas serão emitidas e enviadas por e-mail e WhatsApp 5 dias antes de cada vencimento.",
      };
    }
    const result = await publishInvoice(
      id,
      actor.user.id,
      collectionDays,
      form.get("sendNotifications") === "yes" ||
        form.get("activateRecurring") === "yes",
      form.get("activateRecurring") === "yes",
    );
    if (!result.error) {
      if (
        form.get("sendNotifications") === "yes" ||
        form.get("activateRecurring") === "yes"
      )
        after(async () => {
          try {
            await reconcileCharge(id, actor.user.id);
          } catch {
            /* Cron retries bank processing. */
          }
          await processBillingNotices();
        });
    }
    refresh(id);
    return result.error
      ? result
      : {
          success:
            form.get("sendNotifications") === "yes" ||
            form.get("activateRecurring") === "yes"
              ? "Cobrança publicada. Os avisos serão enviados com o link público quando os dados de pagamento estiverem prontos. WhatsApp depende do modelo aprovado."
              : "Cobrança publicada. O link público está disponível no detalhe da fatura.",
        };
  } catch {
    return { error: "Não foi possível publicar a cobrança. Confira os dados." };
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
    await reconcileCharge(id, actor.user.id, form.get("providerId"));
    after(() => processBillingNotices());
    refresh(id);
    return { success: "Situação consultada diretamente no Inter." };
  } catch {
    return {
      error:
        "Não foi possível reconciliar a cobrança. Confira o código e tente consultar novamente; nenhuma nova cobrança foi emitida.",
    };
  }
}

/**
 * Background check the invoice page runs on its own (on open, and while the
 * bank is still processing). No toast, no audit entry unless something
 * changed — `reconcileCharge` logs "scheduled" checks only on change.
 */
export async function refreshCharge(id: string): Promise<{ ok: boolean }> {
  const actor = await getActor();
  if (!actor.admin) return { ok: false };
  try {
    await reconcileCharge(uuid.parse(id), actor.user.id, undefined, "scheduled");
    after(() => processBillingNotices());
    refresh(id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Amount and due date live at the bank, so changing them means cancelling
 * the current charge at Inter and issuing a new one. The invoice keeps its
 * id and payment link; only the codes change. A description-only edit
 * never touches the bank.
 */
export async function reissueInvoice(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  const parsed = z
    .object({
      id: uuid,
      description: z
        .string()
        .trim()
        .min(1, "Preencha a descrição.")
        .max(1000, "A descrição excede o tamanho permitido."),
      amount: z.string().trim().max(20),
      dueDate: z.iso.date("Informe um vencimento válido."),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const amountCents = moneyToCents(input.amount);
  if (amountCents === null)
    return { error: "Informe um valor entre R$ 0,01 e R$ 9.999.999,99." };
  const [i] = await db.select().from(invoices).where(eq(invoices.id, input.id));
  if (!i || i.status !== "issued" || !i.providerId)
    return {
      error: "Somente cobranças emitidas e em aberto podem ser alteradas.",
    };
  const { id } = i;
  if (amountCents === i.amountCents && input.dueDate === i.dueDate) {
    if (input.description !== i.description) {
      await db
        .update(invoices)
        .set({ description: input.description })
        .where(eq(invoices.id, id));
      await db.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: i.companyId,
        action: "invoice.description_updated",
        entityId: id,
      });
    }
    refresh(id);
    return { success: "Descrição atualizada. Boleto e Pix continuam os mesmos." };
  }
  if (amountCents < 250)
    return { error: "O valor mínimo de uma cobrança Inter é R$ 2,50." };
  if (input.dueDate <= saoPauloDate())
    return { error: "Escolha um vencimento a partir de amanhã." };
  if (i.subscriptionId) {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, i.subscriptionId));
    if (sub && sub.status !== "active")
      return { error: "Retome a recorrência antes de reemitir esta cobrança." };
  }
  try {
    if (i.bankBase !== interBase())
      return { error: "Esta cobrança pertence a outro ambiente Inter." };
    await interToken();
    // The bank first: nothing changes here until the old charge is gone there.
    await interApi(
      `/cobranca/v3/cobrancas/${encodeURIComponent(i.providerId)}/cancelar`,
      "POST",
      { motivoCancelamento: "Reemitida com novo valor ou vencimento" },
    );
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? `Não foi possível cancelar a cobrança atual no Inter: ${error.message}`
          : "Não foi possível cancelar a cobrança atual no Inter.",
    };
  }
  const collectionDays = z.coerce
    .number()
    .int()
    .min(0)
    .max(60)
    .catch(30)
    .parse(i.bankRequest?.numDiasAgenda);
  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({
        description: input.description,
        amountCents,
        dueDate: input.dueDate,
        status: "draft",
        providerId: null,
        bankRequest: null,
        bankStatus: null,
        bankCheckedAt: null,
        boletoLine: null,
        pixCopyPaste: null,
        boletoPdf: null,
      })
      .where(eq(invoices.id, id));
    await tx.insert(auditEvents).values({
      actorId: actor.user.id,
      companyId: i.companyId,
      action: "invoice.bank_cancelled",
      entityId: id,
      details: {
        providerId: i.providerId,
        amountCents: i.amountCents,
        dueDate: i.dueDate,
        reason: "reissue",
      },
    });
  });
  const result = await publishInvoice(
    id,
    actor.user.id,
    collectionDays,
    false,
    !!i.subscriptionId,
  );
  refresh(id);
  if (result.error)
    return {
      error: `A cobrança anterior foi cancelada no Inter, mas a nova emissão não saiu: ${result.error}`,
    };
  after(async () => {
    try {
      await reconcileCharge(id, actor.user.id, undefined, "scheduled");
    } catch {
      /* Cron retries bank processing. */
    }
    await processBillingNotices();
  });
  return {
    success:
      "Cobrança reemitida. Boleto e Pix novos aparecem em instantes; o link de pagamento continua o mesmo.",
  };
}
