import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { APP_TIME_ZONE } from "../dates";
import { ACTIVITY_DAYS, type ActivityDay } from "../account/activity";

/** One person of the company and how they used the Console in the last 30 days. */
export type MemberEngagement = {
  email: string;
  name: string | null;
  role: "manager" | "member";
  /** Never signed in: no account yet, or an account with no session ever. */
  never: boolean;
  /** Last time a session of theirs was used (web or app), ISO. */
  lastUse: string | null;
  logins: number;
  apps: number;
  tickets: number;
  messages: number;
  /** Anything else they did in this company (contracts, quotes, files, settings). */
  actions: number;
};

export type CompanyEngagement = { people: MemberEngagement[]; days: ActivityDay[] };

const WINDOW = "30 days";

/**
 * How the company's people use the Console, for the team (Empresas › empresa › Engajamento):
 * per person the last use, sign-ins, apps opened, tickets, messages and other actions in the last
 * 30 days; and the company's year as one calendar (sign-ins, actions and messages per day, São
 * Paulo time). Reads only what is already stored: sessions, the audit log and ticket messages.
 */
export async function companyEngagement(companyId: string, now = new Date()): Promise<CompanyEngagement> {
  const rows = await db.execute<{
    email: string;
    name: string | null;
    role: "manager" | "member";
    uid: string | null;
    ever: boolean;
    last_use: string | null;
    logins: number;
    apps: number;
    tickets: number;
    messages: number;
    actions: number;
  }>(sql`
    with people as (
      select distinct on (lower(m.email)) m.email, m.role, coalesce(u.id, u2.id) as uid, coalesce(u.name, u2.name) as name
      from console_memberships m
      left join console_user u on lower(u.email) = lower(m.email)
      left join console_account_emails ae on lower(ae.email) = lower(m.email) and ae.verified_at is not null
      left join console_user u2 on u2.id = ae.user_id
      where m.company_id = ${companyId} and m.active
      order by lower(m.email), u.id nulls last
    )
    select p.email, p.name, p.role, p.uid,
      exists (select 1 from console_session s where s.user_id = p.uid) as ever,
      (select max(s.updated_at) from console_session s where s.user_id = p.uid) as last_use,
      (select count(*) from console_session s where s.user_id = p.uid and s.created_at > now() - ${WINDOW}::interval)::int as logins,
      (select count(*) from console_audit_events a where a.actor_id = p.uid and a.company_id = ${companyId} and a.action = 'app.opened' and a.created_at > now() - ${WINDOW}::interval)::int as apps,
      (select count(*) from console_tickets t where t.author_id = p.uid and t.company_id = ${companyId} and t.created_at > now() - ${WINDOW}::interval)::int as tickets,
      (select count(*) from console_messages ms join console_tickets t on t.id = ms.ticket_id where ms.author_id = p.uid and t.company_id = ${companyId} and ms.created_at > now() - ${WINDOW}::interval)::int as messages,
      (select count(*) from console_audit_events a where a.actor_id = p.uid and a.company_id = ${companyId} and a.action <> 'app.opened' and a.created_at > now() - ${WINDOW}::interval)::int as actions
    from people p
  `);
  const people: MemberEngagement[] = rows.rows
    .map((r) => ({
      email: r.email,
      name: r.name?.trim() || null,
      role: r.role,
      never: !r.uid || !r.ever,
      lastUse: r.last_use ? new Date(r.last_use).toISOString() : null,
      logins: Number(r.logins),
      apps: Number(r.apps),
      tickets: Number(r.tickets),
      messages: Number(r.messages),
      actions: Number(r.actions),
    }))
    // Most recent first; who never came in last.
    .sort((a, b) => (b.lastUse ?? "").localeCompare(a.lastUse ?? "") || a.email.localeCompare(b.email));

  const ids = rows.rows.map((r) => r.uid).filter((id): id is string => !!id);
  const since = new Date(now.getTime() - 366 * 86_400_000).toISOString();
  const counts = new Map<string, number>();
  if (ids.length) {
    const list = sql.join(ids.map((id) => sql`${id}`), sql`, `);
    const days = await db.execute<{ day: string; count: number }>(sql`
      with events as (
        select created_at from console_session where user_id in (${list}) and created_at >= ${since}::timestamptz
        union all
        select created_at from console_audit_events where actor_id in (${list}) and company_id = ${companyId} and created_at >= ${since}::timestamptz
        union all
        select ms.created_at from console_messages ms join console_tickets t on t.id = ms.ticket_id
          where ms.author_id in (${list}) and t.company_id = ${companyId} and ms.created_at >= ${since}::timestamptz
      )
      select to_char(created_at at time zone ${APP_TIME_ZONE}, 'YYYY-MM-DD') as day, count(*)::int as count from events group by 1
    `);
    for (const row of days.rows) counts.set(row.day, Number(row.count));
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
  const end = Date.parse(`${today}T00:00:00Z`);
  const days = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const date = new Date(end - (ACTIVITY_DAYS - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { date, count: counts.get(date) ?? 0 };
  });
  return { people, days };
}
