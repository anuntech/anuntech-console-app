"use server";
import { db } from "../db";
import { locateUncertainCharge } from "./billing-locate";
import { resolveBankDueDate } from "./billing-notice-rules";
import { invoices, subscriptions, auditEvents, billingNotices, automationEvents } from "@/db/schema";
import { expiredDebtCondition } from "./billing-watch";
import { parseChargeTerms, parseTermsScope, sameTerms } from "./billing-terms";
import { and, eq, inArray, sql } from "drizzle-orm";
import { issueDate } from "./recurrence";
import { BILLING_SEND_HOUR, billingSendTime, saoPauloDate, saoPauloTime } from "../dates";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { publishInvoice } from "./billing-publish";
import { processBillingNotices } from "./billing-notices";
import { getActor } from "../access/access";
import { reconcileCharge } from "./billing-sync";
import { interApi, interBase, interToken, ProviderError } from "../integrations/integrations";
import { moneyToCents } from "../access/permissions";
import type { ActionState } from "../action-state";
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
        throw new Error("Recorrência não encontrada.");
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
          "Recorrência ativada. Cada cobrança é emitida 5 dias antes do vencimento (nas mensais, assim que a anterior é paga) e avisada por e-mail e WhatsApp 5 dias antes.",
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
 * "Confirmar recebimento fora do boleto": Inter shows the charge as marked
 * received by hand (MARCADO_RECEBIDO), not paid through the boleto or Pix.
 * The team confirms the money came in another way, with a note; only then
 * the invoice counts as paid. Nothing is sent to the bank.
 */
export async function confirmPaidOutside(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const id = uuid.parse(form.get("id"));
    const note = z.string().trim().min(3, "Diga como o pagamento entrou.").max(300).parse(form.get("note"));
    const done = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set({ status: "paid" })
        .where(and(eq(invoices.id, id), eq(invoices.status, "issued"), eq(invoices.bankStatus, "MARCADO_RECEBIDO")))
        .returning({ id: invoices.id, companyId: invoices.companyId });
      if (!row) return false;
      await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId: row.companyId, entityId: row.id, action: "invoice.paid_outside", details: { note } });
      return true;
    });
    if (!done) return { error: "Só uma cobrança em aberto que o Inter mostra como marcada como recebida pode ser confirmada assim." };
    refresh(id);
    return { success: "Recebimento confirmado. A fatura conta como paga e os lembretes param." };
  } catch (e) {
    return { error: e instanceof z.ZodError ? e.issues[0].message : "Não foi possível confirmar agora." };
  }
}

