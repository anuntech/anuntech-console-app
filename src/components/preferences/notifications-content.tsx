import "server-only";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Mail, MessageCircle } from "lucide-react";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { ticketNotices, tickets, companies, auditEvents } from "@/db/schema";
import { Badge, Empty } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { checkTicketNotices } from "@/lib/notification-actions";
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
  uncertain: "Conferir no FLW",
  cancelled: "Não enviado",
  expired: "Prazo expirado",
};

export async function NotificationsContent() {
  const actor = await requireAdmin();
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
    .orderBy(desc(ticketNotices.createdAt))
    .limit(100);
  return (
    <div className={styles.content}>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Destinatários</h2>
        </div>
        <dl className={`${styles.card} ${styles.settingsList}`}>
          <div className={styles.settingRow}>
            <dt>
              <Mail size={16} aria-hidden="true" /> E-mail
            </dt>
            <dd>{process.env.CONSOLE_ADMIN_EMAIL}</dd>
          </div>
          <div className={styles.settingRow}>
            <dt>
              <MessageCircle size={16} aria-hidden="true" /> WhatsApp
            </dt>
            <dd>
              <span>
                {actor.user.phoneNumberVerified
                  ? actor.user.phoneNumber
                  : "não vinculado"}
              </span>
              <Link
                href="/conta"
                replace
                scroll={false}
                className={styles.inlineLink}
              >
                Gerenciar em Minha conta
              </Link>
            </dd>
          </div>
        </dl>
        <p className={styles.groupNote}>
          Toda movimentação é registrada para os dois canais, inclusive as
          feitas pela equipe. O WhatsApp usa o modelo
          notificação_chamado_console com o nome da empresa cliente. O e-mail
          inclui a movimentação e o link do chamado.
        </p>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Entrega</h2>
        </div>
        <div className={`${styles.card} ${styles.deliveryCard}`}>
          <div className={styles.historyIntro}>
            <p className={styles.helper}>
              Avisos são processados após a movimentação e revisados a cada 5
              minutos. O WhatsApp só envia com o modelo aprovado no FLW. “Aceito
              pelo provedor” ainda não confirma entrega.
            </p>
            <div>
              <ActionForm
                action={checkTicketNotices}
                label="Verificar avisos pendentes"
                className={styles.integrationAction}
              >
                {null}
              </ActionForm>
            </div>
          </div>
          <p className={styles.helper}>
            Tentativas seguras ficam disponíveis por até 23 horas. Respostas
            incertas do WhatsApp exigem conferência no FLW antes de qualquer
            reenvio. São exibidos os 100 avisos mais recentes.
          </p>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Histórico de envios</h2>
          <span>{rows.length} registros</span>
        </div>
        {rows.length ? (
          <div
            className={`table-wrap ${styles.tableWrap}`}
            role="region"
            aria-label="Tabela de avisos de chamados"
            tabIndex={0}
          >
            <table className={styles.table}>
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
                  <tr key={n.id}>
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
                    <td>
                      {n.channel === "email" ? "E-mail" : "WhatsApp"}
                      <p className={styles.cellDetail}>
                        {n.destination || "Sem número verificado"}
                      </p>
                    </td>
                    <td>
                      <Badge status={n.status}>
                        {labels[n.status] || n.status}
                      </Badge>
                      {n.error && (
                        <p className={styles.cellDetail}>{n.error}</p>
                      )}
                      {n.providerStatus && (
                        <p className={styles.cellDetail}>{n.providerStatus}</p>
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
      </section>
    </div>
  );
}
