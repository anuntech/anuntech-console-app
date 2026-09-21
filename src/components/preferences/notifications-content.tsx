import "server-only";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { NotificationToggle } from "./notification-toggle";
import { ticketNotificationsEnabled } from "@/lib/notification-settings";
import controls from "./notifications-content.module.css";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { ticketNotices, tickets, companies, auditEvents } from "@/db/schema";
import { Badge, Empty } from "@/components/ui";
import { auditLabels } from "@/lib/format";
import { APP_LOCALE, APP_TIME_ZONE } from "@/lib/dates";
import styles from "./preferences-content.module.css";

const labels: Record<string, string> = {
  pending: "Aguardando",
  processing: "Processando",
  accepted: "Aceito pelo provedor",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falha",
  uncertain: "Sem confirmação",
  cancelled: "Não enviado",
  expired: "Prazo expirado",
};

export async function NotificationsContent({
  page: requestedPage,
}: {
  page?: string | string[];
}) {
  await requireAdmin();
  const [enabled, [totalRow]] = await Promise.all([
    ticketNotificationsEnabled(),
    db.select({ total: count() }).from(ticketNotices),
  ]);
  const total = totalRow.total;
  const pageCount = Math.max(1, Math.ceil(total / 20));
  const raw =
    typeof requestedPage === "string" && /^[1-9]\d{0,6}$/.test(requestedPage)
      ? Number(requestedPage)
      : 1;
  const page = Math.min(raw, pageCount);
  const rows = await db
    .select({
      notice: ticketNotices,
      subject: tickets.subject,
      company: companies.name,
      action: auditEvents.action,
    })
    .from(ticketNotices)
    .innerJoin(tickets, eq(tickets.id, ticketNotices.ticketId))
    .innerJoin(companies, eq(companies.id, tickets.companyId))
    .innerJoin(auditEvents, eq(auditEvents.id, ticketNotices.eventId))
    .orderBy(desc(ticketNotices.createdAt), desc(ticketNotices.id))
    .limit(20)
    .offset((page - 1) * 20);
  return (
    <div className={styles.content}>
      <NotificationToggle enabled={enabled} />
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
                Histórico dos avisos de chamados e confirmações de entrega
              </caption>
              <thead>
                <tr>
                  <th scope="col">Movimentação</th>
                  <th scope="col">Canal</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ notice: n, subject, company, action }) => (
                  <tr key={n.id} data-notice-id={n.id}>
                    <td>
                      <Link
                        href={`/chamados/${n.ticketId}`}
                        aria-label={`${subject} — ${company}`}
                      >
                        {subject}
                      </Link>
                      <p className={styles.cellDetail}>
                        {company} · {auditLabels[action] || action}
                      </p>
                    </td>
                    <td>{n.channel === "email" ? "E-mail" : "WhatsApp"}</td>
                    <td>
                      <Badge status={n.status}>
                        {labels[n.status] || n.status}
                      </Badge>
                      {n.error && (
                        <p className={styles.cellDetail}>{n.error}</p>
                      )}
                    </td>
                    <td>
                      {new Intl.DateTimeFormat(APP_LOCALE, {
                        timeZone: APP_TIME_ZONE,
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(n.createdAt)}
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
              description="As próximas movimentações dos chamados aparecerão aqui."
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
