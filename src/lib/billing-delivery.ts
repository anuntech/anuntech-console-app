import "server-only";
import { and, asc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db } from "./db";
import { billingNotices, invoices, auditEvents } from "@/db/schema";
export async function checkBillingDeliveries(deadline = Date.now() + 90000) {
  const rows = await db
    .select()
    .from(billingNotices)
    .where(
      and(
        isNotNull(billingNotices.providerId),
        or(
          eq(billingNotices.status, "accepted"),
          and(
            eq(billingNotices.channel, "email"),
            eq(billingNotices.status, "delivered"),
          ),
        ),
        lte(billingNotices.nextAttemptAt, new Date()),
        sql`${billingNotices.firstAttemptAt} > now() - interval '7 days'`,
      ),
    )
    .orderBy(asc(billingNotices.nextAttemptAt))
    .limit(10);
  for (const row of rows) {
    if (Date.now() > deadline) break;
    // Atomically claim the scheduled check; GET is harmless to retry.
    const [claimed] = await db
      .update(billingNotices)
      .set({
        nextAttemptAt: new Date(
          Date.now() + (row.status === "delivered" ? 1800000 : 300000),
        ),
      })
      .where(
        and(
          eq(billingNotices.id, row.id),
          lte(billingNotices.nextAttemptAt, new Date()),
          inArray(billingNotices.status, ["accepted", "delivered"]),
        ),
      )
      .returning({ id: billingNotices.id });
    if (!claimed) continue;
    try {
      const email = row.channel === "email";
      const response = await fetch(
        email
          ? `https://api.resend.com/emails/${encodeURIComponent(row.providerId!)}`
          : `https://api.wts.chat/chat/v1/send/message/${encodeURIComponent(row.providerId!)}`,
        {
          headers: {
            Authorization: `Bearer ${email ? process.env.RESEND_API_KEY : (process.env.FLW_SYNOVA || "").replace(/^Bearer\s+/i, "")}`,
          },
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.id !== row.providerId) throw Error();
      const event = String(email ? data.last_event : data.status);
      const failed = (
        email
          ? ["bounced", "complained", "failed", "suppressed", "canceled"]
          : ["FAILED", "DELETED"]
      ).includes(event);
      const delivered = (
        email ? ["delivered", "opened", "clicked"] : ["DELIVERED", "READ"]
      ).includes(event);
      const status = failed ? "failed" : delivered ? "delivered" : row.status;
      const diagnostic =
        email && Array.isArray(data.bounce?.diagnosticCode)
          ? data.bounce.diagnosticCode
              .filter((value: unknown) => typeof value === "string")
              .join(" ")
              .slice(0, 600)
          : "";
      const error = failed
        ? diagnostic.includes("5.7.193")
          ? "O grupo de e-mail do destinatário não permite remetentes externos (Microsoft 365, 550 5.7.193). Libere o recebimento externo ou corrija o e-mail financeiro."
          : `Entrega não concluída (${event}). Confira o destinatário e o provedor.${diagnostic ? ` Motivo: ${diagnostic}` : ""}`
        : event === "delivery_delayed"
          ? "O servidor do destinatário adiou a entrega. O Resend continuará tentando."
          : null;
      await db.transaction(async (tx) => {
        await tx
          .update(billingNotices)
          .set({ status, providerStatus: event, error })
          .where(eq(billingNotices.id, row.id));
        if (status !== row.status) {
          const [i] = await tx
            .select({ companyId: invoices.companyId })
            .from(invoices)
            .where(eq(invoices.id, row.invoiceId));
          await tx.insert(auditEvents).values({
            actorId: row.actorId,
            companyId: i.companyId,
            action: "invoice.notice_delivery",
            entityId: row.invoiceId,
            details: {
              channel: row.channel,
              kind: row.kind,
              status,
              providerStatus: event,
            },
          });
        }
      });
    } catch {
      await db
        .update(billingNotices)
        .set({
          error:
            "Consulta de entrega temporariamente indisponível; o envio não será repetido.",
        })
        .where(eq(billingNotices.id, row.id));
    }
  }
}
