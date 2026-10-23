"use server";
import { enqueueBillingNotice } from "./billing-notice-queue";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getActor } from "../access/access";
import { db } from "../db";
import {
  auditEvents,
  automationEvents,
  billingNotices,
  engagements,
  invoices,
  subscriptions,
} from "@/db/schema";
import { addDays, missedPeriods } from "./recurrence";
import { processBillingNotices } from "./billing-notices";
import { saoPauloDate } from "../dates";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import { getNoticePreferences, noticeEmails, noticePhones } from "../notifications/notification-preferences";
import { RESEND_TOO_SOON, sentMomentsAgo } from "../notifications/resend-guard";

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
    if (logDatabaseFault("billing", e)) return { error: DATABASE_FAILURE };
    return {
      error:
        e instanceof Error ? e.message : "Não foi possível solicitar o envio.",
    };
  }
}
/**
 * Sends the open invoice again, now, to everyone who receives the company's
 * billing notices, by each channel the client keeps on. Worded for the
 * invoice's situation today (new, due today, overdue). The previous resend of
 * each recipient goes to the history and gives way to the new one; refused
 * within 5 minutes of the last resend, so a double click sends once.
 */
export async function resendInvoice(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const id = z.string().uuid().parse(form.get("id"));
    if (await sentMomentsAgo(id, ["invoice.resent"])) throw Error(RESEND_TOO_SOON);
    const sent = await db.transaction(async (tx) => {
      const [i] = await tx.select().from(invoices).where(eq(invoices.id, id)).for("update");
      if (!i || i.status !== "issued") throw Error("Reenvie somente cobranças emitidas e em aberto.");
      if (!i.publicEnabled) throw Error("Ative o link público antes de reenviar.");
      if (!i.publicId)
        await tx.update(invoices).set({ publicId: randomBytes(32).toString("base64url") }).where(eq(invoices.id, id));
      const preferences = await getNoticePreferences(i.companyId, "billing", tx);
      const channels = [
        ...(preferences.emailEnabled && noticeEmails(preferences).length ? (["email"] as const) : []),
        ...(preferences.whatsappEnabled && noticePhones(preferences).length ? (["whatsapp"] as const) : []),
      ];
      if (!channels.length)
        throw Error("Ninguém recebe os avisos de cobrança desta empresa. Cadastre os contatos do financeiro antes de reenviar.");
      const previous = await tx
        .select()
        .from(billingNotices)
        .where(and(eq(billingNotices.invoiceId, id), eq(billingNotices.kind, "resend")));
      if (previous.some((n) => ["waiting", "pending", "sending"].includes(n.status)))
        throw Error("O reenvio anterior ainda está saindo. A situação atualiza em instantes.");
      // Each resend is a new message (its own id goes to the provider); the last one stays in the audit log.
      if (previous.length)
        await tx.delete(billingNotices).where(and(eq(billingNotices.invoiceId, id), eq(billingNotices.kind, "resend")));
      for (const channel of channels)
        await enqueueBillingNotice(
          tx,
          { invoiceId: id, companyId: i.companyId, actorId: actor.user.id, channel, kind: "resend" },
          { immediate: true },
        );
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: i.companyId,
        action: "invoice.resent",
        entityId: id,
        details: {
          channels,
          previous: previous.map((n) => ({
            channel: n.channel,
            recipient: n.recipient,
            status: n.status,
            providerId: n.providerId,
            sentAt: n.firstAttemptAt?.toISOString() ?? null,
          })),
        },
      });
      return {
        emails: channels.includes("email") ? noticeEmails(preferences).length : 0,
        phones: channels.includes("whatsapp") ? noticePhones(preferences).length : 0,
      };
    });
    after(() => processBillingNotices());
    revalidatePath(`/financeiro/${id}`);
    const parts = [
      sent.emails ? `${sent.emails === 1 ? "1 e-mail" : `${sent.emails} e-mails`}` : null,
      sent.phones ? `${sent.phones === 1 ? "1 WhatsApp" : `${sent.phones} WhatsApps`}` : null,
    ].filter(Boolean);
    return { success: `Cobrança reenviada para ${parts.join(" e ")}. A situação atualiza em instantes.` };
  } catch (e) {
    if (logDatabaseFault("billing", e)) return { error: DATABASE_FAILURE };
    return { error: e instanceof Error && e.message ? e.message : "Não foi possível reenviar a cobrança." };
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
    if (logDatabaseFault("billing", e)) return { error: DATABASE_FAILURE };
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
    let drafted = 0;
    await db.transaction(async (tx) => {
      const [s] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
        .for("update");
      if (!s || !["active", "paused"].includes(s.status))
        throw Error("Publique a primeira fatura para ativar a recorrência.");
      const today = saoPauloDate();
      let nextDueDate = s.nextDueDate;
      if (status === "active" && s.nextDueDate <= today) {
        // Resumed late: the months that went by are listed in the dialog; each can become a one-time draft, never issued here.
        const catchUp = form.get("catchUp");
        if (catchUp !== "drafts" && catchUp !== "skip") throw Error("Revise o próximo vencimento antes de reativar.");
        const periods = missedPeriods(s, today);
        nextDueDate = periods.next;
        // The routine drafts a period before asking the bank: that draft is the period's, never a second one.
        const own = periods.missed.length
          ? await tx
              .select()
              .from(invoices)
              .where(and(eq(invoices.subscriptionId, s.id), inArray(invoices.dueDate, periods.missed), ne(invoices.status, "cancelled")))
              .for("update")
          : [];
        const tried = own.find((i) => i.bankRequest || i.providerId || i.status !== "draft");
        if (tried)
          throw Error(
            `O vencimento de ${tried.dueDate.split("-").reverse().join("/")} já foi enviado ao Inter. Abra essa fatura e reconcilie a cobrança antes de retomar.`,
          );
        for (const draft of own) {
          // Off the recurrence either way: cancelling it later must not pause the recurrence again.
          await tx
            .update(invoices)
            .set(catchUp === "drafts" ? { subscriptionId: null, bankDueDate: addDays(today, 7) } : { subscriptionId: null, status: "cancelled" })
            .where(eq(invoices.id, draft.id));
          await tx.insert(auditEvents).values({
            actorId: actor.user.id,
            companyId: s.companyId,
            action: catchUp === "drafts" ? "invoice.draft_updated" : "invoice.draft_cancelled",
            entityId: draft.id,
            details: { source: "catchup", subscriptionId: s.id, dueDate: draft.dueDate },
          });
          if (catchUp === "drafts") {
            await tx
              .insert(automationEvents)
              .values({ kind: "subscription.catchup", entityId: `${s.id}:${draft.dueDate}`, companyId: s.companyId, actorId: actor.user.id, details: { invoiceId: draft.id } })
              .onConflictDoNothing();
            drafted += 1;
          }
        }
        const covered = new Set(own.map((i) => i.dueDate));
        if (catchUp === "drafts")
          for (const due of periods.missed.filter((date) => !covered.has(date))) {
            const [claimed] = await tx
              .insert(automationEvents)
              .values({ kind: "subscription.catchup", entityId: `${s.id}:${due}`, companyId: s.companyId, actorId: actor.user.id })
              .onConflictDoNothing()
              .returning({ id: automationEvents.id });
            if (!claimed) continue;
            const [draft] = await tx
              .insert(invoices)
              .values({
                companyId: s.companyId,
                engagementId: s.engagementId,
                description: `${s.description} · vencimento de ${due.split("-").reverse().join("/")}`,
                amountCents: s.amountCents,
                dueDate: due,
                bankDueDate: addDays(today, 7),
                discountCents: s.discountCents,
                fineBps: s.fineBps,
                interestMonthlyBps: s.interestMonthlyBps,
              })
              .returning({ id: invoices.id });
            await tx
              .update(automationEvents)
              .set({ details: { invoiceId: draft.id } })
              .where(eq(automationEvents.id, claimed.id));
            await tx.insert(auditEvents).values({
              actorId: actor.user.id,
              companyId: s.companyId,
              action: "invoice.drafted",
              entityId: draft.id,
              details: { source: "catchup", subscriptionId: s.id, dueDate: due },
            });
            drafted += 1;
          }
      }
      await tx
        .update(subscriptions)
        .set({ status, lastError: null, nextDueDate })
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
    return {
      success: drafted
        ? `Recorrência retomada. ${drafted === 1 ? "1 rascunho criado" : `${drafted} rascunhos criados`} para os vencimentos que ficaram sem cobrança; confira e emita cada um.`
        : "Recorrência atualizada.",
    };
  } catch (e) {
    if (logDatabaseFault("billing", e)) return { error: DATABASE_FAILURE };
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
    const { moneyToCents } = await import("../access/permissions");
    const amountCents = moneyToCents(String(form.get("amount") || ""));
    if (amountCents === null || amountCents < 250 || dueDate <= saoPauloDate())
      throw Error("Informe valor a partir de R$ 2,50 e vencimento futuro.");
    const { parseChargeTerms } = await import("./billing-terms");
    const terms = parseChargeTerms(form, amountCents);
    // Only the edit sheet carries the switch; any other caller leaves it as it is.
    const issueOnPayment = form.has("issueOnPaymentField") ? form.get("issueOnPayment") === "yes" : undefined;
    const issuedAhead = await db.transaction(async (tx) => {
      const [s] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
        .for("update");
      if (!s || s.status === "cancelled")
        throw Error("Recorrência não encontrada.");
      // The next due date must come after the last period already at the bank (issued or paid), never inside it.
      // The date asked of the bank: Inter may move a weekend due date into the next month.
      const asked = sql<string>`coalesce((${invoices.bankRequest}->>'dataVencimento')::date, ${invoices.dueDate})::text`;
      const [last] = await tx
        .select({ dueDate: asked })
        .from(invoices)
        .where(and(eq(invoices.subscriptionId, id), inArray(invoices.status, ["issued", "paid"])))
        .orderBy(desc(asked))
        .limit(1);
      if (
        last &&
        (dueDate <= last.dueDate ||
          (s.interval === "monthly" ? dueDate.slice(0, 7) === last.dueDate.slice(0, 7) : dueDate.slice(0, 4) === last.dueDate.slice(0, 4)))
      )
        throw Error(
          `A fatura de ${last.dueDate.split("-").reverse().join("/")} já está no Inter. Escolha um vencimento depois desse período, ou abra essa fatura e use Editar.`,
        );
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
          "O período atual tem emissão ou cancelamento. Reconcilie a cobrança antes de alterar a recorrência.",
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
          ...(issueOnPayment === undefined ? {} : { issueOnPayment }),
          ...terms,
        })
        .where(eq(subscriptions.id, id));
      await tx
        .update(engagements)
        .set({ amountCents })
        .where(eq(engagements.subscriptionId, id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: s.companyId,
        action: "subscription.updated",
        entityId: id,
        details: issueOnPayment === undefined ? undefined : { issueOnPayment },
      });
      // A period already at the bank keeps its amount and date until it is reissued.
      const [open] = await tx
        .select({ dueDate: invoices.dueDate, amountCents: invoices.amountCents })
        .from(invoices)
        .where(and(eq(invoices.subscriptionId, id), eq(invoices.status, "issued"), gte(invoices.dueDate, saoPauloDate())))
        .orderBy(desc(invoices.dueDate))
        .limit(1);
      return open && open.amountCents !== amountCents ? open : null;
    });
    revalidatePath("/produtos");
    revalidatePath("/financeiro");
    revalidatePath("/financeiro/[id]", "page");
    return {
      success: issuedAhead
        ? `Próximas cobranças atualizadas. A fatura de ${issuedAhead.dueDate.split("-").reverse().join("/")} já está no Inter com o valor anterior; para mudar, abra essa fatura e use Editar.`
        : "Próximas cobranças atualizadas. Faturas já emitidas foram preservadas.",
    };
  } catch (e) {
    if (logDatabaseFault("billing", e)) return { error: DATABASE_FAILURE };
    return {
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível atualizar a recorrência.",
    };
  }
}
