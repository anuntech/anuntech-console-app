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
