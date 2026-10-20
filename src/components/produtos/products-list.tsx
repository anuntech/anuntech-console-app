"use client";
import { SearchField } from "@/components/console/search-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  AppWindowIcon,
  ArrowUpRightIcon,
  BanIcon,
  Building2Icon,
  ChevronRightIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
  PackageIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardGrid, GridCard, useListLayout, ViewToggle } from "@/components/console/list-grid";
import { ProductIcon } from "@/components/console/product-icon";
import { EmptyState } from "@/components/console/page-header";
import type { ListLayout } from "@/lib/list-layout";
import {
  CompanyCell,
  FilterChip,
  LinkRow,
  ListCard,
  ListPagination,
  PrimaryCell,
  RowActions,
} from "@/components/console/list-view";
import {
  projectFilterLabels,
  projectFilters,
  projectListHref,
  type ProjectListQuery,
  type ProjectStatusFilter,
} from "@/lib/projects/project-table";
import { EngagementStatusBadge } from "@/components/projetos/project-badges";
import { currency, dateLabel } from "@/lib/format";
import { canDeleteEngagement, type EngagementLinks } from "@/lib/deletion-rules";
import { useEngagementStatus, type EngagementStatus } from "@/components/projetos/engagement-status";
import { DeleteEngagementDialog } from "@/components/projetos/delete-engagement-dialog";
import { ProductSheet, type ProductFormValues } from "./product-form";
import { SuspensionStageBadge, useSuspension } from "./suspension";
import type { SuspensionView } from "@/lib/suspensions/suspension-view";

