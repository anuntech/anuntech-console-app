import "server-only";
import {
  getNoticePreferences,
  noticeEmails,
  noticePhones,
  whatsappDestination,
  lockCompanyNotifications,
} from "../notifications/notification-preferences";
import { enqueueBillingNotice } from "./billing-notice-queue";
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  billingNotices,
  invoices,
  companies,
  auditEvents,
  type BillingNoticePayload,
} from "@/db/schema";
import {
  billingEmailTemplate,
  billingEmailFrom,
} from "./billing-email-template";
import { paymentUrl } from "./payment-link";
import { reconcileCharge } from "./billing-sync";
import { saoPauloDate } from "../dates";
import { alertNoticeProblem } from "../notifications/ops-alerts";
import {
  billingTemplates,
  billingSender,
  billingChannelId,
  billingWhatsappParameters,
  noticeIsCurrent,
  daysOverdue,
  noticeDate,
  payableUntil,
  reminderKindFor,
} from "./billing-notice-rules";

const flwHeaders = () => ({
  Authorization: `Bearer ${(process.env.FLW_SYNOVA || "").replace(/^Bearer\s+/i, "")}`,
  "Content-Type": "application/json",
});
async function approvedTemplates() {
  const response = await fetch(
    "https://api.wts.chat/chat/v1/template?Name=cobran&PageSize=100",
    {
      headers: flwHeaders(),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw Error("Consulta do modelo indisponível.");
  const result = await response.json();
  return new Set<string>(
    (result.items || [])
      .filter(
        (t: {
          id: string;
          internalName: string;
          channelId: string;
          active: boolean;
          archived: boolean;
          status: string;
        }) =>
          t.active &&
          !t.archived &&
          t.status === "APPROVED" &&
          t.channelId === billingChannelId &&
          Object.values(billingTemplates).some(
            (expected) =>
              expected.id === t.id && expected.internalName === t.internalName,
          ),
      )
      .map((t: { id: string }) => t.id),
  );
}
export async function queueBillingReminders() {
  const today = saoPauloDate();
  const sources = await db
    .select({
      source: billingNotices,
      due: invoices.dueDate,
      bankDue: invoices.bankDueDate,
      companyId: invoices.companyId,
    })
    .from(billingNotices)
    .innerJoin(invoices, eq(invoices.id, billingNotices.invoiceId))
    .where(
      and(
        eq(billingNotices.kind, "initial"),
        eq(invoices.status, "issued"),
        or(
          and(lte(invoices.dueDate, today), sql`${invoices.dueDate} > ${today}::date - interval '30 days'`),
          // A migrated debt gets its "last day" reminder on the boleto's date.
          eq(invoices.bankDueDate, today),
        ),
      ),
    );
  const groups = new Map(
    sources.map((row) => [
      `${row.source.invoiceId}:${row.source.channel}`,
      row,
    ]),
  );
  for (const { source, due, bankDue, companyId } of groups.values()) {
    const kind = reminderKindFor({ dueDate: due, bankDueDate: bankDue }, today);
    if (kind)
      await db.transaction((tx) =>
        enqueueBillingNotice(tx, {
          invoiceId: source.invoiceId,
          actorId: source.actorId,
          channel: source.channel,
          companyId,
          kind,
        }),
      );
  }
}
export async function processBillingNotices(deadline = Date.now() + 180000) {
  // A worker interrupted after a WhatsApp POST cannot safely retry that POST.
  await db
    .update(billingNotices)
    .set({
      status: "uncertain",
      error:
        "Envio interrompido sem confirmação. Confira no Synova antes de reenviar.",
      lockedUntil: null,
    })
    .where(
      and(
        eq(billingNotices.status, "sending"),
        lte(billingNotices.lockedUntil, new Date()),
      ),
    );
  const pending = await db
    .select({ id: billingNotices.id })
    .from(billingNotices)
    .where(
      and(
        inArray(billingNotices.status, ["waiting", "pending"]),
        lte(billingNotices.nextAttemptAt, new Date()),
      ),
    )
    .orderBy(asc(billingNotices.nextAttemptAt))
    .limit(8);
  let templatesPromise: Promise<Set<string>> | undefined;
  for (const { id } of pending) {
    if (Date.now() > deadline) break;
    await processBillingNotice(
      id,
      () => (templatesPromise ??= approvedTemplates()),
    );
  }
}
export async function processBillingNotice(
  id: string,
  templates: () => Promise<Set<string>> = approvedTemplates,
) {
  const [notice] = await db
    .update(billingNotices)
    .set({
      lockedUntil: new Date(Date.now() + 120000),
      nextAttemptAt: new Date(Date.now() + 300000),
    })
    .where(
      and(
        eq(billingNotices.id, id),
        inArray(billingNotices.status, ["waiting", "pending"]),
        sql`(${billingNotices.lockedUntil} is null or ${billingNotices.lockedUntil} < now())`,
      ),
    )
    .returning();
  if (!notice) return;
  const save = async (fields: Partial<typeof billingNotices.$inferInsert>) => {
    await db
      .update(billingNotices)
      .set({ ...fields, lockedUntil: null })
      .where(eq(billingNotices.id, id));
    // A state nobody retries is something the Anuntech side must hear about now.
    if (fields.status && ["failed", "expired", "uncertain"].includes(fields.status)) await alertNoticeProblem(id);
  };
  let postingWhatsapp = false;
  let checkingBank = false;
  try {
    const load = async () =>
      (
        await db
          .select({ i: invoices, c: companies })
          .from(invoices)
          .innerJoin(companies, eq(companies.id, invoices.companyId))
          .where(eq(invoices.id, notice.invoiceId))
      )[0];
    let row = await load();
    const unavailable = () =>
      !row ||
      row.c.archived ||
      ["paid", "cancelled"].includes(row.i.status) ||
      !row.i.publicEnabled;
    if (unavailable()) {
      await save({
        status: "skipped",
        error:
          "Envio interrompido: fatura paga/cancelada, cliente arquivado ou link desativado.",
      });
      return;
    }
    let preferences = await getNoticePreferences(row.c.id, "billing");
    // Existing retries keep their original payload; every new notice has one recipient.
    const destination =
      notice.recipient ||
      (notice.payload
        ? Array.isArray(notice.payload.to)
          ? notice.payload.to[0]
          : notice.payload.to
        : notice.channel === "email"
          ? noticeEmails(preferences)[0]
          : noticePhones(preferences)[0]) ||
      "";
    const recipientAllowed = () =>
      notice.channel === "email"
        ? preferences.emailEnabled &&
          noticeEmails(preferences).includes(destination) &&
          (!notice.payload ||
            (Array.isArray(notice.payload.to) &&
              notice.payload.to.length === 1 &&
              notice.payload.to[0] === destination))
        : preferences.whatsappEnabled &&
          noticePhones(preferences).includes(
            whatsappDestination(destination),
          ) &&
          (!notice.payload ||
            (typeof notice.payload.to === "string" &&
              whatsappDestination(notice.payload.to) ===
                whatsappDestination(destination)));
    if (!recipientAllowed()) {
      await save({
        status: "skipped",
        error:
          "Canal desativado ou destinatário alterado nas preferências de notificações.",
      });
      return;
    }
    const today = saoPauloDate();
    if (row.i.status !== "issued" || !row.i.publicId) {
      await save({
        error: "Aguardando emissão e dados de pagamento do Inter.",
      });
      return;
    }
    if (notice.channel === "whatsapp") {
      if (!process.env.FLW_SYNOVA) {
        await save({
          status: "pending",
          error: "Configure a integração do Synova.",
        });
        return;
      }
      const template =
        billingTemplates[
          notice.kind.startsWith("overdue_")
            ? "overdue"
            : (notice.kind as "initial" | "due")
        ];
      if (!(await templates()).has(template.id)) {
        await save({
          status: "pending",
          error:
            "Modelo do WhatsApp em revisão ou indisponível. Aguardando aprovação no Synova.",
        });
        return;
      }
    } else {
      if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
        await save({
          status: "failed",
          error: "Configure o remetente e o Resend.",
        });
        return;
      }
      if (
        notice.firstAttemptAt &&
        Date.now() - notice.firstAttemptAt.getTime() > 23 * 3600000
      ) {
        await save({
          status: "expired",
          error:
            "Prazo seguro de repetição expirado. Confira o envio no Resend.",
        });
        return;
      }
    }
    // Always check the bank before sending, including after a provider wait/retry.
    checkingBank = true;
    await reconcileCharge(row.i.id, notice.actorId, undefined, "scheduled");
    checkingBank = false;
    row = await load();
    if (unavailable()) {
      await save({
        status: "skipped",
        error:
          "Envio interrompido após consulta ao Inter: cobrança indisponível ou liquidada.",
      });
      return;
    }
    await db.transaction(async (preferenceTx) => {
      await lockCompanyNotifications(preferenceTx, row.c.id);
      preferences = await getNoticePreferences(
        row.c.id,
        "billing",
        preferenceTx,
      );
      if (!recipientAllowed()) {
        await save({
          status: "skipped",
          error:
            "Preferências alteradas durante o processamento; envio interrompido.",
        });
        return;
      }
      if (notice.channel === "email") {
        const [suppressed] = await db
          .select({ id: billingNotices.id })
          .from(billingNotices)
          .where(
            and(
              eq(billingNotices.channel, "email"),
              inArray(billingNotices.providerStatus, [
                "bounced",
                "complained",
                "suppressed",
              ]),
              sql`${billingNotices.payload}->'to' @> ${JSON.stringify([destination])}::jsonb`,
            ),
          )
          .limit(1);
        if (suppressed) {
          await save({
            status: "failed",
            error:
              "O destinatário teve devolução ou bloqueio de e-mail. Revise o endereço no cadastro antes de novos envios.",
          });
          return;
        }
      }
      if (!row.i.pixCopyPaste && !row.i.boletoLine) {
        await save({ error: "Aguardando dados de pagamento do Inter." });
        return;
      }
      // Recheck the reminder against the date just confirmed by the bank.
      const anchor = noticeDate(notice.kind, row.i);
      if (!noticeIsCurrent(notice.kind, anchor, today)) {
        const future =
          notice.kind !== "initial" &&
          daysOverdue(anchor, today) <
            (notice.kind === "due"
              ? 0
              : Number(notice.kind.replace("overdue_", "")));
        await save({
          status: future ? "pending" : "skipped",
          error: future
            ? "Aviso aguardando a data confirmada pelo Inter."
            : "O prazo deste aviso terminou. Somente o aviso vigente poderá ser enviado.",
        });
        return;
      }
      const data = {
        name: row.c.name,
        description: row.i.description,
        amountCents: row.i.amountCents,
        dueDate: row.i.dueDate,
        payUntil: payableUntil(row.i),
        publicId: row.i.publicId!,
        today,
        kind: notice.kind,
      };
      let payload: BillingNoticePayload;
      if (notice.payload) payload = notice.payload;
      else if (notice.channel === "email")
        payload = {
          from: billingEmailFrom(process.env.EMAIL_FROM!),
          to: [destination],
          ...billingEmailTemplate({
            ...data,
            url: paymentUrl(data.publicId),
            issuerDocument: process.env.FOCUS_NFE_ISSUER_CNPJ,
          }),
        };
      else {
        let phone = destination.replace(/\D/g, "");
        if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
        if (!/^55\d{10,11}$/.test(phone)) {
          await save({
            status: "failed",
            error: "Confira o telefone brasileiro no cadastro do cliente.",
          });
          return;
        }
        payload = {
          from: billingSender,
          to: phone,
          templateId:
            billingTemplates[
              notice.kind.startsWith("overdue_")
                ? "overdue"
                : (notice.kind as "initial" | "due")
            ].id,
          parameters: billingWhatsappParameters(data),
          senderId: notice.id,
          options: { enableBot: false },
        };
      }
      // Freeze payload and persist attempt before crossing the network boundary.
      const [attempt] = await db
        .update(billingNotices)
        .set({
          payload,
          status: notice.channel === "whatsapp" ? "sending" : "pending",
          firstAttemptAt: notice.firstAttemptAt || new Date(),
          attempts: notice.attempts + 1,
        })
        .where(eq(billingNotices.id, id))
        .returning({
          payload: billingNotices.payload,
          round: billingNotices.firstAttemptAt,
        });
      postingWhatsapp = notice.channel === "whatsapp";
      const response = await fetch(
        postingWhatsapp
          ? "https://api.wts.chat/chat/v1/send/template"
          : "https://api.resend.com/emails",
        {
          method: "POST",
          redirect: "error",
          headers: postingWhatsapp
            ? flwHeaders()
            : {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
                // One key per round: automatic retries share it, so Resend
                // drops a repeat of an attempt that timed out after sending.
                // A manual resend clears firstAttemptAt and starts a new round.
                "Idempotency-Key": `invoice-${id}-${attempt.round!.getTime()}`,
              },
          body: JSON.stringify(attempt.payload),
          signal: AbortSignal.timeout(10000),
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.id) {
        await save({
          status:
            response.status === 429
              ? "pending"
              : response.status >= 400 && response.status < 500
                ? "failed"
                : postingWhatsapp
                  ? "uncertain"
                  : "pending",
          error: `${postingWhatsapp ? "Synova" : "Resend"} não confirmou o envio (HTTP ${response.status}).${postingWhatsapp && (response.ok || response.status >= 500) ? " Confira no provedor; não haverá reenvio automático." : ""}`,
        });
        return;
      }
      await db.transaction(async (tx) => {
        await tx
          .update(billingNotices)
          .set({
            status: ["FAILED", "DELETED"].includes(result.status)
              ? "failed"
              : "accepted",
            providerId: result.id,
            providerStatus:
              notice.channel === "email"
                ? "queued"
                : String(result.status || "QUEUED"),
            error: ["FAILED", "DELETED"].includes(result.status)
              ? "Provedor informou falha na mensagem. Confira a entrega no provedor."
              : null,
            lockedUntil: null,
          })
          .where(eq(billingNotices.id, id));
        await tx.insert(auditEvents).values({
          actorId: notice.actorId,
          companyId: row.i.companyId,
          action: "invoice.notice_processed",
          entityId: row.i.id,
          details: {
            channel: notice.channel,
            kind: notice.kind,
            providerId: result.id,
          },
        });
      });
    });
  } catch {
    await save({
      status: postingWhatsapp ? "uncertain" : "pending",
      error: postingWhatsapp
        ? "Envio ao Synova sem confirmação. Confira no provedor antes de reenviar."
        : checkingBank
          ? "Não foi possível confirmar os dados da cobrança no Inter. Os avisos aguardam essa confirmação."
          : "Consulta ou envio indisponível. Uma nova tentativa ocorrerá automaticamente.",
    });
  }
}
