import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  Building2Icon,
  HeadsetIcon,
  PlusIcon,
  ReceiptTextIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { companies, tickets, invoices, subscriptions } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { currency, dateLabel } from "@/lib/format";
import { saoPauloDate } from "@/lib/dates";
import { invoiceDisplayStatus } from "@/lib/invoice-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  EmptyState,
  PageHeader,
  SectionTitle,
} from "@/components/console/page-header";
import { TicketStatusBadge } from "@/components/chamados/ticket-badges";
import { InvoiceStatusBadge } from "@/components/financeiro/invoice-badges";
export const metadata: Metadata = {
  title: "Visão geral",
  description: "Acompanhe empresas, chamados e faturas no Console da Anuntech.",
};

/* The Financeiro totals card without the link: a count here can cover an
   area the person is not allowed to open. */
function Metric({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-card">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tracking-[-0.02em] tabular-nums text-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
        {icon}
      </span>
    </div>
  );
}

/** One row of a recent list, with the same hover as the Chamados table. */
function RecentRow({
  href,
  title,
  detail,
  status,
}: {
  href: string;
  title: ReactNode;
  detail: ReactNode;
  status: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-muted/50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
            {title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {detail}
          </span>
        </span>
        {status}
      </Link>
    </li>
  );
}

export default async function Dashboard() {
  const actor = await getActor();
  const supportIds = allowedIds(actor, "support"),
    financeIds = allowedIds(actor, "finance");
  const today = saoPauloDate();
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
  const canSupport = actor.admin || supportIds.length > 0;
  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Seu espaço de trabalho."
        actions={
          <>
            {actor.admin && (
              <Button variant="outline" asChild>
                <Link href="/empresas/nova">
                  <PlusIcon />
                  Cadastrar empresa
                </Link>
              </Button>
            )}
            {canSupport && (
              <Button asChild>
                <Link href="/chamados/novo">
                  <PlusIcon />
                  Abrir chamado
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Metric
          label="Chamados em andamento"
          value={ticketCount.count}
          hint="Solicitações que ainda precisam de atenção"
          icon={<HeadsetIcon />}
        />
        <Metric
          label={actor.admin ? "Faturas não emitidas" : "Faturas a pagar"}
          value={invoiceCount.count}
          hint={
            actor.admin
              ? "Rascunhos e cobranças agendadas"
              : "Cobranças disponíveis para pagamento"
          }
          icon={<ReceiptTextIcon />}
        />
        <Metric
          label={actor.admin ? "Empresas cadastradas" : "Empresas com acesso"}
          value={companyCount.count}
          hint={
            actor.admin
              ? "Clientes no Console"
              : "Vinculadas ao seu perfil de acesso"
          }
          icon={<Building2Icon />}
        />
      </div>
      {actor.admin && companyCount.count === 0 && (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-card">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-5">
              <Building2Icon />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] leading-6 font-semibold text-foreground">
                Vamos cadastrar o primeiro cliente?
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Depois, libere o acesso das pessoas e vincule produtos ou
                projetos.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/empresas/nova">
              Cadastrar empresa
              <ArrowUpRightIcon />
            </Link>
          </Button>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <SectionTitle
              title="Últimos chamados"
              description="As conversas atualizadas recentemente."
              action={
                canSupport && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    asChild
                  >
                    <Link href="/chamados" aria-label="Ver todos os chamados">
                      Ver todos
                      <ArrowRightIcon />
                    </Link>
                  </Button>
                )
              }
            />
          </CardHeader>
          <CardContent className="px-0">
            {recentTickets.length ? (
              <ul className="divide-y border-t">
                {recentTickets.map(({ ticket, company }) => (
                  <RecentRow
                    key={ticket.id}
                    href={`/chamados/${ticket.id}`}
                    title={ticket.subject}
                    detail={company}
                    status={<TicketStatusBadge status={ticket.status} />}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<HeadsetIcon />}
                title="Nenhum chamado por aqui"
                description="Os atendimentos aparecerão neste espaço."
                className="py-10"
              />
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <SectionTitle
              title="Últimas faturas"
              description="Documentos e cobranças mais recentes."
              action={
                (actor.admin || financeIds.length > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    asChild
                  >
                    <Link href="/financeiro" aria-label="Ver todas as faturas">
                      Ver todas
                      <ArrowRightIcon />
                    </Link>
                  </Button>
                )
              }
            />
          </CardHeader>
          <CardContent className="px-0">
            {recentInvoices.length ? (
              <ul className="divide-y border-t">
                {recentInvoices.map(
                  ({ invoice, company, subscriptionStatus }) => (
                    <RecentRow
                      key={invoice.id}
                      href={`/financeiro/${invoice.id}`}
                      title={
                        <span className="tabular-nums">
                          {currency(invoice.amountCents)}
                        </span>
                      }
                      detail={`${company} · ${dateLabel(invoice.dueDate)}`}
                      status={
                        <InvoiceStatusBadge
                          status={invoiceDisplayStatus(
                            {
                              status: invoice.status,
                              dueDate: invoice.dueDate,
                              scheduled: subscriptionStatus === "active",
                            },
                            today,
                          )}
                        />
                      }
                    />
                  ),
                )}
              </ul>
            ) : (
              <EmptyState
                icon={<ReceiptTextIcon />}
                title="Nenhuma fatura por aqui"
                description="As faturas disponíveis aparecerão neste espaço."
                className="py-10"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
