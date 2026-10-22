import type { PushPayload } from "@/db/schema";
import type { Role } from "../access/permissions";
import { scopeIncludes, type EngagementScope } from "../access/engagement-scope";

/*
 * Push to the native app, the pure part: what each event says on the lock
 * screen, who may receive it and what Expo's answers mean. No database, no
 * Next, so tests/push-rules.test.ts covers it. Push only informs: it never
 * creates, sends or issues anything.
 */

export const PUSH_TITLE = "Anuntech Console";

/**
 * Lock-screen text stays minimal: no subject, amount or company name, since
 * anyone near the phone reads it.
 */
export const PUSH_EVENTS = {
  "ticket.replied": { body: "Nova resposta no chamado", topic: "tickets", entityType: "ticket", audience: "ticket" },
  "ticket.waiting": { body: "Seu chamado está aguardando você", topic: "tickets", entityType: "ticket", audience: "ticket" },
  "ticket.resolved": { body: "Chamado resolvido", topic: "tickets", entityType: "ticket", audience: "ticket" },
  "invoice.issued": { body: "Nova fatura disponível", topic: "billing", entityType: "invoice", audience: "managers" },
  "invoice.overdue": { body: "Fatura em atraso", topic: "billing", entityType: "invoice", audience: "managers" },
  "contract.sent": { body: "Contrato para assinar", topic: "contracts", entityType: "contract", audience: "managers" },
  "quote.sent": { body: "Novo orçamento para responder", topic: "quotes", entityType: "quote", audience: "managers" },
  "task.review": { body: "Entrega pronta para revisar", topic: "projects", entityType: "task", audience: "managers" },
} as const;
export type PushEvent = keyof typeof PUSH_EVENTS;
export type PushEntityType = (typeof PUSH_EVENTS)[PushEvent]["entityType"];
export type PushAudience = (typeof PUSH_EVENTS)[PushEvent]["audience"];

/** Where a tap opens, as a Console path the app maps to its screen. A task opens its project's board. */
export function pushUrl(entityType: PushEntityType, entity: { id: string; engagementId?: string | null }) {
  switch (entityType) {
    case "ticket":
      return `/chamados/${entity.id}`;
    case "invoice":
      return `/financeiro/${entity.id}`;
    case "contract":
      return `/contratos/${entity.id}`;
    case "quote":
      return `/orcamentos/${entity.id}`;
    case "task":
      return `/projetos/${entity.engagementId ?? ""}`;
  }
}

export function pushPayload(event: PushEvent, entity: { id: string; engagementId?: string | null }): PushPayload {
  const spec = PUSH_EVENTS[event];
  return { title: PUSH_TITLE, body: spec.body, data: { url: pushUrl(spec.entityType, entity) } };
}

/** One membership row of a candidate: the person, one phone of theirs and whether this membership sees the item. */
export type PushCandidate = { userId: string; deviceId: string; emails: readonly string[]; sees: boolean };

/**
 * Who gets the push: one row per person and phone, never the person who
 * acted, never the Anuntech team (a staff alias or the Console owner), and
 * only someone with at least one membership that sees the item (aliases in a
 * company share the widest scope).
 */
export function pickPushRecipients(
  candidates: readonly PushCandidate[],
  options: { actorId?: string | null; staffEmails: ReadonlySet<string> },
) {
  const people = new Map<string, { sees: boolean; staff: boolean; devices: Set<string> }>();
  for (const c of candidates) {
    const person = people.get(c.userId) ?? { sees: false, staff: false, devices: new Set<string>() };
    person.sees ||= c.sees;
    person.staff ||= c.emails.some((email) => options.staffEmails.has(email.trim().toLowerCase()));
    person.devices.add(c.deviceId);
    people.set(c.userId, person);
  }
  const picked: { userId: string; deviceId: string }[] = [];
  for (const [userId, person] of people) {
    if (userId === options.actorId || person.staff || !person.sees) continue;
    for (const deviceId of person.devices) picked.push({ userId, deviceId });
  }
  return picked;
}

/**
 * The re-check right before sending: the person still belongs to the company
 * and still sees the item. Mirrors canSeeTicket for tickets and the finance
 * area (Administradores) for the rest.
 */
export function pushStillAllowed(
  audience: PushAudience,
  grants: readonly { role: Role; engagements: EngagementScope }[],
  ticket?: { engagementId: string | null; authorId: string } | null,
  userId?: string,
) {
  if (!grants.length) return false;
  if (audience === "managers") return grants.some((g) => g.role === "manager");
  if (!ticket) return false;
  if (!ticket.engagementId || ticket.authorId === userId) return true;
  return grants.some((g) => scopeIncludes(g.engagements, ticket.engagementId!));
}

