import "server-only";
import { cronRuns } from "@/db/schema";
import { db } from "../db";

/*
 * Whether each scheduled routine is still running: every run records itself,
 * and the Painel and the morning digest say when one went quiet. A routine
 * that stopped shows only here, never in a client's screen.
 */

export const ROUTINES = {
  "billing-sync": { label: "Conciliação com o Inter", every: 30 },
  "recurring-billing": { label: "Emissão das recorrências e avisos de cobrança", every: 30 },
  "ticket-notifications": { label: "Avisos de chamados", every: 30 },
  "ops-digest": { label: "Resumo da manhã", every: 26 * 60 },
  "contract-expiry": { label: "Aviso de vigência dos contratos", every: 26 * 60 },
} as const satisfies Record<string, { label: string; every: number }>;
export type Routine = keyof typeof ROUTINES;

/**
 * Called at the end of each cron run; a failure here never breaks the routine.
 * A run that got part of its work done counts as alive even when it answered
 * with an error (one charge the bank refused); the error is kept for the Painel.
 */
export async function recordCronRun(name: Routine, run: { completed: boolean; error?: string }) {
  try {
    const now = new Date();
    const error = run.error ? run.error.slice(0, 300) : null;
    await db
      .insert(cronRuns)
      .values({ name, lastOkAt: run.completed ? now : null, lastFailedAt: error || !run.completed ? now : null, lastError: error, updatedAt: now })
      .onConflictDoUpdate({
        target: cronRuns.name,
        set: {
          ...(run.completed ? { lastOkAt: now } : {}),
          ...(error || !run.completed ? { lastFailedAt: now, lastError: error } : {}),
          updatedAt: now,
        },
      });
  } catch (failure) {
    console.warn("[cron-health] could not record", name, failure instanceof Error ? failure.message : failure);
  }
}

/**
 * An error answer still counts as a run when some counter other than
 * `failed` moved ({ checked: 39, failed: 1 }); { checked: 0, failed: 40 }
 * is an outage, as is a body that is not JSON.
 */
async function runOutcome(response: Response): Promise<{ completed: boolean; error?: string }> {
  if (response.status < 500) return { completed: true };
  const body = (await response.clone().json().catch(() => null)) as Record<string, unknown> | null;
  const failed = typeof body?.failed === "number" ? body.failed : 0;
  return {
    completed: !!body && Object.entries(body).some(([key, value]) => key !== "failed" && typeof value === "number" && value > 0),
    error: `HTTP ${response.status}${failed ? `, ${failed} ${failed === 1 ? "falha" : "falhas"}` : ""}`,
  };
}

/** Wraps a cron route so each run records itself; a refused call (wrong secret) is not a run. */
export function trackedCron(name: Routine, handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      const response = await handler(request);
      if (response.status !== 401) await recordCronRun(name, await runOutcome(response));
      return response;
    } catch (error) {
      await recordCronRun(name, { completed: false, error: error instanceof Error ? error.message : "falha" });
      throw error;
    }
  };
}

export type RoutineHealth = { name: Routine; label: string; lastOkAt: string | null; lastError: string | null; minutes: number | null };

/** Routines with no successful run within their window, and those that never finished one (`minutes` null). */
export async function staleRoutines(now = new Date()): Promise<RoutineHealth[]> {
  const rows = await db.select().from(cronRuns);
  const byName = new Map(rows.map((row) => [row.name, row]));
  // A routine that never ran here yet (a fresh deploy of this check) is given its first window.
  const oldest = rows.reduce<Date | null>((min, row) => (!min || row.updatedAt < min ? row.updatedAt : min), null);
  const out: RoutineHealth[] = [];
  for (const [name, routine] of Object.entries(ROUTINES) as [Routine, (typeof ROUTINES)[Routine]][]) {
    const row = byName.get(name);
    if (row && !row.lastOkAt) {
      out.push({ name, label: routine.label, lastOkAt: null, lastError: row.lastError, minutes: null });
      continue;
    }
    const since = row?.lastOkAt ?? oldest;
    if (!since) continue;
    const minutes = Math.floor((now.getTime() - since.getTime()) / 60_000);
    if (minutes > routine.every)
      out.push({ name, label: routine.label, lastOkAt: row?.lastOkAt?.toISOString() ?? null, lastError: row?.lastError ?? null, minutes });
  }
  return out;
}

/** "sem rodar há 2 h", "sem rodar há 3 dias"; null is a routine that never finished a run. */
export function quietFor(minutes: number | null) {
  if (minutes === null) return "nenhuma execução concluída";
  if (minutes < 120) return `sem rodar há ${minutes} min`;
  if (minutes < 48 * 60) return `sem rodar há ${Math.floor(minutes / 60)} h`;
  return `sem rodar há ${Math.floor(minutes / (24 * 60))} dias`;
}

