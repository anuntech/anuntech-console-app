import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import type { Actor } from "../access/access";
import { budgetRefusal, budgetSubjects, overBudget, type BudgetSubject, type Usage } from "./budget-rules";

/** The payers of one turn, on the day it started (a turn past midnight still spends from that day). */
export type TurnBudget = { day: string; subjects: BudgetSubject[] };

const who = (subjects: BudgetSubject[]) => sql.join(subjects.map((s) => sql`(${s.kind}, ${s.id})`), sql`, `);
const usageOf = (rows: Record<string, unknown>[]): Usage[] =>
  rows.map((r) => ({ kind: String(r.kind), subjectId: String(r.subject_id), tokens: Number(r.tokens), messages: Number(r.messages ?? 0) }));

/**
 * Counts the message for the person and each company that pays, then reads
 * the day: a payer out of tokens, or a company past its messages, refuses the
 * turn and the count is taken back. Counting before reading means two
 * messages sent at once see each other.
 */
export async function reserveTurn(actor: Actor): Promise<{ budget: TurnBudget } | { error: string }> {
  const day = saoPauloDate();
  const subjects = budgetSubjects(actor);
  const counted = await db.execute(sql`
    INSERT INTO console_assistant_usage (kind, subject_id, day, messages)
    VALUES ${sql.join(subjects.map((s) => sql`(${s.kind}, ${s.id}, ${day}::date, 1)`), sql`, `)}
    ON CONFLICT (kind, subject_id, day) DO UPDATE SET messages = console_assistant_usage.messages + 1, updated_at = now()
    RETURNING kind, subject_id, tokens, messages`);
  const refusal = budgetRefusal(subjects, usageOf(counted.rows));
  if (!refusal) return { budget: { day, subjects } };
  await db.execute(sql`
    UPDATE console_assistant_usage SET messages = greatest(messages - 1, 0)
    WHERE day = ${day}::date AND (kind, subject_id) IN (${who(subjects)})`);
  return { error: refusal };
}

/**
 * Adds one round's tokens to every payer of the turn; true once one of them
 * reached its budget, so the turn wraps up. A failed write is logged and the
 * answer goes on: the budget never breaks a turn already under way.
 */
export async function spendTokens(budget: TurnBudget, tokens: number): Promise<boolean> {
  if (tokens <= 0) return false;
  try {
    const spent = await db.execute(sql`
      UPDATE console_assistant_usage SET tokens = tokens + ${Math.round(tokens)}, updated_at = now()
      WHERE day = ${budget.day}::date AND (kind, subject_id) IN (${who(budget.subjects)})
      RETURNING kind, subject_id, tokens`);
    return overBudget(budget.subjects, usageOf(spent.rows));
  } catch (error) {
    console.warn("[assistant] tokens not counted", error instanceof Error ? error.message : error);
    return false;
  }
}
