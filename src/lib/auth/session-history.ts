import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { auditEvents, session } from "@/db/schema";

/**
 * The record of a sign-in: when, from which browser and from which IP. It is
 * the access log the Marco Civil (art. 15) asks to keep for six months, so it
 * lives in the audit and survives sign-out and account deletion. The screens
 * only read the browser and the expiry, never the IP.
 */
export function sessionAudit(entry: { id: string; userId: string; createdAt: Date; expiresAt: Date; userAgent?: string | null; ipAddress?: string | null }) {
  return {
    id: `session-start:${entry.id}`,
    actorId: entry.userId,
    action: "account.session.started",
    entityId: entry.id,
    details: {
      userAgent: entry.userAgent?.slice(0, 512) || null,
      ip: entry.ipAddress?.slice(0, 64) || null,
      expiresAt: entry.expiresAt.toISOString(),
    },
    createdAt: entry.createdAt,
  };
}

/** Select only display data; session tokens never leave the server. */
export async function recentSessions(userId: string, currentId: string) {
  const [live, history] = await Promise.all([
    db.select({ id: session.id, createdAt: session.createdAt, updatedAt: session.updatedAt, expiresAt: session.expiresAt, userAgent: session.userAgent })
      .from(session).where(eq(session.userId, userId)).orderBy(sql`case when ${session.id} = ${currentId} then 0 else 1 end`, desc(session.createdAt)).limit(20),
    db.select({ id: auditEvents.entityId, createdAt: auditEvents.createdAt, details: auditEvents.details })
      .from(auditEvents).where(and(eq(auditEvents.actorId, userId), eq(auditEvents.action, "account.session.started")))
      .orderBy(desc(auditEvents.createdAt)).limit(20),
  ]);
  const entries = new Map(live.map(entry => [entry.id, { ...entry, status: entry.id === currentId ? "current" : entry.expiresAt > new Date() ? "active" : "expired" }]));
  for (const entry of history) {
    if (entries.has(entry.id)) continue;
    const data = entry.details as { userAgent?: string; expiresAt?: string } | null;
    entries.set(entry.id, { id: entry.id, createdAt: entry.createdAt, updatedAt: entry.createdAt,
      expiresAt: data?.expiresAt ? new Date(data.expiresAt) : entry.createdAt,
      userAgent: typeof data?.userAgent === "string" ? data.userAgent : null, status: "ended" });
  }
  return [...entries.values()].sort((a,b) => Number(b.status === "current") - Number(a.status === "current") || b.createdAt.getTime() - a.createdAt.getTime()).slice(0,20);
}
