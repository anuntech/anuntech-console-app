"use server";
import { enqueueBillingNotice } from "./billing-notice-queue";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getActor } from "./access";
import { db } from "./db";
import {
  invoices,
  billingNotices,
  subscriptions,
  auditEvents,
} from "@/db/schema";
import { processBillingNotices } from "./billing-notices";
import { saoPauloDate } from "./dates";
import type { ActionState } from "./action-state";

export async function sendInvoiceNotice(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const id = z.string().uuid().parse(form.get("id"));
    const channel = z.enum(["email", "whatsapp"]).parse(form.get("channel"));
    await db.transaction(async (tx) => {
      const [i] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .for("update");
      if (!i || i.status !== "issued")
        throw Error("Envie somente cobranças emitidas e em aberto.");
      if (!i.publicEnabled)
        throw Error("Ative o link público antes de enviar.");
      if (!i.publicId)
        await tx
          .update(invoices)
          .set({ publicId: randomBytes(32).toString("base64url") })
          .where(eq(invoices.id, id));
      await enqueueBillingNotice(
        tx,
        {
          invoiceId: id,
          companyId: i.companyId,
          actorId: actor.user.id,
          channel,
          kind: "initial",
        },
        { immediate: true },
      );
      await tx
        .update(billingNotices)
        .set({ status: "pending", nextAttemptAt: new Date() })
        .where(
          and(
            eq(billingNotices.invoiceId, id),
            eq(billingNotices.channel, channel),
            eq(billingNotices.kind, "initial"),
            eq(billingNotices.attempts, 0),
            eq(billingNotices.status, "failed"),
          ),
        );
    });
    after(() => processBillingNotices());
    revalidatePath(`/financeiro/${id}`);
    return {
      success:
        "Envio solicitado. A mensagem será enviada quando os dados de pagamento e o canal estiverem disponíveis.",
    };
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Não foi possível solicitar o envio.",
    };
  }
}
/** Requeues one delivery that already failed; automatic retry never revisits those. */
export async function resendBillingNotice(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const noticeId = z.string().uuid().parse(form.get("noticeId"));
    const invoiceId = await db.transaction(async (tx) => {
      const [notice] = await tx
        .select()
        .from(billingNotices)
        .where(eq(billingNotices.id, noticeId))
        .for("update");
      if (!notice) throw Error("Aviso não encontrado.");
      if (!["failed", "expired", "skipped", "uncertain"].includes(notice.status))
        throw Error(
          "Este aviso ainda está na fila ou já foi aceito pelo provedor.",
        );
      const [i] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, notice.invoiceId));
      if (!i || i.status !== "issued")
        throw Error("Reenvie somente cobranças emitidas e em aberto.");
      if (!i.publicEnabled)
        throw Error("Ative o link público antes de reenviar.");
      await tx
        .update(billingNotices)
        .set({
          status: "pending",
          error: null,
          nextAttemptAt: new Date(),
          // The e-mail channel gives up 23h after the first attempt.
          firstAttemptAt: null,
          lockedUntil: null,
          providerId: null,
          providerStatus: null,
        })
        .where(eq(billingNotices.id, noticeId));
      // Covers a recipient corrected in the notification preferences: the row
      // above keeps its frozen address, this adds one for each current contact.
      await enqueueBillingNotice(
        tx,
        {
          invoiceId: notice.invoiceId,
          companyId: i.companyId,
          actorId: actor.user.id,
          channel: notice.channel,
          kind: notice.kind,
        },
        { immediate: true },
      );
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: i.companyId,
        action: "invoice.notice_resent",
        entityId: noticeId,
        details: { channel: notice.channel, kind: notice.kind },
      });
      return notice.invoiceId;
    });
    after(() => processBillingNotices());
    revalidatePath(`/financeiro/${invoiceId}`);
    return { success: "Reenvio solicitado. A situação atualiza em instantes." };
  } catch (e) {
    return {
      error:
        e instanceof Error && e.message
          ? e.message
          : "Não foi possível reenviar o aviso.",
    };
  }
}
export async function changePaymentLink(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const id = z.string().uuid().parse(form.get("id"));
    const enabled = form.get("enabled") === "yes";
    await db.transaction(async (tx) => {
      const [i] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .for("update");
      if (!i || !["issued", "paid"].includes(i.status)) throw Error();
      await tx
        .update(invoices)
        .set({
          publicEnabled: enabled,
          publicId: i.publicId || randomBytes(32).toString("base64url"),
        })
        .where(eq(invoices.id, id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: i.companyId,
        action: "invoice.public_link_updated",
        entityId: id,
        details: { enabled },
      });
    });
    revalidatePath(`/financeiro/${id}`);
    return {
      success: enabled ? "Link público ativado." : "Link público desativado.",
    };
  } catch {
    return { error: "Não foi possível alterar o link." };
  }
}
export async function changeSubscription(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const id = z.string().uuid().parse(form.get("id"));
    const status = z
      .enum(["paused", "active", "cancelled"])
      .parse(form.get("status"));
    await db.transaction(async (tx) => {
      const [s] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
        .for("update");
      if (!s || !["active", "paused"].includes(s.status))
        throw Error("Publique a primeira fatura para ativar a assinatura.");
      if (status === "active" && s.nextDueDate <= saoPauloDate())
        throw Error("Revise o próximo vencimento antes de reativar.");
      await tx
        .update(subscriptions)
        .set({ status, lastError: null })
        .where(eq(subscriptions.id, id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: s.companyId,
        action: "subscription.status_changed",
        entityId: id,
        details: { status },
      });
    });
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/[id]", "page");
    return { success: "Recorrência atualizada." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Não foi possível atualizar.",
    };
  }
}

