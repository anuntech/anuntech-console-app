import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { ticketNotices, tickets, companies, auditEvents } from "@/db/schema";
import { Back, Heading, Badge, Empty } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { checkTicketNotices } from "@/lib/notification-actions";
import { auditLabels } from "@/lib/format";
import { APP_LOCALE, APP_TIME_ZONE } from "@/lib/dates";
import { Mail, MessageCircle, Send } from "lucide-react";
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
export const metadata: Metadata = {
  title: "Avisos de chamados",
  description:
    "Confira os destinatários e as confirmações de entrega dos avisos de atendimento.",
};

export default async function Notifications() {
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
    <>
      <Back href="/configuracoes" label="Configurações" />
      <Heading
        title="Avisos de chamados"
        description="Abertura, respostas, anexos e alterações de situação ou responsável."
      />
      <section className="panel padded">
        <h2 className="detail-section-title">
          <Send size={18} aria-hidden="true" />
          Destinatário da equipe Anuntech
        </h2>
        <div className="notification-destinations">
          <div>
            <Mail size={17} aria-hidden="true" />
            <div>
              <small>E-mail</small>
              <strong>{process.env.CONSOLE_ADMIN_EMAIL}</strong>
            </div>
          </div>
          <div>
            <MessageCircle size={17} aria-hidden="true" />
            <div>
              <small>WhatsApp</small>
              <strong>
                {actor.user.phoneNumberVerified
                  ? actor.user.phoneNumber
                  : "não vinculado"}
              </strong>
              <Link href="/conta">Gerenciar em Minha conta</Link>
            </div>
          </div>
        </div>
        <p className="muted">
          Toda movimentação é registrada para os dois canais, inclusive as
          feitas pela equipe. O WhatsApp usa o modelo
          notificação_chamado_console com o nome da empresa cliente. O e-mail
          inclui a movimentação e o link do chamado.
        </p>
      </section>
      <section className="panel padded section-gap">
        <div className="card-top">
          <h2>Histórico de envios</h2>
          <span className="collection-count">{rows.length} registros</span>
        </div>
        <p className="muted">
          Avisos são processados após a movimentação e revisados a cada 5
          minutos. O WhatsApp só envia com o modelo aprovado no FLW. “Aceito
          pelo provedor” ainda não confirma entrega.
        </p>
        <ActionForm
          action={checkTicketNotices}
          label="Verificar avisos pendentes"
          className="compact-form"
        >
          {null}
        </ActionForm>
        <p className="muted">
          Tentativas seguras ficam disponíveis por até 23 horas. Respostas
          incertas do WhatsApp exigem conferência no FLW antes de qualquer
          reenvio. São exibidos os 100 avisos mais recentes.
        </p>
        {rows.length ? (
          <div
            className="table-wrap"
            role="region"
            aria-label="Tabela de avisos de chamados"
            tabIndex={0}
          >
            <table>
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
                      <p className="muted">
                        {company} · {auditLabels[action] || action}
                      </p>
                    </td>
                    <td>
                      {n.channel === "email" ? "E-mail" : "WhatsApp"}
                      <p className="muted">
                        {n.destination || "Sem número verificado"}
                      </p>
                    </td>
                    <td>
                      <Badge status={n.status}>
                        {labels[n.status] || n.status}
                      </Badge>
                      {n.error && <p className="muted">{n.error}</p>}
                      {n.providerStatus && (
                        <p className="muted">{n.providerStatus}</p>
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
          <Empty
            headingLevel={3}
            title="Nenhum aviso registrado"
            description="As próximas movimentações dos chamados aparecerão aqui."
          />
        )}
      </section>
    </>
  );
}