/** "Localizar no Inter": finds the charge of an issue that never got an answer, by its reference, and links it after the usual checks. */
export async function locateCharge(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const id = uuid.parse(form.get("id"));
    const result = await locateUncertainCharge(id, actor.user.id);
    if (!result.found) return { error: `${result.reason ?? "Cobrança não encontrada."} Nenhuma nova cobrança foi emitida.` };
    after(() => processBillingNotices());
    refresh(id);
    return { success: "Cobrança encontrada no Inter e ligada a esta fatura." };
  } catch {
    return { error: "Não foi possível consultar o Inter agora. Tente de novo; nenhuma nova cobrança foi emitida." };
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
      bankDueDate: z.union([z.iso.date(), z.literal("")]).default(""),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const amountCents = moneyToCents(input.amount);
  if (amountCents === null)
    return { error: "Informe um valor entre R$ 0,01 e R$ 9.999.999,99." };
  let terms;
  try {
    terms = parseChargeTerms(form, amountCents);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Confira o desconto, a multa e os juros." };
  }
  const scope = parseTermsScope(form);
  const [i] = await db.select().from(invoices).where(eq(invoices.id, input.id));
  if (!i || i.status !== "issued" || !i.providerId)
    return {
      error: "Somente cobranças emitidas e em aberto podem ser alteradas.",
    };
  const { id } = i;
  const currentTerms = {
    discountCents: i.discountCents,
    fineBps: i.fineBps,
    interestMonthlyBps: i.interestMonthlyBps,
  };
  if (scope === "all" && i.subscriptionId)
    await db.update(subscriptions).set(terms).where(eq(subscriptions.id, i.subscriptionId));
  const bank = resolveBankDueDate(
    { dueDate: input.dueDate, bankDueDate: input.bankDueDate, recurring: !!i.subscriptionId },
    saoPauloDate(),
  );
  if ("error" in bank) return { error: bank.error };
  if (
    amountCents === i.amountCents &&
    input.dueDate === i.dueDate &&
    bank.bankDueDate === i.bankDueDate &&
    sameTerms(terms, currentTerms)
  ) {
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
  let reissueLead: number | null = null;
  if (i.subscriptionId) {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, i.subscriptionId));
    if (sub && sub.status !== "active")
      return { error: "Retome a recorrência antes de reemitir esta cobrança." };
    // The next period belongs to the recurrence: moving this one onto it would leave a month without a charge.
    if (sub && input.dueDate >= sub.nextDueDate)
      return {
        error: `O vencimento ${sub.nextDueDate.split("-").reverse().join("/")} já é o próximo período da recorrência. Escolha uma data antes dele ou ajuste em Editar próximas cobranças.`,
      };
    reissueLead = sub?.leadDays ?? null;
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
        bankDueDate: bank.bankDueDate,
        ...terms,
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
        bankDueDate: i.bankDueDate,
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
  // The "Nova fatura" still waiting follows the new due date (5 days before it, at 08:00).
  if (!result.error && reissueLead !== null) {
    const usual = saoPauloTime(issueDate(input.dueDate, reissueLead), BILLING_SEND_HOUR);
    const morning = billingSendTime();
    await db
      .update(billingNotices)
      .set({ nextAttemptAt: usual > morning ? usual : morning })
      .where(and(eq(billingNotices.invoiceId, id), eq(billingNotices.kind, "initial"), eq(billingNotices.status, "waiting"), eq(billingNotices.attempts, 0)));
  }
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

/**
 * Cancels an open charge at Inter: the client who left, or the next period
 * issued early that will not be owed. Irreversible at the bank; the boleto and
 * the Pix stop working. The status here follows Inter's own answer.
 */
export async function cancelCharge(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  const parsed = z
    .object({
      id: uuid,
      reason: z.string().trim().max(50, "Use até 50 caracteres no motivo.").default(""),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, reason } = parsed.data;
  const [i] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!i || i.status !== "issued" || !i.providerId)
    return { error: "Só uma cobrança emitida e em aberto pode ser cancelada no Inter." };
  if (i.bankBase !== interBase()) return { error: "Esta cobrança pertence a outro ambiente Inter." };
  // Who asked is on record before the bank is called, whatever it answers.
  await db.insert(auditEvents).values({
    actorId: actor.user.id,
    companyId: i.companyId,
    action: "invoice.bank_cancel_requested",
    entityId: id,
    details: { providerId: i.providerId, reason: reason || null },
  });
  try {
    await interToken();
    await interApi(`/cobranca/v3/cobrancas/${encodeURIComponent(i.providerId)}/cancelar`, "POST", {
      motivoCancelamento: reason || "Cancelada pela Anuntech",
    });
  } catch (error) {
    try {
      await reconcileCharge(id, actor.user.id);
    } catch {
      /* The bank sync looks again within minutes. */
    }
    refresh(id);
    return {
      error:
        error instanceof ProviderError && error.status >= 400 && error.status < 500
          ? `O Inter recusou o cancelamento (${error.message}). Confira se a cobrança já foi paga ou baixada.`
          : "O Inter não confirmou o cancelamento. Consulte a cobrança no Inter antes de tentar de novo.",
    };
  }
  await db.transaction(async (tx) => {
    // Nothing more goes out about a charge the bank was told to cancel.
    await tx
      .update(billingNotices)
      .set({ status: "skipped", error: "Cobrança cancelada no Inter." })
      .where(and(eq(billingNotices.invoiceId, id), inArray(billingNotices.status, ["waiting", "pending"])));
    // A cancelled period must not be followed by the next one on its own: the recurrence waits for someone.
    if (i.subscriptionId) {
      const [paused] = await tx
        .update(subscriptions)
        .set({ status: "paused", lastError: "Cobrança cancelada no Inter. Retome a recorrência se o cliente continuar." })
        .where(and(eq(subscriptions.id, i.subscriptionId), eq(subscriptions.status, "active")))
        .returning({ id: subscriptions.id });
      if (paused)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: i.companyId,
          action: "subscription.status_changed",
          entityId: paused.id,
          details: { status: "paused", reason: "bank_cancel" },
        });
    }
  });
  let cancelled = false;
  try {
    await reconcileCharge(id, actor.user.id);
    const [after] = await db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, id));
    cancelled = after?.status === "cancelled";
  } catch {
    /* The bank sync confirms it within minutes. */
  }
  refresh(id);
  const recurrence = i.subscriptionId ? " A recorrência ficou pausada; retome se o cliente continuar." : "";
  return {
    success: cancelled
      ? `Cobrança cancelada no Inter. Boleto e Pix deixaram de valer e os avisos param.${recurrence}`
      : `O Inter recebeu o cancelamento. A situação muda aqui em instantes; os avisos desta fatura foram suspensos.${recurrence}`,
  };
}

/**
 * A debt Inter closed unpaid that will not be billed again (written off,
 * settled another way): the reason is kept, and it leaves the lists that
 * ask someone to act.
 */
export async function closeDebt(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  const parsed = z
    .object({ id: uuid, reason: z.string().trim().min(3, "Diga por que a dívida foi encerrada.").max(300, "Use até 300 caracteres.") })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, reason } = parsed.data;
  const closed = await db.transaction(async (tx) => {
    const [debt] = await tx
      .select({ id: invoices.id, companyId: invoices.companyId })
      .from(invoices)
      .where(and(eq(invoices.id, id), sql`${expiredDebtCondition}`))
      .for("update");
    if (!debt) return false;
    await tx.insert(automationEvents).values({ kind: "debt.closed", entityId: id, companyId: debt.companyId, actorId: actor.user.id, details: { reason } });
    await tx.insert(auditEvents).values({ actorId: actor.user.id, companyId: debt.companyId, action: "invoice.debt_closed", entityId: id, details: { reason } });
    return true;
  });
  if (!closed) return { error: "Esta dívida já foi cobrada de novo ou encerrada." };
  refresh(id);
  return { success: "Dívida encerrada. O motivo fica no histórico da fatura." };
}
