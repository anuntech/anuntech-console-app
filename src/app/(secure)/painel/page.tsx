import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, tickets, invoices, subscriptions } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { Heading, Empty, Badge } from "@/components/ui";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ticketLabels, invoiceLabels, currency, dateLabel } from "@/lib/format";
import {
  MessagesSquare,
  ReceiptText,
  Building2,
  ArrowUpRight,
  Plus,
  ArrowRight,
} from "lucide-react";
export const metadata: Metadata = {
  title: "Visão geral",
  description: "Acompanhe empresas, chamados e faturas no Console da Anuntech.",
};

export default async function Dashboard() {
  const actor = await getActor();
  const supportIds = allowedIds(actor, "support"),
    financeIds = allowedIds(actor, "finance");
  const ticketScope = actor.admin
    ? sql`true`
    : supportIds.length
      ? inArray(tickets.companyId, supportIds)
      : sql`false`;
  const invoiceScope = actor.admin
    ? sql`true`
    : financeIds.length
      ? and(
          inArray(invoices.companyId, financeIds),
          inArray(invoices.status, ["issued", "paid"]),
        )
      : sql`false`;
  const [
    recentTickets,
    recentInvoices,
    [ticketCount],
    [invoiceCount],
    [companyCount],
  ] = await Promise.all([
    db
      .select({ ticket: tickets, company: companies.name })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .where(ticketScope)
      .orderBy(desc(tickets.updatedAt))
      .limit(5),
    db
      .select({
        invoice: invoices,
        company: companies.name,
        subscriptionStatus: subscriptions.status,
      })
      .from(invoices)
      .innerJoin(companies, eq(companies.id, invoices.companyId))
      .leftJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
      .where(invoiceScope)
      .orderBy(desc(invoices.createdAt))
      .limit(5),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        and(
          ticketScope,
          inArray(tickets.status, ["open", "in_progress", "waiting_customer"]),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(
        and(
          invoiceScope,
          eq(invoices.status, actor.admin ? "draft" : "issued"),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(companies)
      .where(
        actor.admin
          ? sql`true`
          : actor.grants.length
            ? inArray(
                companies.id,
                actor.grants.map((g) => g.company.id),
              )
            : sql`false`,
      ),
  ]);
  return (
    <>
      <Heading
        eyebrow="VISÃO GERAL"
        title={`Olá, ${actor.user.name.split(" ")[0]}.`}
        description="Uma visão do seu atendimento, das suas empresas e do financeiro."
      />
      <div className="overview-toolbar">
        <p>Seu espaço de trabalho</p>
        <div className="overview-actions">
          {actor.admin && (
            <Link href="/empresas/nova" className="button">
              <Plus size={15} aria-hidden="true" />
              Cadastrar empresa
            </Link>
          )}
          {(actor.admin || supportIds.length > 0) && (
            <Link href="/chamados/novo" className="button primary">
              <Plus size={15} aria-hidden="true" />
              Abrir chamado
            </Link>
          )}
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <MessagesSquare aria-hidden="true" />
          <span>Chamados em andamento</span>
          <strong>{ticketCount.count}</strong>
          <small>Solicitações que ainda precisam de atenção</small>
        </div>
        <div className="stat">
          <ReceiptText aria-hidden="true" />
          <span>
            {actor.admin ? "Faturas não emitidas" : "Faturas a pagar"}
          </span>
          <strong>{invoiceCount.count}</strong>
          <small>
            {actor.admin
              ? "Rascunhos e cobranças agendadas"
              : "Cobranças disponíveis para pagamento"}
          </small>
        </div>
        <div className="stat">
          <Building2 aria-hidden="true" />
          <span>
            {actor.admin ? "Empresas cadastradas" : "Empresas com acesso"}
          </span>
          <strong>{companyCount.count}</strong>
          <small>
            {actor.admin
              ? "Clientes no Console"
              : "Vinculadas ao seu perfil de acesso"}
          </small>
        </div>
      </div>
      {actor.admin && companyCount.count === 0 && (
        <div className="onboarding">
          <div>
            <h2>Vamos cadastrar o primeiro cliente?</h2>
            <p>
              Depois, libere o acesso das pessoas e vincule produtos ou
              projetos.
            </p>
          </div>
          <Link href="/empresas/nova" className="button primary">
            Cadastrar empresa
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
      <div className="two-columns">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Últimos chamados</CardTitle>
              <p>As conversas atualizadas recentemente.</p>
            </div>
            {(actor.admin || supportIds.length > 0) && (
              <Link href="/chamados" aria-label="Ver todos os chamados">
                Ver todos <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </CardHeader>
          {recentTickets.length ? (
            <div className="record-list">
              {recentTickets.map(({ ticket, company }) => (
                <Link
                  href={`/chamados/${ticket.id}`}
                  key={ticket.id}
                  className="record"
                >
                  <div>
                    <strong>{ticket.subject}</strong>
                    <small>{company}</small>
                  </div>
                  <Badge status={ticket.status}>
                    {ticketLabels[ticket.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              headingLevel={3}
              title="Nenhum chamado por aqui"
              description="Os atendimentos aparecerão neste espaço."
            />
          )}
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Últimas faturas</CardTitle>
              <p>Documentos e cobranças mais recentes.</p>
            </div>
            {(actor.admin || financeIds.length > 0) && (
              <Link href="/financeiro" aria-label="Ver todas as faturas">
                Ver todas <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </CardHeader>
          {recentInvoices.length ? (
            <div className="record-list">
              {recentInvoices.map(
                ({ invoice, company, subscriptionStatus }) => (
                  <Link
                    href={`/financeiro/${invoice.id}`}
                    key={invoice.id}
                    className="record"
                  >
                    <div>
                      <strong>{currency(invoice.amountCents)}</strong>
                      <small>
                        {company} · {dateLabel(invoice.dueDate)}
                      </small>
                    </div>
                    <Badge
                      status={
                        invoice.status === "draft" &&
                        subscriptionStatus === "active"
                          ? "scheduled"
                          : invoice.status
                      }
                    >
                      {invoice.status === "draft" &&
                      subscriptionStatus === "active"
                        ? "Agendada"
                        : invoiceLabels[invoice.status]}
                    </Badge>
                  </Link>
                ),
              )}
            </div>
          ) : (
            <Empty
              headingLevel={3}
              title="Nenhuma fatura por aqui"
              description="As faturas disponíveis aparecerão neste espaço."
            />
          )}
        </Card>
      </div>
    </>
  );
}
