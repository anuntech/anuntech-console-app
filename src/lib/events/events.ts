import "server-only";
import { sql } from "drizzle-orm";
import { consoleEvents } from "@/db/schema";
import { db } from "../db";
import { errorText } from "../action-errors";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What happened, by name. A new type needs its handler in handlers.ts (or none, to only record it). */
export type ConsoleEventType = "quote.accepted" | "contract.signed" | "invoice.overdue";

/**
 * Records an event inside the caller's transaction, so it exists exactly
 * when the change does. `key` makes a repeat a no-op (the same acceptance
 * recorded twice, a cron that runs again): by default type and record.
 */
export async function emitEvent(
  tx: Tx | typeof db,
  event: { type: ConsoleEventType; entityId: string; companyId?: string | null; payload?: Record<string, unknown>; key?: string },
) {
  await tx
    .insert(consoleEvents)
    .values({
      type: event.type,
      key: event.key ?? `${event.type}:${event.entityId}`,
      entityId: event.entityId,
      companyId: event.companyId ?? null,
      payload: event.payload ?? {},
    })
    .onConflictDoNothing({ target: consoleEvents.key });
}

export type PendingEvent = typeof consoleEvents.$inferSelect;

/** Tries per event before it stops and waits for the team (the Painel shows it). */
export const EVENT_MAX_ATTEMPTS = 5;

/**
 * Hands the oldest unprocessed events to their handler, a batch at a time.
 * Each event is claimed with SKIP LOCKED in its own transaction, so two runs
 * never take the same one, and a failing handler only bumps its attempts.
 * NO KEY UPDATE, not UPDATE: the handler writes a decision that references
 * the event from another connection, and that reference needs a key-share
 * lock that FOR UPDATE would hold back until this transaction ends.
 */
export async function drainEvents(handle: (event: PendingEvent) => Promise<void>, limit = 50) {
  let processed = 0;
  let failed = 0;
  for (let i = 0; i < limit; i++) {
    const outcome = await db.transaction(async (tx) => {
      const claimed = await tx.execute<{ id: string }>(sql`
        select id from ${consoleEvents}
        where processed_at is null and attempts < ${EVENT_MAX_ATTEMPTS}
        order by occurred_at
        limit 1
        for no key update skip locked`);
      const id = claimed.rows[0]?.id;
      if (!id) return "empty" as const;
      const [event] = await tx.select().from(consoleEvents).where(sql`${consoleEvents.id} = ${id}`);
      try {
        await handle(event);
        await tx.update(consoleEvents).set({ processedAt: new Date(), lastError: null }).where(sql`${consoleEvents.id} = ${id}`);
        return "ok" as const;
      } catch (e) {
        await tx
          .update(consoleEvents)
          .set({ attempts: event.attempts + 1, lastError: errorText(e, "falha").slice(0, 300) })
          .where(sql`${consoleEvents.id} = ${id}`);
        return "failed" as const;
      }
    });
    if (outcome === "empty") break;
    if (outcome === "ok") processed++;
    else failed++;
  }
  return { processed, failed };
}

/** Events that gave up: for the Painel and the morning digest. */
export async function stuckEvents() {
  return db
    .select({ id: consoleEvents.id, type: consoleEvents.type, lastError: consoleEvents.lastError, occurredAt: consoleEvents.occurredAt })
    .from(consoleEvents)
    .where(sql`${consoleEvents.processedAt} is null and ${consoleEvents.attempts} >= ${EVENT_MAX_ATTEMPTS}`)
    .orderBy(consoleEvents.occurredAt)
    .limit(20);
}