/** Present only where the viewer sees money (the team and the company's Administradores). */
export type ProductMoney = {
  amountCents: number | null;
  interval: "monthly" | "yearly" | null;
  nextDueDate: string | null;
  subscriptionId: string | null;
};
export type ProductRow = {
  id: string;
  kind: "product" | "service";
  name: string;
  status: string;
  description: string | null;
  url: string | null;
  companyId: string;
  company: string;
  /** The catalog item's icon (catalogIconSrc), or null for initials. */
  icon: string | null;
  /** Set when the URL is an app that only runs inside the Console (lib/apps/registry.ts). */
  appPage?: string | null;
  money?: ProductMoney;
  /** Staff only: what points at it, so "Excluir" shows only when it can go. */
  links?: EngagementLinks;
  /** Staff only: the open suspension, scheduled or carried out. */
  suspension?: SuspensionView;
};
const intervalLabel = { monthly: "/mês", yearly: "/ano" } as const;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Only web links open from the list (the actions accept nothing else). */
function webUrl(url: string | null) {
  if (!url) return null;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

function ProductRowActions({
  row,
  admin,
  consolePage,
  link,
  onEdit,
  onStatus,
  onSuspend,
}: {
  row: ProductRow;
  admin: boolean;
  consolePage: string | null;
  link: string | null;
  onEdit: (values: ProductFormValues) => void;
  onStatus: (id: string, status: EngagementStatus, name?: string) => void;
  onSuspend: (row: ProductRow) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const deletable = admin && canDeleteEngagement(row.links);
  return (
    <RowActions
      label={row.name}
      extra={
        deletable && (
          <DeleteEngagementDialog
            engagement={{ id: row.id, name: row.name, kind: row.kind }}
            fromList
            open={deleting}
            onOpenChange={setDeleting}
          />
        )
      }
    >
      {consolePage ? (
        <DropdownMenuItem asChild>
          <Link href={consolePage}>
            {row.kind === "service" ? <WrenchIcon /> : <AppWindowIcon />}
            {row.kind === "service" ? "Abrir serviço" : "Abrir produto"}
          </Link>
        </DropdownMenuItem>
      ) : link ? (
        <DropdownMenuItem asChild>
          <a href={link} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon />
            Abrir produto
          </a>
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem disabled>
          <ExternalLinkIcon />
          Sem link cadastrado
        </DropdownMenuItem>
      )}
      {admin && (
        <>
          <DropdownMenuItem
            onSelect={() =>
              // Let the menu close before the sheet takes focus.
              setTimeout(
                () =>
                  onEdit({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    url: row.url,
                    amountCents: row.money?.amountCents ?? null,
                    subscriptionId: row.money?.subscriptionId ?? null,
                  }),
                0,
              )
            }
          >
            <PencilIcon />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/empresas/${row.companyId}`}>
              <Building2Icon />
              Ver empresa
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(row.suspension || row.status === "active") && (
            <DropdownMenuItem onSelect={() => onSuspend(row)}>
              <BanIcon />
              {row.suspension ? (row.status === "suspended" ? "Suspensão e reativação" : "Ver suspensão agendada") : "Suspender…"}
            </DropdownMenuItem>
          )}
          {/* A suspended product changes only through its suspension. */}
          {row.status !== "active" && row.status !== "suspended" && (
            <DropdownMenuItem onSelect={() => onStatus(row.id, "active")}>
              <PlayIcon />
              {row.status === "paused" ? "Reativar" : "Reabrir"}
            </DropdownMenuItem>
          )}
          {row.status === "active" && (
            <DropdownMenuItem onSelect={() => onStatus(row.id, "paused", row.name)}>
              <PauseIcon />
              Pausar
            </DropdownMenuItem>
          )}
          {row.status !== "completed" && row.status !== "suspended" && (
            <DropdownMenuItem onSelect={() => onStatus(row.id, "completed", row.name)}>
              <CircleCheckIcon />
              Encerrar
            </DropdownMenuItem>
          )}
        </>
      )}
      {deletable && (
        <>
          <DropdownMenuSeparator />
          {/* Opened after the menu closes, so the dialog takes focus from a settled page. */}
          <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => setDeleting(true), 0)}>
            <Trash2Icon />
            Excluir
          </DropdownMenuItem>
        </>
      )}
    </RowActions>
  );
}

/**
 * Where a row opens: a service's page, a protected app inside the Console
 * (it refuses to open on its own), or the product's own link in a new tab.
 */
function destinationOf(row: ProductRow) {
  const consolePage = row.kind === "service" ? `/produtos/${row.id}` : (row.appPage ?? null);
  const link = consolePage ? null : row.kind === "product" ? webUrl(row.url) : null;
  return { consolePage, link, href: consolePage ?? link };
}

/** One line under the name: the item's own description, else where it lives. */
function lineOf(row: ProductRow) {
  const description = row.description?.trim();
  if (description) return description;
  if (row.kind === "service") return "Serviço da Anuntech";
  return row.url ? hostOf(row.url) : "Produto da Anuntech";
}

/**
 * A client's product or service, launcher style: the icon, the name, one line
 * and what a click does. No money and no menu (the card itself opens the item).
 * On a phone the tiles become divided rows.
 *
 *   ┌───────────────────────┐        [icon] Synova            Abrir ↗
 *   │ [icon 56]             │               CRM pelo WhatsApp
 *   │ Synova                │
 *   │ CRM pelo WhatsApp     │
 *   │ (Pausado)     Abrir ↗ │
 *   └───────────────────────┘
 */
function ClientTile({ row, company }: { row: ProductRow; company: string | null }) {
  const { consolePage, href } = destinationOf(row);
  const cover =
    "text-foreground no-underline outline-none group-hover/card:text-primary hover:no-underline after:absolute after:inset-0 after:content-[''] sm:after:rounded-xl";
  const name = !href ? (
    row.name
  ) : consolePage ? (
    <Link href={consolePage} prefetch={false} className={cover}>
      {row.name}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cover}>
      {row.name}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
  const status = row.status !== "active" && <EngagementStatusBadge status={row.status} />;
  return (
    <li
      className={cn(
        "group/card relative flex min-w-0 items-center gap-3 px-4 py-3 transition-colors",
        "sm:flex-col sm:items-stretch sm:gap-0 sm:rounded-xl sm:border sm:bg-card sm:p-4",
        // Inset on phones: the full-width row sits in a scrolling card that would clip an outer ring.
        href && "hover:bg-accent/40 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 max-sm:has-[:focus-visible]:ring-inset sm:hover:border-primary/30",
      )}
    >
      <ProductIcon src={row.icon} name={row.name} size={56} className="max-sm:[--icon:44px]!" />
      <div className="min-w-0 flex-1 sm:mt-3">
        <p className="m-0 truncate text-sm leading-5 font-semibold">{name}</p>
        {company && <p className="m-0 truncate text-xs text-muted-foreground">{company}</p>}
        <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground sm:line-clamp-2 sm:whitespace-normal">{lineOf(row)}</p>
        {status && <div className="mt-1.5 sm:hidden">{status}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs sm:mt-auto sm:pt-4">
        {status && <span className="max-sm:hidden">{status}</span>}
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex items-center gap-1 font-medium whitespace-nowrap sm:ml-auto [&_svg]:size-3.5",
            href ? "text-primary" : "text-muted-foreground",
          )}
        >
          {row.kind === "service" ? (
            <>
              <span className="max-sm:sr-only">Ver detalhes</span>
              <ChevronRightIcon />
            </>
          ) : consolePage ? (
            <>
              Abrir
              <ChevronRightIcon />
            </>
          ) : href ? (
            <>
              Abrir
              <ArrowUpRightIcon />
            </>
          ) : (
            "Link em breve"
          )}
        </span>
      </div>
    </li>
  );
}

function Price({ money, large = false }: { money: ProductMoney | undefined; large?: boolean }) {
  if (money?.amountCents == null) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <span className={cn("text-foreground", large ? "text-base font-semibold" : "font-medium")}>{currency(money.amountCents)}</span>
      {money.interval && <span className="text-muted-foreground">{intervalLabel[money.interval]}</span>}
    </>
  );
}

/** The products and services companies have with Anuntech; each row opens the service page or the product's link. */
export function ProductsList({
  rows,
  query,
  total,
  pageCount,
  admin,
  showCompany,
  showMoney,
  compact = false,
  companyFilter = null,
  companyShortcuts = [],
  actions,
  view = "grid",
}: {
  rows: ProductRow[];
  query: ProjectListQuery;
  total: number;
  pageCount: number;
  admin: boolean;
  /** False when everything belongs to the viewer's single company. */
  showCompany: boolean;
  /** Price and due date columns: the team, and Administradores of at least one company listed. */
  showMoney: boolean;
  /** A client's short list with nothing paused: no search and no status filter. */
  compact?: boolean;
  companyFilter?: { id: string; name: string } | null;
  /** Companies whose name matches the search, offered as a one-click filter. */
  companyShortcuts?: { id: string; name: string }[];
  /** The page's own buttons, at the right end of the toolbar. */
  actions?: ReactNode;
  /** List or grid, as the viewer last chose (the page reads it from a cookie). */
  view?: ListLayout;
}) {
  const router = useRouter();
  const [layout, chooseLayout] = useListLayout("products", view);
  const [editing, setEditing] = useState<ProductFormValues | null>(null);
  const { change, form: statusForm } = useEngagementStatus();
  const suspension = useSuspension(rows);
  const href = (patch: Partial<ProjectListQuery>) => projectListHref({ ...query, ...patch }, "/produtos");
  const go = (patch: Partial<ProjectListQuery>) => router.push(href(patch), { scroll: false });
  const filtered = !!query.search || !!query.company || query.status !== "active";
  const spansCompanies = showCompany && !query.company;
  // Staff get the company as its own column while the list spans companies; a
  // client with several companies keeps it in the subtitle.
  const companyColumn = admin && spansCompanies;
  const subtitle = (row: ProductRow, inCard = false) =>
    [
      (inCard || !admin) && spansCompanies ? row.company : "",
      row.kind === "service" ? "Serviço" : "Produto",
      row.kind === "product" ? (row.url ? hostOf(row.url) : "Sem link cadastrado") : "",
    ]
      .filter(Boolean)
      .join(" · ");
  const menu = (row: ProductRow) => {
    const { consolePage, link } = destinationOf(row);
    return (
      <ProductRowActions row={row} admin={admin} consolePage={consolePage} link={link} onEdit={setEditing} onStatus={change} onSuspend={suspension.open} />
    );
  };

  return (
    <ListCard
      fill
      actions={actions}
      label="Lista de produtos e serviços"
      layout={<ViewToggle view={layout} onChange={chooseLayout} />}
      toolbar={
        compact ? null : (
          <>
            <SearchField
              value={query.search}
              onChange={(search) => go({ search, page: 1 })}
              placeholder={showCompany ? "Buscar por nome ou empresa" : "Buscar por nome"}
            />
            {companyFilter && (
              <FilterChip
                icon={<Building2Icon />}
                label={companyFilter.name}
                removeHref={href({ company: "", page: 1 })}
              />
            )}
            <Select
              value={query.status}
              onValueChange={(status) => go({ status: status as ProjectStatusFilter, page: 1 })}
            >
              <SelectTrigger aria-label="Filtrar por situação" className="w-auto min-w-36">
                <SelectValue>{projectFilterLabels[query.status]}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {projectFilters.map((status) => (
                  <SelectItem key={status} value={status}>
                    {projectFilterLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {companyShortcuts.length > 0 && (
              <div className="order-last flex basis-full flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Só desta empresa:</span>
                {companyShortcuts.map((company) => (
                  <Link
                    key={company.id}
                    href={href({ company: company.id, search: "", page: 1 })}
                    scroll={false}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-background px-2.5 font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
                  >
                    <Building2Icon className="size-3.5 text-muted-foreground" />
                    {company.name}
                  </Link>
                ))}
              </div>
            )}
          </>
        )
      }
      footer={
        <ListPagination
          page={query.page}
          pageSize={query.pageSize}
          total={total}
          pageCount={pageCount}
          noun={["item", "itens"]}
          hrefFor={href}
        />
      }
    >
      {rows.length && layout === "grid" && !admin ? (
        <CardGrid className="max-sm:gap-0 max-sm:divide-y max-sm:p-0 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {rows.map((row) => (
            <ClientTile key={row.id} row={row} company={spansCompanies ? row.company : null} />
          ))}
        </CardGrid>
      ) : rows.length && layout === "grid" ? (
        <CardGrid>
          {rows.map((row) => {
            const { consolePage, href: destination } = destinationOf(row);
            return (
              <GridCard
                key={row.id}
                href={destination}
                external={!consolePage}
                leading={<ProductIcon src={row.icon} name={row.name} size={40} />}
                title={row.name}
                subtitle={subtitle(row, true)}
                actions={menu(row)}
                footer={
                  (row.status !== "active" || row.suspension || row.money?.nextDueDate) && (
                    <>
                      {row.status !== "active" && <EngagementStatusBadge status={row.status} />}
                      <SuspensionStageBadge suspension={row.suspension} />
                      {row.money?.nextDueDate && (
                        <span className="ml-auto shrink-0 tabular-nums">Vence em {dateLabel(row.money.nextDueDate)}</span>
                      )}
                    </>
                  )
                }
              >
                {row.money?.amountCents != null && (
                  <p className="m-0 tabular-nums">
                    <Price money={row.money} large />
                  </p>
                )}
              </GridCard>
            );
          })}
        </CardGrid>
      ) : rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Produto ou serviço</TableHead>
              {companyColumn && <TableHead className="hidden md:table-cell">Empresa</TableHead>}
              <TableHead>Situação</TableHead>
              {showMoney && (
                <>
                  <TableHead className="hidden text-right md:table-cell">Valor</TableHead>
                  <TableHead className="hidden md:table-cell">Próximo vencimento</TableHead>
                </>
              )}
              {admin && (
                <TableHead className="w-12 pr-3">
                  <span className="sr-only">Ações</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const { consolePage, href: destination } = destinationOf(row);
              return (
                <LinkRow key={row.id} href={destination} external={!consolePage}>
                  <PrimaryCell
                    href={destination}
                    external={!consolePage}
                    leading={<ProductIcon src={row.icon} name={row.name} size={32} />}
                    title={row.name}
                    subtitle={subtitle(row)}
                  />
                  {companyColumn && <CompanyCell>{row.company}</CompanyCell>}
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <EngagementStatusBadge status={row.status} />
                      <SuspensionStageBadge suspension={row.suspension} />
                    </span>
                  </TableCell>
                  {showMoney && (
                    <>
                      <TableCell className="hidden text-right whitespace-nowrap tabular-nums md:table-cell">
                        <Price money={row.money} />
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums md:table-cell">
                        {row.money?.nextDueDate ? dateLabel(row.money.nextDueDate) : "—"}
                      </TableCell>
                    </>
                  )}
                  {admin && menu(row)}
                </LinkRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<PackageIcon />}
          title={filtered ? "Nenhum produto ou serviço encontrado" : "Nenhum produto ou serviço ativo"}
          description={
            filtered
              ? "Tente outro termo ou mude os filtros."
              : admin
                ? "Vincule um item do catálogo a um cliente, com o preço dele."
                : "Os produtos e serviços que sua empresa tem com a Anuntech aparecem aqui."
          }
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link
                  href={projectListHref(
                    { status: "active", search: "", company: "", pageSize: query.pageSize },
                    "/produtos",
                  )}
                  scroll={false}
                >
                  Limpar filtros
                </Link>
              </Button>
            ) : admin ? (
              <Button asChild>
                <Link href="/produtos/novo">
                  <PlusIcon />
                  Vincular
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
      {admin && (
        <>
          <ProductSheet
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            values={editing}
          />
          {statusForm}
          {suspension.element}
        </>
      )}
    </ListCard>
  );
}
