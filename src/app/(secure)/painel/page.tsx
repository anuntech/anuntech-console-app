import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { and, count, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  Building2Icon,
  CalendarClockIcon,
  CircleDollarSignIcon,
  FileTextIcon,
  HeadsetIcon,
  PenLineIcon,
  PlusIcon,
  ReceiptTextIcon,
  WalletIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { auditEvents, companies, contracts, invoices, quotes, subscriptions, tickets, user } from "@/db/schema";
import { getActor } from "@/lib/access";
import { auditLabels, currency, dateLabel, relativeLabel } from "@/lib/format";
import { saoPauloDate } from "@/lib/dates";
import { addDays, EXPIRY_WARNING_DAYS } from "@/lib/contract-table";
import { invoiceDisplayStatus } from "@/lib/invoice-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, SectionTitle } from "@/components/console/page-header";
import { TicketStatusBadge } from "@/components/chamados/ticket-badges";
import { InvoiceStatusBadge } from "@/components/financeiro/invoice-badges";
import { BillingChart, type BillingMonth } from "@/components/painel/billing-chart";
import { ActivityFeed, AttentionList, KpiTile, type ActivityEntry, type AttentionItem } from "@/components/painel/dashboard-parts";
import { ClientDashboard } from "@/components/painel/client-dashboard";

export const metadata: Metadata = {
  title: "Visão geral",
  description: "Acompanhe empresas, chamados e faturas no Console da Anuntech.",
};

const TZ = "America/Sao_Paulo";
const MONTHS = 6;

/** "Bom dia" / "Boa tarde" / "Boa noite" in São Paulo time. */
function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

/** The last `MONTHS` months ending in the current one, as "YYYY-MM" with labels. */
function monthWindow(today: string) {
  const [year, month] = today.split("-").map(Number);
  return Array.from({ length: MONTHS }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 - (MONTHS - 1 - i), 1));
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(date).replace(".", ""),
      longLabel: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date),
    };
  });
}

const cents = (value: unknown) => Number(value ?? 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One row of a recent list, with the same hover as the tables. */
function RecentRow({ href, title, detail, status }: { href: string; title: ReactNode; detail: ReactNode; status: ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-muted/50">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{detail}</span>
        </span>
        {status}
      </Link>
    </li>
  );
}

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
      <Link href={href} aria-label={label}>
        Ver todos
        <ArrowRightIcon />
      </Link>
    </Button>
  );
}

/**
 * Staff see the whole Console: billing, what is stuck and the latest activity.
 * Everyone else (including staff inside a company) gets the client widgets.
 */
