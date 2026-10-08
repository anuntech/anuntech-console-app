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
  ScaleIcon,
  ClockIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { expiredDebtCondition, expiredDebts, expiringCharges, failingRecurrences, leavingCharges } from "@/lib/billing/billing-watch";
import { quietFor, staleRoutines } from "@/lib/ops/cron-health";
import { unreachableStaff } from "@/lib/notifications/ops-delivery";
import { staffEmails } from "@/lib/notifications/ops-alerts";
import { deliveryEventLabel } from "@/lib/notifications/ops-digest-text";
import { interCertificateExpiry } from "@/lib/integrations/integrations";
import { commercialFollowUp } from "@/lib/commercial/follow-up";
import { supportFollowUp } from "@/lib/tickets/support-follow-up";
import { clientsFollowUp } from "@/lib/companies/clients-follow-up";
import { collectionFollowUp } from "@/lib/billing/collections";
import { readjustFollowUp } from "@/lib/contracts/readjust";
import { auditEvents, companies, contracts, invoices, quotes, serviceTerms, subscriptions, tickets, user } from "@/db/schema";
import { getActor } from "@/lib/access/access";
import { auditLabels, currency, dateLabel, relativeLabel } from "@/lib/format";
import { saoPauloDate } from "@/lib/dates";
import { addDays, EXPIRY_WARNING_DAYS } from "@/lib/contracts/contract-table";
import { invoiceDisplayStatus } from "@/lib/billing/invoice-table";
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
  description: "O que está em andamento e o que precisa de atenção.",
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
    [contractsInReview],
    [contractsExpiring],
    [companyCount],
    recentTickets,
    recentInvoices,
    activity,
    [ticketsDue],
    [unsetTerms],
    [pausedRecurrences],
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
    // Same split as the Financeiro list: a draft of an active recurrence is "Agendada",
    // issued by the recurrence itself; only the other drafts wait for someone.
    db
      .select({ n: count() })
      .from(invoices)
      .leftJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
      .where(and(eq(invoices.status, "draft"), sql`${subscriptions.status} is distinct from 'active'`)),
    db.select({ n: count() }).from(quotes).where(and(eq(quotes.status, "sent"), sql`(${quotes.validUntil} is null or ${quotes.validUntil} >= ${today})`)),
    db.select({ n: count() }).from(contracts).where(eq(contracts.status, "sent")),
    db.select({ n: count() }).from(contracts).where(eq(contracts.status, "in_review")),
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
      .select({ invoice: invoices, company: companies.name, subscriptionStatus: subscriptions.status, expired: sql<boolean>`${expiredDebtCondition}` })
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
    // Unanswered tickets whose first response is due within a business hour, or late.
    db
      .select({
        n: count(),
        late: sql<number>`count(*) filter (where ${tickets.responseDueAt} < now())::int`,
      })
      .from(tickets)
      .where(
        and(
          sql`${tickets.firstResponseAt} is null`,
          inArray(tickets.status, ["open", "in_progress"]),
          sql`${tickets.responseDueAt} < now() + interval '1 hour'`,
        ),
      ),
    // Companies with a signed contract and no verified conditions: their tickets have no deadline.
    db
      .select({ n: sql<number>`count(distinct ${contracts.companyId})::int` })
      .from(contracts)
      .where(
        and(
          eq(contracts.status, "signed"),
          sql`not exists (select 1 from ${serviceTerms} where ${serviceTerms.companyId} = ${contracts.companyId} and ${serviceTerms.active} and ${serviceTerms.verifiedAt} is not null)`,
        ),
      ),
    // A paused recurrence issues nothing until someone fixes and resumes it.
    db
      .select({ n: count() })
      .from(subscriptions)
      .innerJoin(companies, eq(companies.id, subscriptions.companyId))
      .where(and(eq(subscriptions.status, "paused"), eq(companies.archived, false))),
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

  // What would cost money if nobody looked: the same lists the morning digest sends (lib/billing/billing-watch.ts).
  const [failing, expiredDebt, expiring, leaving, stale, unreachable] = await Promise.all([
    failingRecurrences(),
    expiredDebts(),
    expiringCharges(today),
    leavingCharges(today),
    staleRoutines(now),
    staffEmails().then(unreachableStaff),
  ]);
  const certificateEnds = interCertificateExpiry();
  // Expired is decided by the clock, so the first hours after the end never read "vence em 0 dias".
  const certificateDays = certificateEnds
    ? certificateEnds.getTime() <= now.getTime()
      ? -1
      : Math.ceil((certificateEnds.getTime() - now.getTime()) / 86_400_000)
    : null;
  const candidates: (AttentionItem | false)[] = [
    certificateDays !== null && certificateDays <= 30 && {
      key: "inter-certificate",
      icon: <AlertTriangleIcon />,
      tone: "critical" as const,
      title: certificateDays < 0 ? "Certificado do Inter vencido" : "Certificado do Inter perto de vencer",
      detail: certificateDays < 0 ? "Emissão e conciliação estão paradas" : `Vence em ${certificateDays === 1 ? "1 dia" : `${certificateDays} dias`}; troque na Vercel antes`,
      count: 1,
      href: "/configuracoes/integracoes",
    },
    unreachable.length > 0 && {
      key: "unreachable-staff",
      icon: <AlertTriangleIcon />,
      tone: "critical" as const,
      title: "Alertas da equipe que não chegam",
      detail: unreachable.map((u) => `${u.email} (${deliveryEventLabel(u.event)})`).join(", "),
      count: unreachable.length,
      href: "/configuracoes/membros",
    },
    stale.length > 0 && {
      key: "stale-routines",
      icon: <AlertTriangleIcon />,
      tone: "critical" as const,
      title: stale.length === 1 ? `Rotina parada: ${stale[0].label}` : "Rotinas paradas",
      detail: stale.map((r) => `${r.label}: ${quietFor(r.minutes)}`).join(" · "),
      count: stale.length,
      href: "/configuracoes/integracoes",
    },
    pausedRecurrences.n + failing.length > 0 && {
      key: "paused-recurrences",
      icon: <AlertTriangleIcon />,
      tone: "critical" as const,
      title: "Recorrências que precisam de você",
      detail: "Pausadas, com cadastro incompleto ou com a emissão falhando; o motivo está em Próximas cobranças",
      count: pausedRecurrences.n + failing.length,
      href: "/financeiro",
    },
    expiredDebt.length > 0 && {
      key: "expired-debts",
      icon: <AlertTriangleIcon />,
      tone: "critical" as const,
      title: "Expiradas no Inter sem pagamento",
      detail: `${currency(expiredDebt.reduce((sum, i) => sum + i.amountCents, 0))} que ninguém cobrou de novo`,
      count: expiredDebt.length,
      href: "/financeiro?status=expired",
    },
    expiring.length > 0 && {
      key: "expiring-charges",
      icon: <ClockIcon />,
      tone: "warning" as const,
      title: "Boletos que o Inter encerra em até 7 dias",
      detail: `${currency(expiring.reduce((sum, i) => sum + i.amountCents, 0))} ainda sem pagamento`,
      count: expiring.length,
      href: expiring.length === 1 ? `/financeiro/${expiring[0].id}` : "/financeiro?status=overdue",
    },
    leaving.length > 0 && {
      key: "leaving-charges",
      icon: <AlertTriangleIcon />,
      tone: "warning" as const,
      title: "Cobrança de quem encerrou",
      detail: leaving.length === 1 ? `${leaving[0].company}: ${leaving[0].reason}` : "Serviço concluído ou contrato vencido com a recorrência ativa",
      count: leaving.length,
      href: "/financeiro",
    },
    overdue.n > 0 && {
      key: "overdue",
      icon: <AlertTriangleIcon />,
      tone: "critical" as const,
      title: "Faturas vencidas",
      detail: `${currency(cents(overdue.total))} em atraso`,
      count: overdue.n,
      href: "/financeiro?status=overdue",
    },
    ticketsDue.n > 0 && {
      key: "tickets-due",
      icon: <ClockIcon />,
      tone: "critical" as const,
      title: "Chamados perto do prazo de resposta",
      detail: ticketsDue.late ? `${plural(ticketsDue.late, "já atrasado", "já atrasados")}` : "Vencem na próxima hora útil",
      count: ticketsDue.n,
      href: "/chamados?status=active",
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
    contractsInReview.n > 0 && {
      key: "contract-reviews",
      icon: <PenLineIcon />,
      tone: "warning" as const,
      title: "Contratos com pedidos de alteração",
      detail: "O cliente espera uma nova versão",
      count: contractsInReview.n,
      href: "/contratos?status=in_review",
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

  if (unsetTerms.n > 0)
    candidates.push({
      key: "terms",
      icon: <ScaleIcon />,
      title: "Contratos assinados sem condições",
      detail: "Os chamados dessas empresas ficam sem prazo",
      count: unsetTerms.n,
      href: "/empresas",
    });
  // Sales and project work waiting on someone (the same groups the morning digest lists).
  const followUp = new Map(
    (await Promise.all([collectionFollowUp(today), commercialFollowUp(today), readjustFollowUp(today), supportFollowUp(now), clientsFollowUp(now)])).flat().map((group) => [group.key, group.items]),
  );
  const followItem = (keys: string[], item: Omit<AttentionItem, "count" | "href"> & { href: string }) => {
    // One line per record, even when it falls in two groups (waiting past the deadline and with an estimate).
    const items = [...new Map(keys.flatMap((key) => followUp.get(key) ?? []).map((item) => [item.href, item])).values()];
    if (items.length) candidates.push({ ...item, count: items.length, href: items.length === 1 ? items[0].href : item.href });
  };
  followItem(["awaiting-anuntech"], {
    key: "awaiting-anuntech",
    icon: <PenLineIcon />,
    tone: "warning",
    title: "Falta a assinatura da Anuntech",
    detail: "O cliente já assinou",
    href: "/contratos?status=sent",
  });
  followItem(["no-manager"], {
    key: "no-manager",
    icon: <Building2Icon />,
    tone: "warning",
    title: "Clientes sem Administrador",
    detail: "Têm contrato, orçamento ou cobrança, e ninguém para assinar ou responder",
    href: "/empresas",
  });
  followItem(["collections"], {
    key: "collections",
    icon: <WalletIcon />,
    tone: "critical",
    title: "Atrasos para cobrar",
    detail: "Mais de 25 dias, sem contato combinado; o texto sai pronto",
    href: "/financeiro/atrasos",
  });
  followItem(["marked-received"], {
    key: "marked-received",
    icon: <WalletIcon />,
    tone: "warning",
    title: "Marcadas como recebidas no Inter",
    detail: "Pagas fora do boleto? Confirme na fatura para os lembretes pararem",
    href: "/financeiro",
  });
  followItem(["readjusts"], {
    key: "readjusts",
    icon: <FileTextIcon />,
    title: "Reajustes de contrato a preparar",
    detail: "Aniversário em até 30 dias; o aditivo sai com o IPCA e o novo valor",
    href: "/contratos",
  });
  followItem(["fiscal-queue"], {
    key: "fiscal-queue",
    icon: <ReceiptTextIcon />,
    title: "Notas fiscais a emitir",
    detail: "Faturas pagas de clientes com nota automática; a emissão pela Focus espera os parâmetros da contabilidade",
    href: "/financeiro?status=paid",
  });
  followItem(["stalled-invites"], {
    key: "stalled-invites",
    icon: <Building2Icon />,
    tone: "warning",
    title: "Convites sem primeiro acesso",
    detail: "Há 3 dias ou mais; reenvie pelo menu da pessoa na empresa",
    href: "/empresas",
  });
  followItem(["onboarding"], {
    key: "onboarding",
    icon: <Building2Icon />,
    title: "Implantação pendente",
    detail: "Clientes novos com passos faltando; a ficha está na página da empresa",
    href: "/empresas",
  });
  followItem(["contacts"], {
    key: "contacts",
    icon: <Building2Icon />,
    title: "Contatos para revisar",
    detail: "Telefone fixo como WhatsApp, e-mail que não chega ou documento inválido",
    href: "/empresas",
  });
  followItem(["idle-access", "archived-access", "idle-staff"], {
    key: "access-review",
    icon: <Building2Icon />,
    title: "Acessos para revisar",
    detail: "Sem entrar há 90 dias, ou em empresas arquivadas",
    href: "/empresas",
  });
  followItem(["accepted-no-contract"], {
    key: "accepted-no-contract",
    icon: <FileTextIcon />,
    title: "Orçamentos aceitos sem contrato",
    detail: "O contrato sai preenchido a partir do orçamento",
    href: "/orcamentos?status=accepted",
  });
  followItem(["quotes-expiring", "quotes-expired", "quotes-no-validity"], {
    key: "quotes-follow-up",
    icon: <FileTextIcon />,
    title: "Orçamentos sem resposta",
    detail: "Perto de vencer, expirados há pouco ou sem validade",
    href: "/orcamentos?status=sent",
  });
  followItem(["contracts-stalled"], {
    key: "contracts-stalled",
    icon: <PenLineIcon />,
    title: "Contratos parados sem assinatura do cliente",
    detail: "Enviados há mais de 7 dias",
    href: "/contratos?status=sent",
  });
  followItem(["hours-alerts"], {
    key: "banks",
    icon: <ClockIcon />,
    tone: "warning",
    title: "Bancos de horas no limite sem aviso",
    detail: "Avise o cliente e peça aprovação antes de passar do banco",
    href: "/empresas",
  });
  followItem(["hours-reports"], {
    key: "hours-reports",
    icon: <ClockIcon />,
    title: "Relatórios de horas a enviar",
    detail: "O prazo de contestação só começa com o envio",
    href: "/empresas",
  });
  followItem(["hours-overage"], {
    key: "hours-overage",
    icon: <ReceiptTextIcon />,
    tone: "warning",
    title: "Horas além do banco prontas para cobrar",
    detail: "O prazo de contestação terminou; a cobrança sai preenchida",
    href: "/empresas",
  });
  followItem(["tickets-waiting", "estimates-waiting"], {
    key: "tickets-waiting",
    icon: <HeadsetIcon />,
    title: "Chamados parados no cliente",
    detail: "Esperando resposta além do prazo, ou estimativa sem resposta",
    href: "/chamados?status=waiting_customer",
  });
  followItem(["tickets-no-hours"], {
    key: "tickets-no-hours",
    icon: <ClockIcon />,
    title: "Chamados terminados sem horas",
    detail: "Em empresas com banco de horas: registre ou marque que não houve",
    href: "/chamados?status=resolved",
  });
  followItem(["review-problems"], {
    key: "review-problems",
    icon: <AlertTriangleIcon />,
    tone: "warning",
    title: "Problemas apontados em entregas",
    detail: "O cliente testou e o cartão voltou para Em andamento",
    href: "/projetos",
  });
  followItem(["backlog-requests", "reviews-overdue"], {
    key: "projects-follow-up",
    icon: <ClockIcon />,
    title: "Pedidos e entregas parados",
    detail: "Pedidos do cliente no Backlog e entregas com o prazo de teste vencido",
    href: "/projetos",
  });
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
        <Card className="min-w-0 gap-4 py-5 lg:col-span-2">
          <CardHeader>
            <SectionTitle
              title="Faturamento"
              action={<SeeAll href="/financeiro" label="Ver o financeiro" />}
            />
          </CardHeader>
          <CardContent>
            <BillingChart months={chart} />
          </CardContent>
        </Card>
        <Card className="min-w-0 gap-4 py-5">
          <CardHeader>
            <SectionTitle
              title="Precisa de atenção"
            />
          </CardHeader>
          <CardContent className="px-0">
            <AttentionList items={attention} />
          </CardContent>
        </Card>
      </div>

      {/* recent work */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="min-w-0 gap-4 py-5">
          <CardHeader>
            <SectionTitle title="Últimos chamados" action={<SeeAll href="/chamados" label="Ver todos os chamados" />} />
          </CardHeader>
          <CardContent className="px-0">
            {recentTickets.length ? (
              <ul className="divide-y border-t">
                {recentTickets.map(({ ticket, company }) => (
                  <RecentRow key={ticket.id} href={`/chamados/${ticket.id}`} title={ticket.subject} detail={company} status={<TicketStatusBadge status={ticket.status} />} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={<HeadsetIcon />} title="Nenhum chamado por aqui" description="Quando um cliente abrir um chamado, ele aparece aqui." className="py-10" />
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0 gap-4 py-5">
          <CardHeader>
            <SectionTitle title="Últimas faturas" action={<SeeAll href="/financeiro" label="Ver todas as faturas" />} />
          </CardHeader>
          <CardContent className="px-0">
            {recentInvoices.length ? (
              <ul className="divide-y border-t">
                {recentInvoices.map(({ invoice, company, subscriptionStatus, expired }) => (
                  <RecentRow
                    key={invoice.id}
                    href={`/financeiro/${invoice.id}`}
                    title={<span className="tabular-nums">{currency(invoice.amountCents)}</span>}
                    detail={`${company} · ${dateLabel(invoice.dueDate)}`}
                    status={
                      <InvoiceStatusBadge
                        status={invoiceDisplayStatus({ status: invoice.status, dueDate: invoice.dueDate, scheduled: subscriptionStatus === "active", expired }, today)}
                      />
                    }
                  />
                ))}
              </ul>
            ) : (
              <EmptyState icon={<ReceiptTextIcon />} title="Nenhuma fatura por aqui" description="As cobranças emitidas aparecem aqui." className="py-10" />
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0 gap-4 py-5">
          <CardHeader>
            <SectionTitle title="Atividade" />
          </CardHeader>
          <CardContent>
            <ActivityFeed entries={feed} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
