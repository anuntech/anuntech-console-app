import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull, ne, lt, lte, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "./db";
import { companies, tickets, ticketNotices } from "@/db/schema";
import {
  lockTicketNotifications,
  ticketNotificationsEnabled,
} from "./notification-settings";
import {
  getNoticePreferences,
  noticeEmails,
  noticePhones,
  preferenceKey,
  whatsappDestination,
  lockCompanyNotifications,
} from "./notification-preferences";
import { APP_LOCALE, APP_TIME_ZONE } from "./dates";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Notice = typeof ticketNotices.$inferSelect;
const activeStatuses = ["pending", "processing", "accepted", "sent"];
const delay = (minutes: number) => new Date(Date.now() + minutes * 60000);
// Runs in the same transaction as the ticket mutation. No external I/O here.
export async function enqueueTicketNotice(
  tx: Tx,
  eventId: string,
  ticket: { id: string; companyId: string; subject: string },
  actorName: string,
  movement: string,
  /** Receipt for whoever performed the movement, independent of the company's
      ticket preferences — those address the company's contacts, not the author. */
  author?: { email: string } | null,
) {
  await lockTicketNotifications(tx);
  const operationalEnabled = await ticketNotificationsEnabled(tx);
  const [company] = await tx
    .select({ name: companies.name, archived: companies.archived })
    .from(companies)
    .where(eq(companies.id, ticket.companyId));
  if (!company || company.archived) return;
  const recipients = await Promise.all(
    (operationalEnabled ? [null, ticket.companyId] : [ticket.companyId]).map(
      async (companyId) => ({
        key: preferenceKey(companyId, "tickets"),
        preferences: await getNoticePreferences(companyId, "tickets", tx),
      }),
    ),
  );
  const base =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    "https://console.anuntech.com";
  const when = new Intl.DateTimeFormat(APP_LOCALE, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(new Date());
  const queued: (typeof ticketNotices.$inferInsert)[] = [];
  for (const { key, preferences } of recipients) {
    if (
      key !== "console:tickets" &&
      !preferences.emailEnabled &&
      !preferences.whatsappEnabled
    )
      continue;
    for (const email of noticeEmails(preferences).length
      ? noticeEmails(preferences)
      : [""]) {
      queued.push({
        id: randomUUID(),
        preferenceKey: key,
        eventId,
        ticketId: ticket.id,
        channel: "email",
        destination: email,
        ...(!preferences.emailEnabled || !email
          ? {
              status: "cancelled",
              error: "E-mail desativado ou sem destinatário nas preferências.",
            }
          : {}),
        payload: {
          from: process.env.EMAIL_FROM || "",
          to: email,
          subject: `${movement} · ${ticket.subject}`,
          text: `${movement}\n\nCliente: ${company.name}\nChamado: ${ticket.subject}\nResponsável pela movimentação: ${actorName}\nData: ${when} (São Paulo)\n\nAcompanhar no Console: ${base}/chamados/${ticket.id}\n\nAnuntech Console`,
        },
      });
    }
    for (const destination of noticePhones(preferences).length
      ? noticePhones(preferences)
      : [""]) {
      const id = randomUUID(),
        phone = destination ? `+${destination}` : "";
      queued.push({
        id,
        preferenceKey: key,
        eventId,
        ticketId: ticket.id,
        channel: "whatsapp",
        destination: phone,
        ...(!preferences.whatsappEnabled || !phone
          ? {
              status: "cancelled",
              error:
                "WhatsApp desativado ou sem destinatário nas preferências.",
            }
          : {}),
        payload: {
          from: process.env.FLW_SENDER_NUMBER || "",
          to: destination,
          templateId: process.env.FLW_TICKET_TEMPLATE_ID || "",
          parameters: { "[nome_do_cliente]": company.name },
          senderId: id,
          options: { enableBot: false },
        },
      });
    }
  }
  const authorEmail = author?.email?.trim().toLowerCase();
  if (authorEmail)
    queued.push({
      id: randomUUID(),
      // Not "console:tickets" nor a company key: the Console toggle and the
      // company preferences must not cancel someone's own receipt.
      preferenceKey: "author:tickets",
      eventId,
      ticketId: ticket.id,
      channel: "email",
      destination: authorEmail,
      payload: {
        from: process.env.EMAIL_FROM || "",
        to: authorEmail,
        subject: `${movement} · ${ticket.subject}`,
        text: `${movement}\n\nRecebemos o seu chamado e a equipe da Anuntech já foi avisada.\n\nEmpresa: ${company.name}\nChamado: ${ticket.subject}\nData: ${when} (São Paulo)\n\nAcompanhe e responda no Console: ${base}/chamados/${ticket.id}\n\nAnuntech Console`,
      },
    });
  if (queued.length)
    await tx
      .insert(ticketNotices)
      .values(
        queued.sort(
          (a, b) =>
            Number(a.status === "cancelled") - Number(b.status === "cancelled"),
        ),
      )
      .onConflictDoNothing();
}

export function scheduleTicketNotices() {
  after(async () => {
    try {
      await processTicketNotices();
    } catch {
      console.error(
        "Não foi possível processar os avisos de chamados; a fila será retomada.",
      );
    }
  });
}
async function save(
  row: Notice,
  changes: Partial<typeof ticketNotices.$inferInsert>,
  connection: Tx,
) {
  await connection
    .update(ticketNotices)
    .set({ ...changes, lockedAt: null, updatedAt: new Date() })
    .where(eq(ticketNotices.id, row.id));
}
function flwHeaders() {
  return {
    Authorization: `Bearer ${process.env.FLW_SYNOVA?.replace(/^Bearer\s+/i, "")}`,
    "Content-Type": "application/json",
  };
}
async function approvedTemplates() {
  const r = await fetch(
    "https://api.wts.chat/chat/v1/template?Name=chamado&PageSize=100",
    {
      headers: flwHeaders(),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!r.ok)
    throw new Error("Não foi possível consultar a aprovação do modelo no FLW.");
  const data = await r.json();
  if (!Array.isArray(data.items))
    throw new Error("Resposta de modelos inválida.");
  return new Set<string>(
    data.items
      .filter(
        (t: { active: boolean; archived: boolean; status: string }) =>
          t.active && !t.archived && t.status?.toUpperCase() === "APPROVED",
      )
      .map((t: { id: string }) => t.id),
  );
}
async function currentRecipient(
  row: Notice,
  connection: Pick<typeof db, "select"> = db,
) {
  const [ticket] = await connection
    .select({ companyId: tickets.companyId, archived: companies.archived })
    .from(tickets)
    .innerJoin(companies, eq(companies.id, tickets.companyId))
    .where(eq(tickets.id, row.ticketId));
  if (!ticket || ticket.archived) return false;
  // A receipt belongs to the person who acted, not to a configured contact
  // list, so the company preferences below don't apply to it.
  if (row.preferenceKey === "author:tickets") return true;
  const companyId =
    row.preferenceKey && row.preferenceKey !== "console:tickets"
      ? ticket.companyId
      : null;
  const preferences = await getNoticePreferences(
    companyId,
    "tickets",
    connection,
  );
  return row.channel === "email"
    ? preferences.emailEnabled &&
        noticeEmails(preferences).includes(row.destination)
    : preferences.whatsappEnabled &&
        noticePhones(preferences).includes(
          whatsappDestination(row.destination),
        );
}
async function sendEmail(row: Notice, connection: Tx) {
  if (!process.env.RESEND_API_KEY || !row.payload.from || !row.destination) {
    await save(
      row,
      {
        status: "pending",
        nextAttemptAt: delay(5),
        error: "Configure o e-mail do administrador e o Resend.",
      },
      connection,
    );
    return;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ticket-${row.id}`,
      },
      body: JSON.stringify(row.payload),
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json().catch(() => null);
    if (r.ok && data?.id) {
      await save(
        row,
        {
          status: "accepted",
          providerId: data.id,
          providerStatus: "accepted",
          error: null,
        },
        connection,
      );
      return;
    }
    const retry = r.status === 429 || r.status >= 500 || r.ok;
    await save(
      row,
      {
        status: retry ? "pending" : "failed",
        nextAttemptAt: delay(Math.min(60, 2 ** Math.min(row.attempts, 6))),
        error: `Resend não confirmou o envio (HTTP ${r.status}).`,
      },
      connection,
    );
  } catch {
    await save(
      row,
      {
        status: "pending",
        nextAttemptAt: delay(5),
        error:
          "Resposta do Resend não confirmada; a nova tentativa usará a mesma chave de envio.",
      },
      connection,
    );
  }
}
async function sendWhatsapp(
  row: Notice,
  templates: () => Promise<Set<string>>,
  connection: Tx,
) {
  if (!process.env.FLW_SYNOVA || !row.payload.from || !row.payload.templateId) {
    await save(
      row,
      {
        status: "pending",
        nextAttemptAt: delay(5),
        error: "Configure remetente e modelo de chamados no FLW.",
      },
      connection,
    );
    return;
  }
  try {
    if (!(await templates()).has(row.payload.templateId)) {
      await save(
        row,
        {
          status: "pending",
          nextAttemptAt: delay(5),
          error:
            "Modelo de WhatsApp ainda não aprovado ou indisponível no FLW.",
        },
        connection,
      );
      return;
    }
  } catch {
    await save(
      row,
      {
        status: "pending",
        nextAttemptAt: delay(5),
        error: "Aguardando consulta de aprovação do modelo no FLW.",
      },
      connection,
    );
    return;
  }
  // FLW documents senderId as correlation, not as a deduplication guarantee.
  // An ambiguous POST must never be blindly retried.
  // The claim commits the attempt marker before any network I/O. A worker
  // crash must never roll it back and allow an ambiguous WhatsApp resend.
  try {
    const r = await fetch("https://api.wts.chat/chat/v1/send/template", {
      method: "POST",
      redirect: "error",
      headers: flwHeaders(),
      body: JSON.stringify(row.payload),
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json().catch(() => null);
    if (r.ok && data?.id) {
      const state = whatsappState(data.status);
      await save(
        row,
        {
          status: state,
          providerId: data.id,
          providerStatus: String(data.status || "UNKNOWN"),
          nextAttemptAt: delay(5),
          error:
            state === "failed"
              ? "O FLW informou falha na mensagem. Consulte o provedor."
              : null,
        },
        connection,
      );
      return;
    }
    await save(
      row,
      {
        status:
          r.status === 429
            ? "pending"
            : r.status >= 400 && r.status < 500
              ? "failed"
              : "uncertain",
        nextAttemptAt: delay(5),
        error: `FLW não confirmou o envio (HTTP ${r.status}).${r.status >= 500 || r.ok ? " Confira no provedor antes de reenviar." : ""}`,
      },
      connection,
    );
  } catch {
    await save(
      row,
      {
        status: "uncertain",
        error:
          "Envio ao FLW sem confirmação. Confira no provedor antes de reenviar.",
      },
      connection,
    );
  }
}
function whatsappState(status: string) {
  if (status === "DELIVERED") return "delivered";
  if (status === "READ") return "read";
  if (status === "FAILED" || status === "DELETED") return "failed";
  if (status === "SENT") return "sent";
  return "accepted";
}
async function checkWhatsapp(row: Notice, connection: Tx) {
  try {
    const r = await fetch(
      `https://api.wts.chat/chat/v1/send/message/${encodeURIComponent(row.providerId!)}`,
      {
        headers: flwHeaders(),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    const data = await r.json().catch(() => null);
    if (r.ok && data?.id === row.providerId) {
      const status = whatsappState(data.status);
      await save(
        row,
        {
          status,
          providerStatus: String(data.status || "UNKNOWN"),
          nextAttemptAt: delay(5),
          error:
            status === "failed"
              ? "O FLW informou falha na entrega. Consulte o provedor."
              : null,
        },
        connection,
      );
    } else
      await save(
        row,
        {
          status: row.status,
          nextAttemptAt: delay(5),
          error: "Não foi possível consultar a situação no FLW.",
        },
        connection,
      );
  } catch {
    await save(
      row,
      {
        status: row.status,
        nextAttemptAt: delay(5),
        error: "Consulta de entrega temporariamente indisponível.",
      },
      connection,
    );
  }
}

export async function processTicketNotices() {
  const operationalEnabled = await ticketNotificationsEnabled();
  // Recover interrupted workers. Email may retry within Resend's 24-hour key TTL.
  const stale = new Date(Date.now() - 5 * 60000);
  await db
    .update(ticketNotices)
    .set({ status: "pending", lockedAt: null, nextAttemptAt: new Date() })
    .where(
      and(
        eq(ticketNotices.status, "processing"),
        eq(ticketNotices.channel, "email"),
        lt(ticketNotices.lockedAt, stale),
      ),
    );
  await db
    .update(ticketNotices)
    .set({
      status: sql`CASE WHEN ${ticketNotices.providerId} IS NOT NULL THEN 'accepted' WHEN ${ticketNotices.attempts}=0 THEN 'pending' ELSE 'uncertain' END`,
      lockedAt: null,
      error: "Processamento interrompido. Confira no FLW antes de reenviar.",
    })
    .where(
      and(
        eq(ticketNotices.status, "processing"),
        eq(ticketNotices.channel, "whatsapp"),
        lt(ticketNotices.lockedAt, stale),
      ),
    );
  await db
    .update(ticketNotices)
    .set({
      status: "expired",
      error: "Prazo de 23 horas para envio seguro expirou.",
      lockedAt: null,
    })
    .where(
      and(
        inArray(ticketNotices.status, ["pending"]),
        lt(ticketNotices.createdAt, new Date(Date.now() - 23 * 3600000)),
      ),
    );
  let templatesPromise: Promise<Set<string>> | undefined;
  const templates = () => (templatesPromise ??= approvedTemplates());
  const started = Date.now();
  let processed = 0;
  for (let i = 0; i < 10 && Date.now() - started < 40000; i++) {
    const row = await db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(ticketNotices)
        .where(
          and(
            inArray(
              ticketNotices.status,
              activeStatuses.filter((s) => s !== "processing"),
            ),
            lte(ticketNotices.nextAttemptAt, new Date()),
            operationalEnabled
              ? undefined
              : and(
                  isNotNull(ticketNotices.preferenceKey),
                  ne(ticketNotices.preferenceKey, "console:tickets"),
                ),
            sql`(${ticketNotices.status}='pending' OR (${ticketNotices.channel}='whatsapp' AND ${ticketNotices.createdAt}>now()-interval '23 hours'))`,
            sql`${ticketNotices.lockedAt} IS NULL`,
          ),
        )
        .orderBy(ticketNotices.nextAttemptAt)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!candidate) return null;
      await tx
        .update(ticketNotices)
        .set({
          status: "processing",
          lockedAt: new Date(),
          attempts: candidate.attempts + 1,
        })
        .where(eq(ticketNotices.id, candidate.id));
      return candidate;
    });
    if (!row) break;
    await db.transaction(async (tx) => {
      await lockTicketNotifications(tx);
      const [claimed] = await tx
        .select({ status: ticketNotices.status })
        .from(ticketNotices)
        .where(eq(ticketNotices.id, row.id));
      if (claimed?.status !== "processing") return;
      const operational =
        !row.preferenceKey || row.preferenceKey === "console:tickets";
      if (!operational) {
        const [ticket] = await tx
          .select({ companyId: tickets.companyId })
          .from(tickets)
          .where(eq(tickets.id, row.ticketId));
        if (ticket) await lockCompanyNotifications(tx, ticket.companyId);
      }
      if (operational && !(await ticketNotificationsEnabled(tx))) {
        await save(
          row,
          {
            status: row.providerId ? row.status : "cancelled",
            error: "Notificações desativadas.",
          },
          tx,
        );
        return;
      }
      if (row.channel === "whatsapp" && row.providerId)
        await checkWhatsapp(row, tx);
      else if (!(await currentRecipient(row, tx)))
        await save(
          row,
          {
            status: "cancelled",
            error:
              "Canal desativado, destinatário alterado ou empresa arquivada.",
          },
          tx,
        );
      else if (row.channel === "email") await sendEmail(row, tx);
      else await sendWhatsapp(row, templates, tx);
    });
    processed++;
  }
  return { processed };
}
