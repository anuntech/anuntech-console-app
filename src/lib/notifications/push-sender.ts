import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  automationEvents,
  companies,
  contracts,
  invoices,
  pushDevices,
  pushNotices,
  quotes,
  tasks,
  tickets,
  user,
} from "@/db/schema";
import { getAccountEmails } from "../account/account-identity";
import { loadGrants } from "../access/grants";
import { reconcileCharge } from "../billing/billing-sync";
import { saoPauloDate } from "../dates";
import { sendOpsMail } from "./ops-alerts";
import {
  chunk,
  mapPushHttpFailure,
  mapPushReceipt,
  mapPushTicket,
  pushBackoffMinutes,
  pushStillAllowed,
  type PushAudience,
  type PushOutcome,
} from "./push-rules";

/*
 * Sends the queued pushes to the Expo Push Service and reads the receipts.
 * The claim (status "sending", attempts + 1) is committed before the POST:
 * Expo has no idempotency key, so a push that may have gone out is never
 * sent again ("uncertain").
 */

type Row = typeof pushNotices.$inferSelect;
type Claimed = Row & { token: string };
const minutes = (n: number) => new Date(Date.now() + n * 60000);
const sendUrl = () => process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send";
const receiptsUrl = () => sendUrl().replace(/\/send$/, "/getReceipts");
function expoHeaders(): Record<string, string> {
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function save(id: string, changes: Partial<typeof pushNotices.$inferInsert>) {
  await db
    .update(pushNotices)
    .set({ ...changes, lockedAt: null, updatedAt: new Date() })
    .where(eq(pushNotices.id, id));
}

/** Expo said the app left this phone: it gets nothing more until it registers again. */
async function disableDevice(deviceId: string) {
  await db
    .update(pushDevices)
    .set({ disabledAt: new Date() })
    .where(and(eq(pushDevices.id, deviceId), isNull(pushDevices.disabledAt)));
}

/** A credential problem reaches the team once a day per error, not once per push. */
async function alertTeam(codes: Set<string>) {
  for (const code of codes) {
    try {
      const [claimed] = await db
        .insert(automationEvents)
        .values({ kind: "push.alert", entityId: `${code}:${saoPauloDate()}`, details: { code } })
        .onConflictDoNothing()
        .returning({ id: automationEvents.id });
      if (!claimed) continue;
      await sendOpsMail(
        `Push do app recusado pelo Expo (${code})`,
        `O Expo Push Service recusou pushes do app com o erro ${code}.\n\n${
          code === "EXPO_ACCESS_TOKEN"
            ? "Confira o EXPO_ACCESS_TOKEN na Vercel e a segurança reforçada do projeto no Expo."
            : code === "MessageTooBig"
              ? "Uma mensagem passou do tamanho que a Apple ou o Google aceitam."
              : "Confira as credenciais de push (APNs e FCM) do projeto no Expo (eas credentials)."
        }\n\nOs pushes afetados ficaram como falha em console_push_notices.`,
      );
    } catch {
      /* The alert is best effort; the rows keep the error. */
    }
  }
}

/**
 * The re-check right before sending: the phone still belongs to the person,
 * the person still belongs to the company and sees the item, the company is
 * active and the item is still waiting on the client.
 */
async function stillCurrent(row: Claimed, bank: Map<string, Promise<boolean>>): Promise<string | true | "retry"> {
  const [device] = await db
    .select({ userId: pushDevices.userId, disabledAt: pushDevices.disabledAt })
    .from(pushDevices)
    .where(eq(pushDevices.id, row.deviceId));
  if (!device || device.disabledAt || device.userId !== row.userId) return "O aparelho saiu do app ou passou para outra pessoa.";
  const [company] = await db.select({ archived: companies.archived }).from(companies).where(eq(companies.id, row.companyId));
  if (!company || company.archived) return "Empresa arquivada.";
  const [person] = await db.select({ email: user.email }).from(user).where(eq(user.id, row.userId));
  if (!person) return "Pessoa não encontrada.";
  const grants = await loadGrants(await getAccountEmails(row.userId, person.email), row.companyId);
  let ticket: { engagementId: string | null; authorId: string } | null = null;
  switch (row.entityType) {
    case "ticket": {
      [ticket] = await db
        .select({ engagementId: tickets.engagementId, authorId: tickets.authorId })
        .from(tickets)
        .where(and(eq(tickets.id, row.entityId), eq(tickets.companyId, row.companyId)));
      if (!ticket) return "Chamado não encontrado.";
      break;
    }
    case "invoice": {
      const load = async () =>
        (
          await db
            .select({ status: invoices.status, publicEnabled: invoices.publicEnabled })
            .from(invoices)
            .where(and(eq(invoices.id, row.entityId), eq(invoices.companyId, row.companyId)))
        )[0];
      const before = await load();
      if (!before || before.status !== "issued" || !before.publicEnabled) return "Fatura paga, cancelada ou com o link desativado.";
      // As with every billing notice: ask the bank first, so a paid invoice never gets "em atraso".
      let check = bank.get(row.entityId);
      if (!check) {
        check = reconcileCharge(row.entityId, undefined, undefined, "scheduled").then(
          () => true,
          () => false,
        );
        bank.set(row.entityId, check);
      }
      if (!(await check)) return "retry";
      const after = await load();
      if (!after || after.status !== "issued" || !after.publicEnabled) return "Fatura liquidada ou cancelada após consulta ao Inter.";
      break;
    }
    case "contract": {
      const [c] = await db
        .select({ status: contracts.status })
        .from(contracts)
        .where(and(eq(contracts.id, row.entityId), eq(contracts.companyId, row.companyId)));
      if (c?.status !== "sent") return "O contrato não está mais aguardando assinatura.";
      break;
    }
    case "quote": {
      const [q] = await db
        .select({ status: quotes.status })
        .from(quotes)
        .where(and(eq(quotes.id, row.entityId), eq(quotes.companyId, row.companyId)));
      if (q?.status !== "sent") return "O orçamento não está mais aguardando resposta.";
      break;
    }
    case "task": {
      const [t] = await db
        .select({ status: tasks.status })
        .from(tasks)
        .where(and(eq(tasks.id, row.entityId), eq(tasks.companyId, row.companyId)));
      if (t?.status !== "review") return "A entrega não está mais em revisão.";
      break;
    }
  }
  if (!pushStillAllowed(row.audience as PushAudience, grants, ticket, row.userId))
    return "A pessoa não tem mais acesso a este item.";
  return true;
}

async function apply(row: Claimed, outcome: PushOutcome, alerts: Set<string>) {
  switch (outcome.status) {
    case "accepted":
      await save(row.id, { status: "accepted", providerId: outcome.providerId, providerStatus: outcome.providerStatus, error: null });
      return;
    case "pending":
      await save(row.id, {
        status: "pending",
        providerStatus: outcome.providerStatus,
        error: outcome.error,
        nextAttemptAt: minutes(pushBackoffMinutes(row.attempts)),
      });
      return;
    case "failed":
      await save(row.id, { status: "failed", providerStatus: outcome.providerStatus, error: outcome.error });
      if (outcome.disableDevice) await disableDevice(row.deviceId);
      if (outcome.alert) alerts.add(outcome.alert);
      return;
    case "uncertain":
      await save(row.id, { status: "uncertain", providerStatus: outcome.providerStatus, error: outcome.error });
  }
}

/** One POST with up to 100 messages; each answer lines up with its message. */
async function post(rows: Claimed[], alerts: Set<string>) {
  let response: Response;
  try {
    response = await fetch(sendUrl(), {
      method: "POST",
      redirect: "error",
      headers: expoHeaders(),
      body: JSON.stringify(
        rows.map((row) => ({
          to: row.token,
          title: row.payload.title,
          body: row.payload.body,
          data: row.payload.data,
          sound: "default",
          channelId: "default",
          priority: "high",
        })),
      ),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // Timeout or connection lost after the request left: it may have gone out (status 0 maps to "uncertain").
    for (const row of rows) await apply(row, mapPushHttpFailure(0), alerts);
    return;
  }
  const body = (await response.json().catch(() => null)) as { data?: unknown } | null;
  const data = Array.isArray(body?.data) ? body.data : null;
  if (!response.ok || !data || data.length !== rows.length) {
    // A 2xx we cannot read maps to "uncertain"; an error status to retry or failure.
    const outcome = mapPushHttpFailure(response.status);
    for (const row of rows) await apply(row, outcome, alerts);
    return;
  }
  for (const [i, row] of rows.entries()) await apply(row, mapPushTicket(data[i]), alerts);
}

export async function processPushNotices(deadline = Date.now() + 25000) {
  // A worker that stopped after claiming may have posted: never resend it.
  await db
    .update(pushNotices)
    .set({ status: "uncertain", lockedAt: null, updatedAt: new Date(), error: "Envio interrompido sem confirmação; o push não é repetido." })
    .where(and(eq(pushNotices.status, "sending"), lt(pushNotices.lockedAt, minutes(-5))));
  // A push hours late says nothing useful.
  await db
    .update(pushNotices)
    .set({ status: "expired", updatedAt: new Date(), error: "Passaram 6 horas do horário de envio." })
    .where(and(eq(pushNotices.status, "pending"), lt(pushNotices.nextAttemptAt, minutes(-360))));
  let sent = 0,
    cancelled = 0;
  const alerts = new Set<string>();
  const bank = new Map<string, Promise<boolean>>();
  for (let round = 0; round < 5 && Date.now() < deadline; round++) {
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(pushNotices)
        .where(and(eq(pushNotices.status, "pending"), lte(pushNotices.nextAttemptAt, new Date()), isNull(pushNotices.lockedAt)))
        .orderBy(pushNotices.nextAttemptAt)
        .limit(100)
        .for("update", { skipLocked: true });
      if (!rows.length) return [];
      await tx
        .update(pushNotices)
        .set({ status: "sending", lockedAt: new Date(), attempts: sql`${pushNotices.attempts} + 1`, updatedAt: new Date() })
        .where(inArray(pushNotices.id, rows.map((r) => r.id)));
      return rows.map((r) => ({ ...r, attempts: r.attempts + 1 }));
    });
    if (!claimed.length) break;
    const devices = await db
      .select({ id: pushDevices.id, token: pushDevices.token })
      .from(pushDevices)
      .where(inArray(pushDevices.id, [...new Set(claimed.map((r) => r.deviceId))]));
    const ready: Claimed[] = [];
    for (const row of claimed) {
      const token = devices.find((d) => d.id === row.deviceId)?.token;
      const check = token ? await stillCurrent({ ...row, token }, bank).catch(() => "retry" as const) : "Aparelho não encontrado.";
      if (check === true) ready.push({ ...row, token: token! });
      else if (check === "retry")
        // Nothing went to Expo: the same push waits for the next run.
        await save(row.id, { status: "pending", nextAttemptAt: minutes(pushBackoffMinutes(row.attempts)), error: "Aguardando a consulta da cobrança no Inter." });
      else {
        cancelled++;
        await save(row.id, { status: "cancelled", error: check });
      }
    }
    for (const batch of chunk(ready, 100)) {
      await post(batch, alerts);
      sent += batch.length;
    }
  }
  if (alerts.size) await alertTeam(alerts);
  return { pushed: sent, pushCancelled: cancelled };
}

/**
 * Expo's receipt says whether Apple or Google took the push. Asked 15 minutes
 * after the ticket (Expo's advice) and kept by Expo for about a day; after
 * that, the row expires without one.
 */
export async function checkPushReceipts() {
  await db
    .update(pushNotices)
    .set({ status: "expired", updatedAt: new Date(), error: "Sem recibo do Expo em 24 horas." })
    .where(and(eq(pushNotices.status, "accepted"), lt(pushNotices.createdAt, minutes(-24 * 60))));
  const due = minutes(-15);
  const rows = await db
    .select({ id: pushNotices.id, providerId: pushNotices.providerId, deviceId: pushNotices.deviceId })
    .from(pushNotices)
    .where(
      and(
        eq(pushNotices.status, "accepted"),
        isNotNull(pushNotices.providerId),
        lte(pushNotices.updatedAt, due),
        gt(pushNotices.createdAt, minutes(-24 * 60)),
        or(isNull(pushNotices.receiptCheckedAt), lte(pushNotices.receiptCheckedAt, due)),
      ),
    )
    .orderBy(pushNotices.updatedAt)
    .limit(1000);
  if (!rows.length) return { receipts: 0 };
  let receipts: Record<string, unknown>;
  try {
    const response = await fetch(receiptsUrl(), {
      method: "POST",
      redirect: "error",
      headers: expoHeaders(),
      body: JSON.stringify({ ids: rows.map((r) => r.providerId) }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await response.json().catch(() => null)) as { data?: unknown } | null;
    if (!response.ok || !body?.data || typeof body.data !== "object") {
      if (response.status === 401 || response.status === 403) await alertTeam(new Set(["EXPO_ACCESS_TOKEN"]));
      return { receipts: 0 };
    }
    receipts = body.data as Record<string, unknown>;
  } catch {
    return { receipts: 0 };
  }
  const alerts = new Set<string>();
  let read = 0;
  for (const row of rows) {
    const outcome = mapPushReceipt(receipts[row.providerId!]);
    const now = new Date();
    if (!outcome) {
      // No receipt yet: ask again on a later run, without touching updatedAt (the 15-minute clock).
      await db.update(pushNotices).set({ receiptCheckedAt: now }).where(eq(pushNotices.id, row.id));
      continue;
    }
    read++;
    await db
      .update(pushNotices)
      .set({
        status: outcome.status,
        providerStatus: outcome.providerStatus,
        receiptCheckedAt: now,
        updatedAt: now,
        error: outcome.status === "failed" ? outcome.error : null,
      })
      .where(and(eq(pushNotices.id, row.id), eq(pushNotices.status, "accepted")));
    if (outcome.status === "failed") {
      if (outcome.disableDevice) await disableDevice(row.deviceId);
      if (outcome.alert) alerts.add(outcome.alert);
    }
  }
  if (alerts.size) await alertTeam(alerts);
  return { receipts: read };
}
