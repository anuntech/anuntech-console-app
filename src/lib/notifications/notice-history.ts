import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { NOTICE_HISTORY_PAGE_SIZE, noticeHistoryPage } from "./notice-history-view";

export type NoticeHistoryRow = {
  id: string;
  channel: string;
  destination: string;
  status: string;
  error: string | null;
  created_at: Date;
  subject: string;
  href: string;
  action: string;
};

/**
 * Configurações → Notificações → Histórico de envios: the ticket notices of
 * an environment and, for a company, its billing notices, newest first, 20
 * a page. `companyId` null is the Console team's own environment (the team's
 * ticket notices). Who may read it is decided by the caller
 * (settingsEnvironment on the web, managedCompany in the app).
 */
export async function noticeHistory(companyId: string | null, requestedPage: unknown) {
  const ticketScope = companyId
    ? sql`t.company_id=${companyId} and n.preference_key=${`${companyId}:tickets`}`
    : sql`(n.preference_key is null or n.preference_key='console:tickets')`;
  const history = sql`select n.id,n.channel,n.destination,n.status,n.error,n.created_at,t.subject,'/chamados/'||t.id as href,a.action
    from console_ticket_notices n join console_tickets t on t.id=n.ticket_id join console_audit_events a on a.id=n.event_id where ${ticketScope}
    ${companyId ? sql`union all select n.id,n.channel,coalesce(nullif(n.recipient,''),case when jsonb_typeof(n.payload->'to')='array' then n.payload->'to'->>0 else n.payload->>'to' end,''),n.status,n.error,n.created_at,i.description,'/financeiro/'||i.id,'billing.notice' from console_billing_notices n join console_invoices i on i.id=n.invoice_id where i.company_id=${companyId}` : sql``}`;
  const counts = await db.execute<{ total: number }>(sql`select count(*)::int total from (${history}) history`);
  const total = counts.rows[0].total;
  const { page, pageCount } = noticeHistoryPage(requestedPage, total);
  const { rows } = await db.execute<NoticeHistoryRow>(
    sql`select * from (${history}) history order by created_at desc,id desc limit ${NOTICE_HISTORY_PAGE_SIZE} offset ${(page - 1) * NOTICE_HISTORY_PAGE_SIZE}`,
  );
  return { rows, total, page, pageCount };
}
