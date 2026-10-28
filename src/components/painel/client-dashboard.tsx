import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  BanIcon,
  BookmarkIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HeadsetIcon,
  PackageIcon,
  PenLineIcon,
  PlusIcon,
  PresentationIcon,
  ReceiptTextIcon,
  WalletIcon,
  Clock3Icon,
  CheckCircle2Icon,
} from "lucide-react";
import { catalogIconSrc } from "@/lib/catalog/catalog-icons";
import { ProductIcon } from "@/components/console/product-icon";
import type { Actor } from "@/lib/access/access";
import { clientOverview } from "@/lib/painel/client-overview";
import { boardHref, kindOf } from "@/lib/bookmarks/board-rules";
import { dateLabel } from "@/lib/format";
import { appForUrl, protectedApps } from "@/lib/apps/registry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/console/page-header";
import { TicketStatusBadge } from "@/components/chamados/ticket-badges";
import { FirstStepsCard } from "@/components/guide/first-steps-card";
import { firstStepsFor } from "@/lib/guide/first-steps";
import { HoursBankCard } from "@/components/service-terms/hours-bank-card";
import { InvoiceStatusBadge } from "@/components/financeiro/invoice-badges";
import { EngagementStatusBadge } from "@/components/projetos/project-badges";
import { AttentionList, type AttentionItem } from "@/components/painel/dashboard-parts";
import { companyDisplayName } from "@/lib/companies/display-name";
import { Money, MoneyScope } from "@/components/console/money";
import { MoneyToggle } from "@/components/console/money-toggle";
import { moneyHidden } from "@/lib/money-visibility-server";

/**
 * The client's Painel: what they have with Anuntech and what needs them,
 * as widgets. No revenue panorama; money shows only as what is left to pay.
 * Staff see it too by entering a company ("Entrar como esta empresa").
 *
 * One fact, one place: each widget is the only place for what it lists (no
 * tiles above repeating its count), "Precisa de atenção" holds only what no
 * widget already shows (an overdue invoice has its row and "Pagar" in A pagar;
 * the hours bank warns in its own card) and is left out when empty.
 */

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

