import "server-only";
import { and, eq, gt, inArray } from "drizzle-orm";
import { auditEvents } from "@/db/schema";
import { db } from "../db";

/** A notice that just went out (sent or resent) is not sent again: a double click must not mail the client twice. */
export const RESEND_INTERVAL_MINUTES = 5;

export async function sentMomentsAgo(entityId: string, actions: string[], now = new Date()) {
  const since = new Date(now.getTime() - RESEND_INTERVAL_MINUTES * 60_000);
  const [recent] = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(and(eq(auditEvents.entityId, entityId), inArray(auditEvents.action, actions), gt(auditEvents.createdAt, since)))
    .limit(1);
  return !!recent;
}

export const RESEND_TOO_SOON = `O aviso acabou de sair. Para reenviar, espere ${RESEND_INTERVAL_MINUTES} minutos.`;

export const notifiedLabel = (n: number) => (n === 1 ? "1 pessoa" : `${n} pessoas`);