export async function updateSubscription(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const id = z.string().uuid().parse(form.get("id"));
    const description = z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .parse(form.get("description"));
    const dueDate = z.iso.date().parse(form.get("dueDate"));
    const { moneyToCents } = await import("./permissions");
    const amountCents = moneyToCents(String(form.get("amount") || ""));
    if (amountCents === null || amountCents < 250 || dueDate <= saoPauloDate())
      throw Error("Informe valor a partir de R$ 2,50 e vencimento futuro.");
    const { parseChargeTerms } = await import("./billing-terms");
    const terms = parseChargeTerms(form, amountCents);
    await db.transaction(async (tx) => {
      const [s] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
        .for("update");
      if (!s || s.status === "cancelled")
        throw Error("Assinatura indisponível.");
      const [i] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.subscriptionId, id),
            eq(invoices.dueDate, s.nextDueDate),
          ),
        )
        .for("update");
      const skipCancelled =
        i?.status === "cancelled" && !i.bankRequest && dueDate !== i.dueDate;
      if (
        i &&
        !skipCancelled &&
        (i.bankRequest || i.providerId || i.status !== "draft")
      )
        throw Error(
          "O período atual tem emissão ou cancelamento. Reconcilie a cobrança antes de alterar a assinatura.",
        );
      if (i && !skipCancelled)
        await tx
          .update(invoices)
          .set({ description, amountCents, dueDate, ...terms })
          .where(eq(invoices.id, i.id));
      await tx
        .update(subscriptions)
        .set({
          description,
          amountCents,
          nextDueDate: dueDate,
          anchorDay: Number(dueDate.slice(8)),
          anchorMonth: Number(dueDate.slice(5, 7)),
          lastError: null,
          ...terms,
        })
        .where(eq(subscriptions.id, id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: s.companyId,
        action: "subscription.updated",
        entityId: id,
      });
    });
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/[id]", "page");
    return {
      success:
        "Próximas cobranças atualizadas. Faturas já emitidas foram preservadas.",
    };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar a assinatura.",
    };
  }
}