/** The accessible name starts with the visible "Ver todos" (WCAG 2.5.3) and adds the area. */
function SeeAll({ href, area }: { href: string; area: string }) {
  return (
    <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
      <Link href={href} aria-label={`Ver todos: ${area}`}>
        Ver todos
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
  description?: ReactNode;
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
            <h2 className="text-body font-medium text-foreground">{title}</h2>
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

/* Neutral: a row's icon says what it is; colour is kept for what needs attention. */
const Tile = ({ icon }: { icon: ReactNode }) => (
  <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground [&_svg]:size-4">{icon}</span>
);

export async function ClientDashboard({ actor }: { actor: Actor }) {
  const now = new Date();
  const manyCompanies = actor.grants.length > 1;
  const apps = protectedApps();
  // The lists come from clientOverview, shared with the app's overview.get.
  const {
    today,
    canSupport,
    canFinance,
    openInvoices,
    dueTotals,
    ticketsWaiting,
    quotesToAnswer,
    contractsToSign,
    projects,
    progress,
    products,
    suspended,
    recentTickets,
    folders,
    bookmarkPage,
    nextCharge,
    banks,
    estimates,
    toReview,
  } = await clientOverview(actor, now);
  const folderName = new Map(folders.map((f) => [f.id, f.name]));

  // An overdue invoice is not listed here: A pagar shows it first, marked Vencida, with "Pagar".
  const candidates: (AttentionItem | false)[] = [
    ticketsWaiting > 0 && {
      key: "tickets",
      icon: <HeadsetIcon />,
      tone: "warning" as const,
      title: "Chamados esperando sua resposta",
      count: ticketsWaiting,
      href: "/chamados?status=waiting_customer",
    },
    quotesToAnswer > 0 && {
      key: "quotes",
      icon: <FileTextIcon />,
      title: "Orçamentos para você responder",
      count: quotesToAnswer,
      href: "/orcamentos?status=sent",
    },
    contractsToSign > 0 && {
      key: "contracts",
      icon: <PenLineIcon />,
      title: "Contratos para você assinar",
      count: contractsToSign,
      href: "/contratos?status=sent",
    },
  ];
  const attention = candidates.filter((item): item is AttentionItem => item !== false);
  // Suspended products come first: the client pays or talks to the team (the list on Produtos says how).
  if (suspended.length)
    attention.unshift({
      key: "suspended",
      icon: <BanIcon />,
      tone: "critical",
      title: suspended.length === 1 ? `${suspended[0].name} está suspenso` : "Produtos suspensos",
      detail: "Nenhum dado foi apagado. Veja como reativar",
      count: suspended.length,
      href: "/produtos",
    });

  const firstSteps = await firstStepsFor(actor);
  // A bank past its alert says so in its own card, at the top of the page (bar in amber and the rule).
  if (estimates.length > 0)
    attention.push({ key: "estimates", icon: <Clock3Icon />, title: "Estimativas de melhoria para aprovar", count: estimates.length, href: "/chamados" });
  // Deliveries waiting for the Administrador's test: approve or point out a problem on each card.
  if (toReview.length) {
    const projects = new Set(toReview.map((t) => t.projectId));
    attention.push({
      key: "reviews",
      icon: <CheckCircle2Icon />,
      tone: "warning",
      title: "Entregas para você revisar",
      detail: "Aprove ou aponte o problema em cada cartão",
      count: toReview.length,
      href: projects.size === 1 ? `/projetos/${[...projects][0]}` : "/projetos",
    });
  }
  const firstName = (actor.user.name || "").trim().split(/\s+/)[0];
  // Only someone who sees money gets the eye; a Membro has no values to hide.
  const valuesHidden = canFinance && (await moneyHidden());
  const dateLine = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <MoneyScope hidden={valuesHidden}>
      <PageHeader
        title="Visão geral"
        description={`${greeting(now)}${firstName ? `, ${firstName}` : ""} · ${dateLine}`}
        actions={
          (canFinance || canSupport) && (
            <>
              {canFinance && <MoneyToggle hidden={valuesHidden} />}
              {canSupport && (
                <Button asChild>
                  <Link href="/chamados/novo">
                    <PlusIcon />
                    Abrir chamado
                  </Link>
                </Button>
              )}
            </>
          )
        }
      />
      {firstSteps && <FirstStepsCard data={firstSteps} />}
      {banks.map(({ bank, viewer }) => (
        <div key={bank.companyId} id={`banco-de-horas-${bank.companyId}`} className="mb-6 scroll-mt-6">
          <HoursBankCard viewer={viewer} bank={bank} showCompany={banks.length > 1} />
        </div>
      ))}

      {/* One grid, most pressing first: widgets with nothing to say are left out and the rest close the gap. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {canFinance && (
          <Widget
            title="A pagar"
            // The total only when it sums several rows; a single invoice shows its own value.
            description={dueTotals.n > 1 ? <><Money cents={Number(dueTotals.total)} /> em {dueTotals.n} faturas</> : undefined}
            action={<SeeAll href="/financeiro" area="faturas" />}
          >
            {openInvoices.length ? (
              <ul className="divide-y border-t">
                {openInvoices.map(({ invoice, company, document }) => {
                  const payable = invoice.publicEnabled && invoice.publicId;
                  const late = invoice.dueDate < today;
                  return (
                    <li key={invoice.id} className="flex items-center gap-3 px-6 py-3">
                      <Tile icon={<ReceiptTextIcon />} />
                      <Link href={`/financeiro/${invoice.id}`} className="group min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{invoice.description}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {/* on phones the amount and the status ride in this line */}
                          <span className="tabular-nums sm:hidden"><Money cents={invoice.amountCents} /> · </span>
                          {manyCompanies ? `${companyDisplayName(company, document)} · ` : ""}
                          <span className={late ? "text-destructive sm:text-muted-foreground" : undefined}>
                            {/* From sm up the Vencida badge says it; on phones the badge is hidden and the verb says it. */}
                            {late ? <span className="sm:hidden">venceu </span> : "vence "}
                            {dateLabel(invoice.dueDate)}
                          </span>
                        </span>
                      </Link>
                      <span className="hidden text-sm font-medium text-foreground tabular-nums sm:block"><Money cents={invoice.amountCents} /></span>
                      {/* Every row here is open; only an overdue one says so. */}
                      {late && (
                        <span className="hidden sm:contents">
                          <InvoiceStatusBadge status="overdue" />
                        </span>
                      )}
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
                    ? <>A próxima cobrança, de <Money cents={nextCharge.amountCents} />, vence em {dateLabel(nextCharge.dueDate)}. Boleto e Pix chegam até {dateLabel(nextCharge.issueDate)}.</>
                    : "Quando houver uma fatura em aberto, ela aparece aqui."
                }
                className="py-10"
              />
            )}
          </Widget>
        )}
        {attention.length > 0 && (
          <Widget title="Precisa de atenção">
            <AttentionList items={attention} />
          </Widget>
        )}
        <Widget title="Projetos" action={<SeeAll href="/projetos" area="projetos" />}>
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
                        {manyCompanies && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{companyDisplayName(project.company, project.document)}</span>}
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
        <Widget title="Produtos e serviços" action={<SeeAll href="/produtos" area="produtos e serviços" />}>
          {products.length ? (
            <ul className="divide-y border-t">
              {products.map((product) => {
                // A protected app opens inside the Console; other products, their own link.
                const app = product.kind === "product" && appForUrl(product.url, apps);
                const link = product.kind === "product" && !app ? webUrl(product.url) : null;
                return (
                  <Row
                    key={product.id}
                    href={app ? `/apps/${product.id}` : (link ?? (product.kind === "service" ? `/produtos/${product.id}` : "/produtos"))}
                    external={!!link}
                    leading={<ProductIcon src={catalogIconSrc(product.catalogItemId, product.icon)} name={product.name} size={32} />}
                    title={product.name}
                    detail={[product.status === "suspended" ? "Suspenso" : null, product.kind === "product" ? "Produto" : "Serviço", manyCompanies ? companyDisplayName(product.company, product.document) : null].filter(Boolean).join(" · ")}
                  />
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<PackageIcon />} title="Nenhum produto ou serviço ativo" description="Os produtos e serviços contratados aparecem aqui." className="py-10" />
          )}
        </Widget>
        {canSupport && (
          <Widget title="Últimos chamados" action={<SeeAll href="/chamados" area="chamados" />}>
            {recentTickets.length ? (
              <ul className="divide-y border-t">
                {recentTickets.map(({ ticket, company, document }) => (
                  <Row
                    key={ticket.id}
                    href={`/chamados/${ticket.id}`}
                    leading={<Tile icon={<HeadsetIcon />} />}
                    title={ticket.subject}
                    detail={manyCompanies ? companyDisplayName(company, document) : undefined}
                    trailing={<TicketStatusBadge status={ticket.status} client />}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState icon={<HeadsetIcon />} title="Nenhum chamado por aqui" description="Quando precisar de ajuda, abra um chamado e acompanhe a conversa." className="py-10" />
            )}
          </Widget>
        )}
        <Widget title="Arquivos" action={<SeeAll href="/bookmarks" area="bookmarks" />}>
          {bookmarkPage.items.length ? (
            <ul className="divide-y border-t">
              {bookmarkPage.items.map((item) => {
                const board = kindOf(item) === "board";
                const link = board ? null : webUrl(item.url);
                return (
                  <Row
                    key={item.id}
                    href={board ? boardHref(item.id) : (link ?? (item.fileName ? `/api/bookmarks/${item.id}` : "/bookmarks"))}
                    external={!!link}
                    download={!board && !link && item.fileName ? item.fileName : undefined}
                    leading={<Tile icon={board ? <PresentationIcon /> : link ? <BookmarkIcon /> : <FileTextIcon />} />}
                    title={item.title}
                    detail={[board ? "Lousa" : link ? new URL(link).hostname : item.fileName, item.folderId ? folderName.get(item.folderId) : null].filter(Boolean).join(" · ")}
                  />
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<BookmarkIcon />} title="Nenhum arquivo ainda" description="Guarde arquivos, links e lousas da sua empresa em Arquivos." className="py-10" />
          )}
        </Widget>
      </div>
    </MoneyScope>
  );
}