export default async function Dashboard() {
  const actor = await getActor();
  if (!actor.admin) return <ClientDashboard actor={actor} />;
  const now = new Date();
  const today = saoPauloDate(now);
  const months = monthWindow(today);
  const firstDay = `${months[0].key}-01`;
  const [nextYear, nextMonth] = today.split("-").map(Number);
  const afterLast = new Date(Date.UTC(nextYear, nextMonth, 1)).toISOString().slice(0, 10);

  const actorUser = alias(user, "actor_user");

  const [
    billing,
    [toReceive],
    [overdue],
    [ticketsActive],
    [ticketsWaitingTeam],
    [draftInvoices],
    [quotesSent],
    [contractsSent],
    [contractsExpiring],
    [companyCount],
    recentTickets,
    recentInvoices,
    activity,
  ] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(${invoices.dueDate}::date, 'YYYY-MM')`,
        received: sql<string>`coalesce(sum(${invoices.amountCents}) filter (where ${invoices.status} = 'paid'), 0)`,
        open: sql<string>`coalesce(sum(${invoices.amountCents}) filter (where ${invoices.status} = 'issued'), 0)`,
      })
      .from(invoices)
      .where(and(gte(invoices.dueDate, firstDay), lt(invoices.dueDate, afterLast)))
      .groupBy(sql`1`),
    db
      .select({ n: count(), total: sql<string>`coalesce(sum(${invoices.amountCents}), 0)` })
      .from(invoices)
      .where(and(eq(invoices.status, "issued"), gte(invoices.dueDate, today))),
    db
      .select({ n: count(), total: sql<string>`coalesce(sum(${invoices.amountCents}), 0)` })
      .from(invoices)
      .where(and(eq(invoices.status, "issued"), lt(invoices.dueDate, today))),
    db.select({ n: count() }).from(tickets).where(inArray(tickets.status, ["open", "in_progress", "waiting_customer"])),
    db
      .select({ n: count(), oldest: sql<Date | null>`min(${tickets.updatedAt})` })
      .from(tickets)
      .where(eq(tickets.status, "open")),
    db.select({ n: count() }).from(invoices).where(eq(invoices.status, "draft")),
    db.select({ n: count() }).from(quotes).where(and(eq(quotes.status, "sent"), sql`(${quotes.validUntil} is null or ${quotes.validUntil} >= ${today})`)),
    db.select({ n: count() }).from(contracts).where(eq(contracts.status, "sent")),
    db
      .select({ n: count() })
      .from(contracts)
      .where(and(eq(contracts.status, "signed"), gte(contracts.endsAt, today), lte(contracts.endsAt, addDays(today, EXPIRY_WARNING_DAYS)))),
    db.select({ n: count() }).from(companies).where(eq(companies.archived, false)),
    db
      .select({ ticket: tickets, company: companies.name })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .orderBy(desc(tickets.updatedAt))
      .limit(5),
    db
      .select({ invoice: invoices, company: companies.name, subscriptionStatus: subscriptions.status })
      .from(invoices)
      .innerJoin(companies, eq(companies.id, invoices.companyId))
      .leftJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
      .orderBy(desc(invoices.createdAt))
      .limit(5),
    db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        at: auditEvents.createdAt,
        who: actorUser.name,
        email: actorUser.email,
        // A deleted company's events keep its name in the details.
        where: sql<string | null>`coalesce(${companies.name}, ${auditEvents.details}->>'company')`,
      })
      .from(auditEvents)
      .leftJoin(actorUser, eq(actorUser.id, auditEvents.actorId))
      .leftJoin(companies, eq(companies.id, auditEvents.companyId))
      .where(sql`${auditEvents.action} not like 'account.%'`)
      .orderBy(desc(auditEvents.createdAt))
      .limit(6),
  ]);

  const byMonth = new Map(billing.map((row) => [row.month, row]));
  const chart: BillingMonth[] = months.map((m) => ({
    month: m.key,
    label: m.label,
    longLabel: m.longLabel,
    receivedCents: cents(byMonth.get(m.key)?.received),
    openCents: cents(byMonth.get(m.key)?.open),
  }));
  const thisMonth = chart[chart.length - 1];
  const lastMonth = chart[chart.length - 2];
  const receivedDelta =
    lastMonth.receivedCents > 0 ? { percent: ((thisMonth.receivedCents - lastMonth.receivedCents) / lastMonth.receivedCents) * 100, label: `em relação a ${lastMonth.longLabel}` } : null;

  const candidates: (AttentionItem | false)[] = [
    overdue.n > 0 && {
      key: "overdue",
      icon: <AlertTriangleIcon />,
      tone: "critical" as const,
      title: "Faturas vencidas",
      detail: `${currency(cents(overdue.total))} em atraso`,
      count: overdue.n,
      href: "/financeiro?status=overdue",
    },
    ticketsWaitingTeam.n > 0 && {
      key: "tickets",
      icon: <HeadsetIcon />,
      tone: "warning" as const,
      title: "Chamados aguardando a equipe",
      detail: ticketsWaitingTeam.oldest ? `O mais antigo, ${relativeLabel(ticketsWaitingTeam.oldest, now)}` : undefined,
      count: ticketsWaitingTeam.n,
      href: "/chamados?status=open",
    },
    quotesSent.n > 0 && {
      key: "quotes",
      icon: <FileTextIcon />,
      title: "Orçamentos aguardando resposta",
      count: quotesSent.n,
      href: "/orcamentos?status=sent",
    },
    contractsSent.n > 0 && {
      key: "contracts",
      icon: <PenLineIcon />,
      title: "Contratos aguardando assinatura",
      count: contractsSent.n,
      href: "/contratos?status=sent",
    },
    contractsExpiring.n > 0 && {
      key: "expiring",
      icon: <CalendarClockIcon />,
      tone: "warning" as const,
      title: `Contratos vencendo em ${EXPIRY_WARNING_DAYS} dias`,
      count: contractsExpiring.n,
      href: "/contratos?status=expiring",
    },
    draftInvoices.n > 0 && {
      key: "drafts",
      icon: <ReceiptTextIcon />,
      title: "Cobranças em rascunho",
      detail: "Ainda não emitidas no banco",
      count: draftInvoices.n,
      href: "/financeiro?status=draft",
    },
  ];
  const attention = candidates.filter((item): item is AttentionItem => item !== false);

  const feed: ActivityEntry[] = activity.map((event) => ({
    id: event.id,
    what: auditLabels[event.action] ?? event.action,
    who: event.who || event.email || "Sistema",
    where: event.where,
    at: event.at.toISOString(),
    relative: relativeLabel(event.at, now),
  }));

  const firstName = (actor.user.name || "").trim().split(/\s+/)[0];
  const dateLine = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`${greeting(now)}${firstName ? `, ${firstName}` : ""} · ${dateLine}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/empresas/nova">
                <PlusIcon />
                Cadastrar empresa
              </Link>
            </Button>
            <Button asChild>
              <Link href="/chamados/novo">
                <PlusIcon />
                Abrir chamado
              </Link>
            </Button>
          </>
        }
      />

      {companyCount.n === 0 && (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-card">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-5">
              <Building2Icon />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] leading-6 font-semibold text-foreground">Vamos cadastrar o primeiro cliente?</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Depois, libere o acesso das pessoas e vincule produtos ou projetos.</p>
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

      {/* indicators */}
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile
          label={`Recebido em ${thisMonth.longLabel.split(" ")[0]}`}
          value={currency(thisMonth.receivedCents)}
          icon={<WalletIcon />}
          tone="good"
          delta={receivedDelta}
          detail={<span>de {currency(thisMonth.receivedCents + thisMonth.openCents)} com vencimento no mês</span>}
          href="/financeiro?status=paid"
        />
        <KpiTile
          label="A receber"
          value={currency(cents(toReceive.total))}
          icon={<CircleDollarSignIcon />}
          detail={plural(toReceive.n, "fatura em aberto", "faturas em aberto")}
          href="/financeiro?status=issued"
        />
        <KpiTile
          label="Em atraso"
          value={currency(cents(overdue.total))}
          icon={<AlertTriangleIcon />}
          tone={overdue.n > 0 ? "critical" : "default"}
          detail={overdue.n > 0 ? plural(overdue.n, "fatura vencida", "faturas vencidas") : "Nenhuma fatura vencida"}
          href="/financeiro?status=overdue"
        />
        <KpiTile
          label="Chamados em andamento"
          value={ticketsActive.n}
          icon={<HeadsetIcon />}
          tone={ticketsWaitingTeam.n > 0 ? "warning" : "default"}
          detail={ticketsWaitingTeam.n > 0 ? `${plural(ticketsWaitingTeam.n, "aguardando", "aguardando")} a equipe` : "Nenhum aguardando a equipe"}
          href="/chamados"
        />
      </div>

      {/* billing + attention */}
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <SectionTitle
              title="Faturamento"
              description={`Por mês de vencimento, nos últimos ${MONTHS} meses.`}
              action={<SeeAll href="/financeiro" label="Ver o financeiro" />}
            />
          </CardHeader>
          <CardContent>
            <BillingChart months={chart} />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <SectionTitle
              title="Precisa de atenção"
              description={attention.length ? `${plural(attention.reduce((n, i) => n + i.count, 0), "item", "itens")} esperando alguém.` : "O que está parado aparece aqui."}
            />
          </CardHeader>
          <CardContent className="px-0">
            <AttentionList items={attention} />
          </CardContent>
        </Card>
      </div>

      {/* recent work */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader>
            <SectionTitle title="Últimos chamados" description="Atualizados recentemente." action={<SeeAll href="/chamados" label="Ver todos os chamados" />} />
          </CardHeader>
          <CardContent className="px-0">
            {recentTickets.length ? (
              <ul className="divide-y border-t">
                {recentTickets.map(({ ticket, company }) => (
                  <RecentRow key={ticket.id} href={`/chamados/${ticket.id}`} title={ticket.subject} detail={company} status={<TicketStatusBadge status={ticket.status} />} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={<HeadsetIcon />} title="Nenhum chamado por aqui" description="Os atendimentos aparecem neste espaço." className="py-10" />
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <SectionTitle title="Últimas faturas" description="Cobranças mais recentes." action={<SeeAll href="/financeiro" label="Ver todas as faturas" />} />
          </CardHeader>
          <CardContent className="px-0">
            {recentInvoices.length ? (
              <ul className="divide-y border-t">
                {recentInvoices.map(({ invoice, company, subscriptionStatus }) => (
                  <RecentRow
                    key={invoice.id}
                    href={`/financeiro/${invoice.id}`}
                    title={<span className="tabular-nums">{currency(invoice.amountCents)}</span>}
                    detail={`${company} · ${dateLabel(invoice.dueDate)}`}
                    status={
                      <InvoiceStatusBadge
                        status={invoiceDisplayStatus({ status: invoice.status, dueDate: invoice.dueDate, scheduled: subscriptionStatus === "active" }, today)}
                      />
                    }
                  />
                ))}
              </ul>
            ) : (
              <EmptyState icon={<ReceiptTextIcon />} title="Nenhuma fatura por aqui" description="As faturas aparecem neste espaço." className="py-10" />
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <SectionTitle title="Atividade" description="O que aconteceu por último no Console." />
          </CardHeader>
          <CardContent>
            <ActivityFeed entries={feed} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
