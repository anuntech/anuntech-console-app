import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "cn";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookmarkIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HeadsetIcon,
  PackageIcon,
  PenLineIcon,
  PlusIcon,
  ReceiptTextIcon,
  WalletIcon,
  Clock3Icon,
} from "lucide-react";
import { db } from "@/lib/db";
import { companies, contractSignatures, contracts, engagements, invoices, quotes, tasks, tickets } from "@/db/schema";
import { allowedIds, canAccess, type Actor } from "@/lib/access/access";
import { bookmarksFor, foldersFor, scopeOf } from "@/lib/bookmarks/bookmarks";
import { currency, dateLabel } from "@/lib/format";
import { saoPauloDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/console/page-header";
import { TicketStatusBadge } from "@/components/chamados/ticket-badges";
import { FirstStepsCard } from "@/components/guide/first-steps-card";
import { firstStepsFor } from "@/lib/guide/first-steps";
import { upcomingCharges } from "@/lib/billing/upcoming-charges";
import { bankCard, type BankCard } from "@/lib/service-terms/hours-bank";
import { HoursBankCard } from "@/components/service-terms/hours-bank-card";
import { InvoiceStatusBadge } from "@/components/financeiro/invoice-badges";
import { EngagementStatusBadge } from "@/components/projetos/project-badges";
import { AttentionList, KpiTile, type AttentionItem } from "@/components/painel/dashboard-parts";

/**
 * The client's Painel: what they have with Anuntech and what needs them,
 * as widgets. No revenue panorama; money shows only as what is left to pay.
 * Staff see it too by entering a company ("Entrar como esta empresa").
 */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const TZ = "America/Sao_Paulo";

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

/** Only web links open outside (the actions accept nothing else). */
function webUrl(url: string | null) {
  if (!url) return null;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
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

function Widget({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-4 py-5", className ?? "min-w-0")}>
      <CardHeader>
        {/* the link stays on the title's line; the description wraps beside it */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] leading-6 font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="-mt-1 shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}

function Row({
  href,
  external,
  download,
  leading,
  title,
  detail,
  trailing,
}: {
  href: string;
  external?: boolean;
  /** A file: the browser saves it under this name instead of navigating. */
  download?: string;
  leading?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">{title}</span>
          {external && <ExternalLinkIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />}
        </span>
        {detail ? <span className="block truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      {trailing}
    </>
  );
  const className = "group flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/50";
  return (
    <li>
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {body}
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      ) : download ? (
        <a href={href} download={download} className={className}>
          {body}
        </a>
      ) : (
        <Link href={href} className={className}>
          {body}
        </Link>
      )}
    </li>
  );
}

const Tile = ({ icon }: { icon: ReactNode }) => (
  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">{icon}</span>
);

export async function ClientDashboard({ actor }: { actor: Actor }) {
  const now = new Date();
  const today = saoPauloDate(now);
  const workIds = allowedIds(actor, "overview");
  const supportIds = allowedIds(actor, "support");
  const financeIds = allowedIds(actor, "finance");
  const canSupport = supportIds.length > 0;
  const canFinance = financeIds.length > 0;
  const manyCompanies = actor.grants.length > 1;
  const none = sql`false`;
  const workScope = (column: typeof engagements.companyId) => (workIds.length ? inArray(column, workIds) : none);
  const scope = scopeOf(actor);

  const [
    openInvoices,
    [dueTotals],
    [ticketsActive],
    [ticketsWaiting],
    [quotesToAnswer],
    [contractsToSign],
    projects,
    products,
    [productCount],
    recentTickets,
    folders,
  ] = await Promise.all([
    canFinance
      ? db
          .select({ invoice: invoices, company: companies.name })
          .from(invoices)
          .innerJoin(companies, eq(companies.id, invoices.companyId))
          .where(and(inArray(invoices.companyId, financeIds), eq(invoices.status, "issued")))
          .orderBy(asc(invoices.dueDate), asc(invoices.id))
          .limit(5)
      : [],
    canFinance
      ? db
          .select({
            n: count(),
            total: sql<string>`coalesce(sum(${invoices.amountCents}), 0)`,
            overdueN: sql<number>`count(*) filter (where ${invoices.dueDate} < ${today})::int`,
            overdueTotal: sql<string>`coalesce(sum(${invoices.amountCents}) filter (where ${invoices.dueDate} < ${today}), 0)`,
          })
          .from(invoices)
          .where(and(inArray(invoices.companyId, financeIds), eq(invoices.status, "issued")))
      : [{ n: 0, total: "0", overdueN: 0, overdueTotal: "0" }],
    canSupport
      ? db.select({ n: count() }).from(tickets).where(and(inArray(tickets.companyId, supportIds), inArray(tickets.status, ["open", "in_progress", "waiting_customer"])))
      : [{ n: 0 }],
    canSupport
      ? db.select({ n: count() }).from(tickets).where(and(inArray(tickets.companyId, supportIds), eq(tickets.status, "waiting_customer")))
      : [{ n: 0 }],
    canFinance
      ? db
          .select({ n: count() })
          .from(quotes)
          .where(and(inArray(quotes.companyId, financeIds), eq(quotes.status, "sent"), sql`(${quotes.validUntil} is null or ${quotes.validUntil} >= ${today})`))
      : [{ n: 0 }],
    // Only what still waits for the client's signature, not what waits for Anuntech's.
    canFinance
      ? db
          .select({ n: count() })
          .from(contracts)
          .where(
            and(
              inArray(contracts.companyId, financeIds),
              eq(contracts.status, "sent"),
              sql`not exists (select 1 from ${contractSignatures} where ${contractSignatures.contractId} = ${contracts.id} and ${contractSignatures.party} = 'client')`,
            ),
          )
      : [{ n: 0 }],
    db
      .select({ id: engagements.id, name: engagements.name, status: engagements.status, company: companies.name })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .where(and(workScope(engagements.companyId), eq(engagements.kind, "project"), inArray(engagements.status, ["active", "paused"])))
      .orderBy(asc(engagements.status), asc(engagements.name))
      .limit(4),
    db
      .select({ id: engagements.id, name: engagements.name, kind: engagements.kind, url: engagements.url, company: companies.name })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .where(and(workScope(engagements.companyId), inArray(engagements.kind, ["product", "service"]), eq(engagements.status, "active")))
      .orderBy(asc(engagements.name))
      .limit(5),
    db
      .select({ n: count() })
      .from(engagements)
      .where(and(workScope(engagements.companyId), inArray(engagements.kind, ["product", "service"]), eq(engagements.status, "active"))),
    canSupport
      ? db
          .select({ ticket: tickets, company: companies.name })
          .from(tickets)
          .innerJoin(companies, eq(companies.id, tickets.companyId))
          .where(inArray(tickets.companyId, supportIds))
          .orderBy(desc(tickets.updatedAt))
          .limit(5)
      : [],
    foldersFor(scope, "all"),
  ]);

  // Task progress only for the projects on screen.
  const progress = projects.length
    ? await db
        .select({
          engagementId: tasks.engagementId,
          total: count(),
          done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
        })
        .from(tasks)
        .where(inArray(tasks.engagementId, projects.map((p) => p.id)))
        .groupBy(tasks.engagementId)
    : [];
  const [projectTotals] = await db
    .select({
      n: sql<number>`count(distinct ${engagements.id})::int`,
      openTasks: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'done')::int`,
    })
    .from(engagements)
    .leftJoin(tasks, eq(tasks.engagementId, engagements.id))
    .where(and(workScope(engagements.companyId), eq(engagements.kind, "project"), eq(engagements.status, "active")));
  const bookmarkPage = await bookmarksFor(scope, folders.map((f) => f.id), { folder: "all", search: "", company: "all" }, { page: 1, pageSize: 5 });
  const folderName = new Map(folders.map((f) => [f.id, f.name]));

  const candidates: (AttentionItem | false)[] = [
    dueTotals.overdueN > 0 && {
      key: "overdue",
      icon: <AlertTriangleIcon />,
      tone: "critical" as const,
      title: "Faturas vencidas para pagar",
      detail: `${currency(Number(dueTotals.overdueTotal))} em atraso`,
      count: dueTotals.overdueN,
      href: "/financeiro?status=overdue",
    },
    ticketsWaiting.n > 0 && {
      key: "tickets",
      icon: <HeadsetIcon />,
      tone: "warning" as const,
      title: "Chamados esperando sua resposta",
      count: ticketsWaiting.n,
      href: "/chamados?status=waiting_customer",
    },
    quotesToAnswer.n > 0 && {
      key: "quotes",
      icon: <FileTextIcon />,
      title: "Orçamentos para você responder",
      count: quotesToAnswer.n,
      href: "/orcamentos?status=sent",
    },
    contractsToSign.n > 0 && {
      key: "contracts",
      icon: <PenLineIcon />,
      title: "Contratos para você assinar",
      count: contractsToSign.n,
      href: "/contratos?status=sent",
    },
  ];
  const attention = candidates.filter((item): item is AttentionItem => item !== false);

  const firstSteps = await firstStepsFor(actor);
  // With nothing open, the next recurring charge says when the next boleto comes.
  const [nextCharge] = canFinance && !dueTotals.n ? await upcomingCharges({ admin: false, companyIds: financeIds }) : [];
  // Each company's hours bank, once its conditions are published, and estimates waiting for an Administrador.
  const banks = (
    await Promise.all(actor.grants.map((g) => bankCard(g.company.id, g.company.name, { client: true, now })))
  ).filter((b): b is BankCard => !!b);
  const [estimates] = canFinance
    ? await db
        .select({ n: count() })
        .from(tickets)
        .where(and(inArray(tickets.companyId, financeIds), eq(tickets.estimateStatus, "proposed")))
    : [{ n: 0 }];
  for (const bank of banks) {
    const percent = bank.includedMinutes ? Math.round((bank.usedMinutes / bank.includedMinutes) * 100) : 0;
    if (percent < bank.alertPercent) continue;
    attention.push({
      key: `bank-${bank.companyId}`,
      icon: <Clock3Icon />,
      tone: "warning",
      title: banks.length > 1 ? `Banco de horas de ${bank.companyName} em ${percent}%` : `Banco de horas em ${percent}%`,
      detail: "Fora defeito crítico, nada passa do banco sem a aprovação de um Administrador",
      count: Math.round(bank.usedMinutes / 60),
      href: `#banco-de-horas-${bank.companyId}`,
    });
  }
  if (estimates.n > 0)
    attention.push({ key: "estimates", icon: <Clock3Icon />, title: "Estimativas de melhoria para aprovar", count: estimates.n, href: "/chamados" });
  const firstName = (actor.user.name || "").trim().split(/\s+/)[0];
  const dateLine = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now);
  const next = openInvoices[0]?.invoice;

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`${greeting(now)}${firstName ? `, ${firstName}` : ""} · ${dateLine}`}
        actions={
          canSupport && (
            <Button asChild>
              <Link href="/chamados/novo">
                <PlusIcon />
                Abrir chamado
              </Link>
            </Button>
          )
        }
      />
      {firstSteps && <FirstStepsCard data={firstSteps} />}
      {banks.map((bank) => (
        <div key={bank.companyId} id={`banco-de-horas-${bank.companyId}`} className="mb-6 scroll-mt-6">
          <HoursBankCard viewer={canAccess(actor, bank.companyId, "finance") ? "approver" : "member"} bank={bank} showCompany={banks.length > 1} />
        </div>
      ))}

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {canFinance && (
          <KpiTile
            label="A pagar"
            value={currency(Number(dueTotals.total))}
            icon={<WalletIcon />}
            tone={dueTotals.overdueN > 0 ? "critical" : "default"}
            detail={
              dueTotals.n
                ? dueTotals.overdueN > 0
                  ? `${plural(dueTotals.overdueN, "vencida", "vencidas")} · ${plural(dueTotals.n, "fatura", "faturas")}`
                  : `Próxima em ${dateLabel(next!.dueDate)}`
                : nextCharge
                  ? `Próxima: ${currency(nextCharge.amountCents)} em ${dateLabel(nextCharge.dueDate)}`
                  : "Nada em aberto"
            }
            // The list's "Em aberto" leaves out overdue invoices; those are the urgent ones.
            href={dueTotals.overdueN > 0 ? "/financeiro?status=overdue" : dueTotals.n ? "/financeiro?status=issued" : "/financeiro"}
          />
        )}
        {canSupport && (
          <KpiTile
            label="Chamados em andamento"
            value={ticketsActive.n}
            icon={<HeadsetIcon />}
            tone={ticketsWaiting.n > 0 ? "warning" : "default"}
            detail={ticketsWaiting.n > 0 ? `${plural(ticketsWaiting.n, "esperando", "esperando")} você` : "Nada esperando você"}
            href="/chamados"
          />
        )}
        <KpiTile
          label="Projetos ativos"
          value={projectTotals.n}
          icon={<FolderKanbanIcon />}
          detail={projectTotals.openTasks ? plural(projectTotals.openTasks, "tarefa em aberto", "tarefas em aberto") : "Nenhuma tarefa em aberto"}
          href="/projetos"
        />
        <KpiTile label="Produtos e serviços" value={productCount.n} icon={<PackageIcon />} detail="Contratados com a Anuntech" href="/produtos" />
      </div>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
        {canFinance && (
          <Widget title="A pagar" action={<SeeAll href="/financeiro" label="Ver todas as faturas" />}>
            {openInvoices.length ? (
              <ul className="divide-y border-t">
                {openInvoices.map(({ invoice, company }) => {
                  const payable = invoice.publicEnabled && invoice.publicId;
                  const late = invoice.dueDate < today;
                  return (
                    <li key={invoice.id} className="flex items-center gap-3 px-6 py-3">
                      <Tile icon={<ReceiptTextIcon />} />
                      <Link href={`/financeiro/${invoice.id}`} className="group min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{invoice.description}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {/* on phones the amount and the status ride in this line */}
                          <span className="tabular-nums sm:hidden">{currency(invoice.amountCents)} · </span>
                          {manyCompanies ? `${company} · ` : ""}
                          <span className={late ? "text-destructive sm:text-muted-foreground" : undefined}>
                            {late ? "venceu" : "vence"} {dateLabel(invoice.dueDate)}
                          </span>
                        </span>
                      </Link>
                      <span className="hidden text-sm font-medium text-foreground tabular-nums sm:block">{currency(invoice.amountCents)}</span>
                      <span className="hidden sm:contents">
                        <InvoiceStatusBadge status={late ? "overdue" : "issued"} />
                      </span>
                      {payable && (
                        <Button size="sm" asChild>
                          <Link href={`/pagar/${invoice.publicId}`}>Pagar</Link>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={<WalletIcon />}
                title="Nada a pagar agora"
                description={
                  nextCharge
                    ? `A próxima cobrança, de ${currency(nextCharge.amountCents)}, vence em ${dateLabel(nextCharge.dueDate)}. Boleto e Pix chegam até ${dateLabel(nextCharge.issueDate)}.`
                    : "Quando houver uma fatura em aberto, ela aparece aqui."
                }
                className="py-10"
              />
            )}
          </Widget>
        )}
        <Widget title="Precisa de atenção" className={canFinance ? "min-w-0" : "min-w-0 lg:col-span-2"}>
          <AttentionList items={attention} />
        </Widget>
      </div>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
        <Widget title="Projetos" action={<SeeAll href="/projetos" label="Ver todos os projetos" />}>
          {projects.length ? (
            <ul className="divide-y border-t">
              {projects.map((project) => {
                const p = progress.find((row) => row.engagementId === project.id);
                const total = p?.total ?? 0;
                const done = p?.done ?? 0;
                const percent = total ? Math.round((done / total) * 100) : 0;
                return (
                  <li key={project.id}>
                    <Link href={`/projetos/${project.id}`} className="group flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/50">
                      <Tile icon={<FolderKanbanIcon />} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground group-hover:text-primary">{project.name}</span>
                          {project.status !== "active" && <EngagementStatusBadge status={project.status} />}
                        </span>
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {total ? `${done}/${total} tarefas` : "Sem tarefas"}
                          </span>
                        </span>
                        {manyCompanies && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{project.company}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<FolderKanbanIcon />} title="Nenhum projeto em andamento" description="Quando a Anuntech iniciar um projeto com você, o quadro aparece aqui." className="py-10" />
          )}
        </Widget>
        <Widget title="Produtos e serviços" action={<SeeAll href="/produtos" label="Ver todos os produtos e serviços" />}>
          {products.length ? (
            <ul className="divide-y border-t">
              {products.map((product) => {
                const link = product.kind === "product" ? webUrl(product.url) : null;
                return (
                  <Row
                    key={product.id}
                    href={link ?? (product.kind === "service" ? `/produtos/${product.id}` : "/produtos")}
                    external={!!link}
                    leading={<Tile icon={<PackageIcon />} />}
                    title={product.name}
                    detail={[product.kind === "product" ? "Produto" : "Serviço", manyCompanies ? product.company : null].filter(Boolean).join(" · ")}
                  />
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<PackageIcon />} title="Nenhum produto ou serviço ativo" description="Os produtos e serviços contratados aparecem aqui." className="py-10" />
          )}
        </Widget>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {canSupport && (
          <Widget title="Últimos chamados" action={<SeeAll href="/chamados" label="Ver todos os chamados" />}>
            {recentTickets.length ? (
              <ul className="divide-y border-t">
                {recentTickets.map(({ ticket, company }) => (
                  <Row
                    key={ticket.id}
                    href={`/chamados/${ticket.id}`}
                    leading={<Tile icon={<HeadsetIcon />} />}
                    title={ticket.subject}
                    detail={manyCompanies ? company : undefined}
                    trailing={<TicketStatusBadge status={ticket.status} client />}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState icon={<HeadsetIcon />} title="Nenhum chamado por aqui" description="Quando precisar de ajuda, abra um chamado e acompanhe a conversa." className="py-10" />
            )}
          </Widget>
        )}
        <Widget title="Bookmarks" action={<SeeAll href="/bookmarks" label="Ver todos os bookmarks" />}>
          {bookmarkPage.items.length ? (
            <ul className="divide-y border-t">
              {bookmarkPage.items.map((item) => {
                const link = webUrl(item.url);
                return (
                  <Row
                    key={item.id}
                    href={link ?? (item.fileName ? `/api/bookmarks/${item.id}` : "/bookmarks")}
                    external={!!link}
                    download={!link && item.fileName ? item.fileName : undefined}
                    leading={<Tile icon={link ? <BookmarkIcon /> : <FileTextIcon />} />}
                    title={item.title}
                    detail={[link ? new URL(link).hostname : item.fileName, item.folderId ? folderName.get(item.folderId) : null].filter(Boolean).join(" · ")}
                  />
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<BookmarkIcon />} title="Nenhum bookmark ainda" description="Guarde links e arquivos da sua empresa em Bookmarks." className="py-10" />
          )}
        </Widget>
      </div>
    </>
  );
}