/** Minutes until the next try: 2, 4, 8… up to an hour. */
export function pushBackoffMinutes(attempts: number) {
  return Math.min(60, 2 ** Math.min(Math.max(attempts, 1), 6));
}

/** Expo errors that mean the project's push credentials need the team. */
export const PUSH_ALERT_ERRORS = new Set(["InvalidCredentials", "MismatchSenderId", "MessageTooBig"]);

export type PushOutcome =
  | { status: "accepted"; providerId: string; providerStatus: "ok" }
  | { status: "pending"; error: string; providerStatus: string | null }
  | { status: "failed"; error: string; providerStatus: string; disableDevice: boolean; alert: string | null }
  | { status: "uncertain"; error: string; providerStatus: string | null };

/** One push ticket from POST /push/send (data[i] answers messages[i]). */
export function mapPushTicket(ticket: unknown): PushOutcome {
  const t = (ticket ?? {}) as { status?: unknown; id?: unknown; message?: unknown; details?: { error?: unknown } };
  if (t.status === "ok" && typeof t.id === "string" && t.id)
    return { status: "accepted", providerId: t.id, providerStatus: "ok" };
  if (t.status === "error") {
    const code = typeof t.details?.error === "string" ? t.details.error : "error";
    if (code === "MessageRateExceeded")
      return { status: "pending", error: "O Expo pediu para esperar (MessageRateExceeded).", providerStatus: code };
    return {
      status: "failed",
      error: code === "DeviceNotRegistered" ? "O aparelho saiu do app (DeviceNotRegistered)." : `O Expo recusou o push (${code}).`,
      providerStatus: code,
      disableDevice: code === "DeviceNotRegistered",
      alert: PUSH_ALERT_ERRORS.has(code) ? code : null,
    };
  }
  return { status: "uncertain", error: "Resposta do Expo sem confirmação; o push não é repetido.", providerStatus: null };
}

/**
 * The whole POST, when it did not come back as a list of tickets. 429 and 5xx
 * are retried later; 401/403 is the access token; another 4xx is a request
 * Expo will never take. A 2xx we cannot read may have gone out, so it is
 * never repeated (Expo has no idempotency key).
 */
export function mapPushHttpFailure(httpStatus: number): PushOutcome {
  if (httpStatus === 429 || httpStatus >= 500)
    return { status: "pending", error: `Expo indisponível (HTTP ${httpStatus}).`, providerStatus: `HTTP ${httpStatus}` };
  if (httpStatus === 401 || httpStatus === 403)
    return {
      status: "failed",
      error: `O Expo recusou a credencial (HTTP ${httpStatus}).`,
      providerStatus: `HTTP ${httpStatus}`,
      disableDevice: false,
      alert: "EXPO_ACCESS_TOKEN",
    };
  if (httpStatus >= 400)
    return {
      status: "failed",
      error: `O Expo recusou o pedido (HTTP ${httpStatus}).`,
      providerStatus: `HTTP ${httpStatus}`,
      disableDevice: false,
      alert: null,
    };
  return { status: "uncertain", error: "Resposta do Expo sem confirmação; o push não é repetido.", providerStatus: `HTTP ${httpStatus}` };
}

export type ReceiptOutcome =
  | { status: "delivered"; providerStatus: "ok" }
  | { status: "failed"; error: string; providerStatus: string; disableDevice: boolean; alert: string | null };

/** One receipt from POST /push/getReceipts; null while Expo has none yet. */
export function mapPushReceipt(receipt: unknown): ReceiptOutcome | null {
  const r = receipt as { status?: unknown; details?: { error?: unknown } } | undefined;
  if (!r || typeof r !== "object") return null;
  if (r.status === "ok") return { status: "delivered", providerStatus: "ok" };
  if (r.status !== "error") return null;
  const code = typeof r.details?.error === "string" ? r.details.error : "error";
  return {
    status: "failed",
    error: code === "DeviceNotRegistered" ? "O aparelho saiu do app (DeviceNotRegistered)." : `A Apple ou o Google recusaram o push (${code}).`,
    providerStatus: code,
    disableDevice: code === "DeviceNotRegistered",
    alert: PUSH_ALERT_ERRORS.has(code) ? code : null,
  };
}

/** Expo takes up to 100 messages per request. */
export function chunk<T>(items: readonly T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
