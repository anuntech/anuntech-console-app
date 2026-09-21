import "server-only";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { NotificationToggle } from "./notification-toggle";
import { ticketNotificationsEnabled } from "@/lib/notification-settings";
import { settingsEnvironment } from "@/lib/environment";
import { NotificationTopicForm } from "./notification-settings";
import { db } from "@/lib/db";
import { Badge, Empty } from "@/components/ui";
import { auditLabels } from "@/lib/format";
import { APP_LOCALE, APP_TIME_ZONE } from "@/lib/dates";
import controls from "./notifications-content.module.css";
import styles from "./preferences-content.module.css";
const labels: Record<string, string> = {
  waiting: "Aguardando",
  pending: "Aguardando",
  processing: "Processando",
  sending: "Enviando",
  accepted: "Aceito pelo provedor",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falha",
  uncertain: "Sem confirmação",
  cancelled: "Não enviado",
  skipped: "Não enviado",
  expired: "Prazo expirado",
};
type HistoryRow = {
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
export async function NotificationsContent({
  page: requestedPage,
}: {
  page?: string | string[];
}) {
  const { actor, companyId } = await settingsEnvironment();
  const ticketScope = companyId
    ? sql`t.company_id=${companyId} and n.preference_key=${`${companyId}:tickets`}`
    : sql`(n.preference_key is null or n.preference_key='console:tickets')`;
  const history = sql`select n.id,n.channel,n.destination,n.status,n.error,n.created_at,t.subject,'/chamados/'||t.id as href,a.action
    from console_ticket_notices n join console_tickets t on t.id=n.ticket_id join console_audit_events a on a.id=n.event_id where ${ticketScope}
    ${companyId ? sql`union all select n.id,n.channel,coalesce(nullif(n.recipient,''),case when jsonb_typeof(n.payload->'to')='array' then n.payload->'to'->>0 else n.payload->>'to' end,''),n.status,n.error,n.created_at,i.description,'/financeiro/'||i.id,'billing.notice' from console_billing_notices n join console_invoices i on i.id=n.invoice_id where i.company_id=${companyId}` : sql``}`;
  const [enabled, counts] = await Promise.all([
    actor.admin ? ticketNotificationsEnabled() : Promise.resolve(false),
    db.execute<{ total: number }>(
      sql`select count(*)::int total from (${history}) history`,
    ),
  ]);
  const total = counts.rows[0].total,
    pageCount = Math.max(1, Math.ceil(total / 20));
  const raw =
      typeof requestedPage === "string" && /^[1-9]\d{0,6}$/.test(requestedPage)
        ? Number(requestedPage)
        : 1,
    page = Math.min(raw, pageCount);
  const { rows } = await db.execute<HistoryRow>(
    sql`select * from (${history}) history order by created_at desc,id desc limit 20 offset ${(page - 1) * 20}`,
  );
  return (
    <div className={styles.content}>
      {actor.admin && <NotificationToggle enabled={enabled} />}
      {companyId && (
        <NotificationTopicForm
          companyId={companyId}
          topic="billing"
          title="Financeiro"
          description="Faturas, vencimentos e lembretes."
        />
      )}
      <NotificationTopicForm
        companyId={companyId}
        topic="tickets"
        title="Chamados"
        description="Abertura, respostas e atualizações."
      />
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Histórico de envios</h2>
          <span>{total} registros</span>
        </div>
        {rows.length ? (
          <div
            className={`table-wrap ${styles.tableWrap}`}
            role="region"
            aria-label="Histórico de notificações"
            tabIndex={0}
          >
            <table className={`${styles.table} ${controls.history}`}>
              <caption className="sr-only">
                Histórico de notificações e confirmações de entrega
              </caption>
              <thead>
                <tr>
                  <th scope="col">Movimentação</th>
                  <th scope="col">Destinatário</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-notice-id={row.id}>
                    <td>
                      <Link href={row.href}>{row.subject}</Link>
                      <p className={styles.cellDetail}>
                        {row.action === "billing.notice"
                          ? "Financeiro"
                          : auditLabels[row.action] || row.action}
                      </p>
                    </td>
                    <td>
                      {row.destination || "—"}
                      <p className={styles.cellDetail}>
                        {row.channel === "email" ? "E-mail" : "WhatsApp"}
                      </p>
                    </td>
                    <td>
                      <Badge status={row.status}>
                        {labels[row.status] || row.status}
                      </Badge>
                      {row.error && (
                        <p className={styles.cellDetail}>{row.error}</p>
                      )}
                    </td>
                    <td>
                      {new Intl.DateTimeFormat(APP_LOCALE, {
                        timeZone: APP_TIME_ZONE,
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(row.created_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.card}>
            <Empty
              headingLevel={3}
              title="Nenhum aviso registrado"
              description="Os próximos envios aparecerão aqui."
            />
          </div>
        )}
        {pageCount > 1 && (
          <nav
            className={controls.pagination}
            aria-label="Paginação do histórico"
          >
            <span>
              {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} de {total}
            </span>
            <div>
              {page > 1 && (
                <Link
                  className="button"
                  href={`/configuracoes/notificacoes?page=${page - 1}`}
                  replace
                  scroll={false}
                >
                  Anterior
                </Link>
              )}
              {page < pageCount && (
                <Link
                  className="button"
                  href={`/configuracoes/notificacoes?page=${page + 1}`}
                  replace
                  scroll={false}
                >
                  Próxima
                </Link>
              )}
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
