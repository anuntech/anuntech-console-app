import "server-only";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { collectionQueue } from "../billing/collections";
import { COLLECT_AFTER_DAYS } from "../decisions/decision-rules";
import { emitEvent } from "./events";

/*
 * Events that no click emits: time passing. Each scan reads what the
 * Console already lists and records one event per case; the key keeps a
 * case to one event however often the cron runs.
 */

/**
 * A client late for COLLECT_AFTER_DAYS with no contact logged since the
 * oldest due date and no promise ahead: one event per client and oldest
 * invoice, so a new debt after this one settles opens a new decision.
 */
export async function scanOverdue(today = saoPauloDate()) {
  const cases = await collectionQueue(today);
  let ready = 0;
  for (const c of cases) {
    const oldest = c.invoices[0];
    if (c.oldestDays < COLLECT_AFTER_DAYS || c.waitingPromise) continue;
    if (c.contact && c.contact.at.slice(0, 10) >= oldest.dueDate) continue;
    await emitEvent(db, {
      type: "invoice.overdue",
      entityId: `${c.companyId}:${oldest.id}`,
      companyId: c.companyId,
      payload: {
        companyId: c.companyId,
        message: c.message,
        oldestDays: c.oldestDays,
        invoices: c.invoices.length,
        totalCents: c.totalCents,
        contactNote: c.contact?.note ?? null,
        archived: c.archived,
      },
    });
    ready++;
  }
  return ready;
}
