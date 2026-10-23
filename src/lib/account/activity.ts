import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { APP_TIME_ZONE } from "../dates";

export type ActivityDay = { date: string; count: number };

/** Days shown: 52 full weeks plus today, like a contribution calendar. */
export const ACTIVITY_DAYS = 365;

/**
 * What the person did in the Console, per day (São Paulo time), for the last
 * year: actions recorded in the audit log, messages written in tickets and
 * questions asked to the assistant. Reads only what is already stored; every
 * day of the range is present, quiet days with 0.
 */
export async function accountActivity(userId: string, now = new Date()): Promise<ActivityDay[]> {
  const since = new Date(now.getTime() - 366 * 86_400_000).toISOString();
  const result = await db.execute<{ day: string; count: number }>(sql`
    with events as (
      select created_at from console_audit_events where actor_id = ${userId} and created_at >= ${since}::timestamptz
      union all
      select created_at from console_messages where author_id = ${userId} and created_at >= ${since}::timestamptz
      union all
      select m.created_at from console_assistant_messages m
        join console_assistant_conversations c on c.id = m.conversation_id
        where c.user_id = ${userId} and m.role = 'user' and m.created_at >= ${since}::timestamptz
    )
    select to_char(created_at at time zone ${APP_TIME_ZONE}, 'YYYY-MM-DD') as day, count(*)::int as count
    from events group by 1
  `);
  const counts = new Map(result.rows.map((row) => [row.day, Number(row.count)]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const date = new Date(end - (ACTIVITY_DAYS - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { date, count: counts.get(date) ?? 0 };
  });
}
