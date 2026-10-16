import "server-only";
import { createHmac } from "node:crypto";
import { and, desc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { appConnections, auditEvents, user } from "@/db/schema";
import { db } from "../db";
import { actorForUser, type Actor } from "../access/access";
import {
  bearerToken,
  CODE_TTL_MS,
  MEETING_APP,
  newCode,
  newToken,
  NOTES_PER_HOUR,
  sha256,
  verifierMatches,
} from "./meeting-rules";

/*
 * Connecting the Mac meeting-notes app to an account and recognizing its key
 * afterwards. Only hashes are stored: the one-time code while the browser
 * hands it to the app, then the key. See meeting-rules.ts for the flow.
 */

/** After the signed-in person approved: a one-time code bound to the app's challenge. */
export async function issueCode(actor: Actor, challenge: string) {
  const code = newCode();
  await db.transaction(async (tx) => {
    // A second click or a reload replaces the earlier code; codes nobody used go away.
    await tx
      .delete(appConnections)
      .where(
        and(
          eq(appConnections.userId, actor.user.id),
          isNull(appConnections.tokenHash),
          or(eq(appConnections.challenge, challenge), lt(appConnections.codeExpiresAt, new Date())),
        ),
      );
    await tx.insert(appConnections).values({
      userId: actor.user.id,
      app: MEETING_APP,
      challenge,
      codeHash: sha256(code),
      codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
  });
  return code;
}

/**
 * The app trades the code and its verifier for a key, once. A wrong verifier
 * burns the code, so a code caught on its way to the app cannot be retried.
 */
export async function exchangeCode(input: { code: string; verifier: string; device: string }) {
  const [pending] = await db
    .select({
      id: appConnections.id,
      userId: appConnections.userId,
      challenge: appConnections.challenge,
      expiresAt: appConnections.codeExpiresAt,
    })
    .from(appConnections)
    .where(and(eq(appConnections.codeHash, sha256(input.code)), isNull(appConnections.tokenHash)));
  if (!pending) return null;
  const valid =
    !!pending.challenge &&
    !!pending.expiresAt &&
    pending.expiresAt > new Date() &&
    verifierMatches(input.verifier, pending.challenge);
  if (!valid) {
    await db.delete(appConnections).where(eq(appConnections.id, pending.id));
    return null;
  }
  const token = newToken();
  const connected = await db.transaction(async (tx) => {
    // Conditional, so two requests racing with the same code get one key between them.
    const [row] = await tx
      .update(appConnections)
      .set({
        tokenHash: sha256(token),
        device: input.device,
        challenge: null,
        codeHash: null,
        codeExpiresAt: null,
        connectedAt: new Date(),
      })
      .where(and(eq(appConnections.id, pending.id), isNull(appConnections.tokenHash)))
      .returning({ id: appConnections.id });
    if (!row) return false;
    await tx.insert(auditEvents).values({
      actorId: pending.userId,
      companyId: null,
      action: "app.connected",
      entityId: row.id,
      details: { app: MEETING_APP, device: input.device },
    });
    return true;
  });
  if (!connected) return null;
  const [person] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, pending.userId));
  return { token, person: person ?? { name: "", email: "" } };
}

export type AppCaller = { actor: Actor; connectionId: string; device: string | null };

/** The person behind an `Authorization: Bearer` key, with their access as of now; null otherwise. */
export async function appCaller(request: Request): Promise<AppCaller | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return null;
  const [row] = await db
    .select({ id: appConnections.id, device: appConnections.device, lastUsedAt: appConnections.lastUsedAt, person: user })
    .from(appConnections)
    .innerJoin(user, eq(user.id, appConnections.userId))
    .where(
      and(
        eq(appConnections.tokenHash, sha256(token)),
        eq(appConnections.app, MEETING_APP),
        isNull(appConnections.revokedAt),
      ),
    );
  if (!row?.person.emailVerified) return null;
  // "Usado por último" on the security page; a write every few minutes is plenty.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 5 * 60 * 1000)
    await db.update(appConnections).set({ lastUsedAt: new Date() }).where(eq(appConnections.id, row.id));
  return { actor: await actorForUser(row.person), connectionId: row.id, device: row.device };
}

/** The person's own connected apps, newest first, for Configurações → Segurança. */
export async function connectionsOf(userId: string) {
  return db
    .select({
      id: appConnections.id,
      device: appConnections.device,
      connectedAt: appConnections.connectedAt,
      lastUsedAt: appConnections.lastUsedAt,
    })
    .from(appConnections)
    .where(
      and(
        eq(appConnections.userId, userId),
        isNotNull(appConnections.tokenHash),
        isNull(appConnections.revokedAt),
      ),
    )
    .orderBy(desc(appConnections.connectedAt));
}

/** Ends one of the person's connections; the app's next call gets 401. */
export async function revokeConnection(userId: string, connectionId: string, from: "console" | "app") {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(appConnections)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(appConnections.id, connectionId),
          eq(appConnections.userId, userId),
          isNotNull(appConnections.tokenHash),
          isNull(appConnections.revokedAt),
        ),
      )
      .returning({ id: appConnections.id, device: appConnections.device });
    if (!row) return false;
    await tx.insert(auditEvents).values({
      actorId: userId,
      companyId: null,
      action: "app.disconnected",
      entityId: row.id,
      details: { app: MEETING_APP, device: row.device, from },
    });
    return true;
  });
}

const notesKey = (userId: string) =>
  createHmac("sha256", process.env.BETTER_AUTH_SECRET!).update(`meeting-notes:${userId}`).digest("hex");

/** Per-person hourly ceiling on notes, on the OTP limits table like dictation (HMAC key, never the raw id). */
export async function reserveNote(userId: string) {
  const key = notesKey(userId);
  const result = await db.execute(sql`
    INSERT INTO console_otp_limits (key,last_sent_at,window_start,count) VALUES (${key},now(),now(),1)
    ON CONFLICT (key) DO UPDATE SET last_sent_at=now(),
      window_start=CASE WHEN console_otp_limits.window_start < now()-interval '1 hour' THEN now() ELSE console_otp_limits.window_start END,
      count=CASE WHEN console_otp_limits.window_start < now()-interval '1 hour' THEN 1 ELSE console_otp_limits.count+1 END
    WHERE console_otp_limits.window_start < now()-interval '1 hour' OR console_otp_limits.count < ${NOTES_PER_HOUR}
    RETURNING key`);
  return result.rows.length > 0;
}
