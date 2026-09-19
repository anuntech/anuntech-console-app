import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, tickets, invoices } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { Heading, Empty, Badge } from "@/components/ui";
import { ticketLabels, invoiceLabels, currency, dateLabel } from "@/lib/format";
import {
  MessagesSquare,
  ReceiptText,
  Building2,
  ArrowUpRight,
} from "lucide-react";
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
      .select({ invoice: invoices, company: companies.name })
      .from(invoices)
      .innerJoin(companies, eq(companies.id, invoices.companyId))
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
        description="Acompanhe o que precisa da sua atenção."
      />
      <div className="stats">
        <div className="stat">
          <MessagesSquare />
          <span>Chamados em andamento</span>
          <strong>{ticketCount.count}</strong>
        </div>
        <div className="stat">
          <ReceiptText />
          <span>{actor.admin ? "Faturas em rascunho" : "Faturas a pagar"}</span>
          <strong>{invoiceCount.count}</strong>
        </div>
        <div className="stat">
          <Building2 />
          <span>
            {actor.admin ? "Empresas cadastradas" : "Empresas com acesso"}
          </span>
          <strong>{companyCount.count}</strong>
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
            <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      <div className="two-columns">
        <section className="panel">
          <div className="panel-heading">
            <h2>Últimos chamados</h2>
            <Link href="/chamados">Ver todos →</Link>
          </div>
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
              title="Nenhum chamado por aqui"
              description="Os atendimentos aparecerão neste espaço."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Últimas faturas</h2>
            <Link href="/financeiro">Ver todas →</Link>
          </div>
          {recentInvoices.length ? (
            <div className="record-list">
              {recentInvoices.map(({ invoice, company }) => (
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
                  <Badge status={invoice.status}>
                    {invoiceLabels[invoice.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="Nenhuma fatura por aqui"
              description="As faturas disponíveis aparecerão neste espaço."
            />
          )}
        </section>
      </div>
    </>
  );
}
