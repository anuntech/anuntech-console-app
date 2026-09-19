import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "./db";
import { companies, user, ticketNotices } from "@/db/schema";
import { APP_LOCALE, APP_TIME_ZONE } from "./dates";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Notice = typeof ticketNotices.$inferSelect;
const activeStatuses = ["pending", "processing", "accepted", "sent"];
const delay = (minutes: number) => new Date(Date.now() + minutes * 60000);
const adminEmail = () =>
  process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase() || "";

// Runs in the same transaction as the ticket mutation. No external I/O here.
export async function enqueueTicketNotice(
  tx: Tx,
  eventId: string,
  ticket: { id: string; companyId: string; subject: string },
  actorName: string,
  movement: string,
) {
  const [company] = await tx
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, ticket.companyId));
  const email = adminEmail();
  const [admin] = await tx.select().from(user).where(eq(user.email, email));
  const base =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    "https://console.anuntech.com";
  const when = new Intl.DateTimeFormat(APP_LOCALE, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(new Date());
  const emailId = randomUUID(),
    whatsappId = randomUUID();
  const phone = admin?.phoneNumberVerified ? admin.phoneNumber || "" : "";
  await tx
    .insert(ticketNotices)
    .values([
      {
        id: emailId,
        eventId,
        ticketId: ticket.id,
        channel: "email",
        destination: email,
        payload: {
          from: process.env.EMAIL_FROM || "",
          to: email,
          subject: `${movement} · ${ticket.subject}`,
          text: `${movement}\n\nCliente: ${company.name}\nChamado: ${ticket.subject}\nResponsável pela movimentação: ${actorName}\nData: ${when} (São Paulo)\n\nAcompanhar no Console: ${base}/chamados/${ticket.id}\n\nAnuntech Console`,
        },
      },
      {
        id: whatsappId,
        eventId,
        ticketId: ticket.id,
        channel: "whatsapp",
        destination: phone,
        payload: {
          from: process.env.FLW_SENDER_NUMBER || "",
          to: phone.replace(/^\+/, ""),
          templateId: process.env.FLW_TICKET_TEMPLATE_ID || "",
          parameters: { "[nome_do_cliente]": company.name },
          senderId: whatsappId,
          options: { enableBot: false },
        },
        ...(!phone
          ? {
              status: "cancelled",
              error:
                "WhatsApp do administrador não está verificado. Vincule em Minha conta.",
            }
          : {}),
      },
    ])
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
) {
  await db
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
async function currentRecipient(row: Notice) {
  if (row.channel === "email") return row.destination === adminEmail();
  const [admin] = await db
    .select()
    .from(user)
    .where(eq(user.email, adminEmail()));
  return (
    !!admin?.emailVerified &&
    admin.phoneNumberVerified &&
    admin.phoneNumber === row.destination
  );
}

async function sendEmail(row: Notice) {
  if (!process.env.RESEND_API_KEY || !row.payload.from || !row.destination) {
    await save(row, {
      status: "pending",
      nextAttemptAt: delay(5),
      error: "Configure o e-mail do administrador e o Resend.",
    });
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
      await save(row, {
        status: "accepted",
        providerId: data.id,
        providerStatus: "accepted",
        error: null,
      });
      return;
    }
    const retry = r.status === 429 || r.status >= 500 || r.ok;
    await save(row, {
      status: retry ? "pending" : "failed",
      nextAttemptAt: delay(Math.min(60, 2 ** Math.min(row.attempts, 6))),
      error: `Resend não confirmou o envio (HTTP ${r.status}).`,
    });
  } catch {
    await save(row, {
      status: "pending",
      nextAttemptAt: delay(5),
      error:
        "Resposta do Resend não confirmada; a nova tentativa usará a mesma chave de envio.",
    });
  }
}
async function sendWhatsapp(
  row: Notice,
  templates: () => Promise<Set<string>>,
) {
  if (!process.env.FLW_SYNOVA || !row.payload.from || !row.payload.templateId) {
    await save(row, {
      status: "pending",
      nextAttemptAt: delay(5),
      error: "Configure remetente e modelo de chamados no FLW.",
    });
    return;
  }
  try {
    if (!(await templates()).has(row.payload.templateId)) {
      await save(row, {
        status: "pending",
        nextAttemptAt: delay(5),
        error: "Modelo de WhatsApp ainda não aprovado ou indisponível no FLW.",
      });
      return;
    }
  } catch {
    await save(row, {
      status: "pending",
      nextAttemptAt: delay(5),
      error: "Aguardando consulta de aprovação do modelo no FLW.",
    });
    return;
  }
  // FLW documents senderId as correlation, not as a deduplication guarantee.
  // An ambiguous POST must never be blindly retried.
  await db
    .update(ticketNotices)
    .set({ attempts: row.attempts + 1 })
    .where(eq(ticketNotices.id, row.id));
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
      await save(row, {
        status: state,
        providerId: data.id,
        providerStatus: String(data.status || "UNKNOWN"),
        nextAttemptAt: delay(5),
        error:
          state === "failed"
            ? "O FLW informou falha na mensagem. Consulte o provedor."
            : null,
      });
      return;
    }
    await save(row, {
      status:
        r.status === 429
          ? "pending"
          : r.status >= 400 && r.status < 500
            ? "failed"
            : "uncertain",
      nextAttemptAt: delay(5),
      error: `FLW não confirmou o envio (HTTP ${r.status}).${r.status >= 500 || r.ok ? " Confira no provedor antes de reenviar." : ""}`,
    });
  } catch {
    await save(row, {
      status: "uncertain",
      error:
        "Envio ao FLW sem confirmação. Confira no provedor antes de reenviar.",
    });
  }
}
function whatsappState(status: string) {
  if (status === "DELIVERED") return "delivered";
  if (status === "READ") return "read";
  if (status === "FAILED" || status === "DELETED") return "failed";
  if (status === "SENT") return "sent";
  return "accepted";
}
async function checkWhatsapp(row: Notice) {
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
      await save(row, {
        status,
        providerStatus: String(data.status || "UNKNOWN"),
        nextAttemptAt: delay(5),
        error:
          status === "failed"
            ? "O FLW informou falha na entrega. Consulte o provedor."
            : null,
      });
    } else
      await save(row, {
        status: row.status,
        nextAttemptAt: delay(5),
        error: "Não foi possível consultar a situação no FLW.",
      });
  } catch {
    await save(row, {
      status: row.status,
      nextAttemptAt: delay(5),
      error: "Consulta de entrega temporariamente indisponível.",
    });
  }
}

export async function processTicketNotices() {
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
          ...(candidate.channel === "email"
            ? { attempts: candidate.attempts + 1 }
            : {}),
        })
        .where(eq(ticketNotices.id, candidate.id));
      return candidate;
    });
    if (!row) break;
    if (!(await currentRecipient(row)))
      await save(row, {
        status: "cancelled",
        error:
          "Destinatário não corresponde mais ao administrador ou WhatsApp verificado.",
      });
    else if (row.channel === "email") await sendEmail(row);
    else if (row.providerId) await checkWhatsapp(row);
    else await sendWhatsapp(row, templates);
    processed++;
  }
  return { processed };
}
