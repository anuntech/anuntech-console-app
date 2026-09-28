"use client";
import { SearchField } from "@/components/console/search-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2Icon,
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
import { EmptyState } from "@/components/console/page-header";
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

export type ProductRow = {
  id: string;
  kind: "product" | "service";
  name: string;
  status: string;
  description: string | null;
  url: string | null;
  amountCents: number | null;
  interval: "monthly" | "yearly" | null;
  nextDueDate: string | null;
  subscriptionId?: string | null;
  companyId: string;
  company: string;
  /** Staff only: what points at it, so "Excluir" shows only when it can go. */
  links?: EngagementLinks;
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
  servicePage,
  link,
  onEdit,
  onStatus,
}: {
  row: ProductRow;
  admin: boolean;
  servicePage: string | null;
  link: string | null;
  onEdit: (values: ProductFormValues) => void;
  onStatus: (id: string, status: EngagementStatus) => void;
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
      {servicePage ? (
        <DropdownMenuItem asChild>
          <Link href={servicePage}>
            <WrenchIcon />
            Abrir serviço
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
                    amountCents: row.amountCents,
                    subscriptionId: row.subscriptionId ?? null,
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
          {row.status !== "active" && (
            <DropdownMenuItem onSelect={() => onStatus(row.id, "active")}>
              <PlayIcon />
              {row.status === "paused" ? "Reativar" : "Reabrir"}
            </DropdownMenuItem>
          )}
          {row.status === "active" && (
            <DropdownMenuItem onSelect={() => onStatus(row.id, "paused")}>
              <PauseIcon />
              Pausar
            </DropdownMenuItem>
          )}
          {row.status !== "completed" && (
            <DropdownMenuItem onSelect={() => onStatus(row.id, "completed")}>
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

/** The products and services companies have with Anuntech; each row opens the service page or the product's link. */
export function ProductsList({
  rows,
  query,
  total,
  pageCount,
  admin,
  showCompany,
  companyFilter = null,
  companyShortcuts = [],
}: {
  rows: ProductRow[];
  query: ProjectListQuery;
  total: number;
  pageCount: number;
  admin: boolean;
  /** False when everything belongs to the viewer's single company. */
  showCompany: boolean;
  companyFilter?: { id: string; name: string } | null;
  /** Companies whose name matches the search, offered as a one-click filter. */
  companyShortcuts?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProductFormValues | null>(null);
  const { change, form: statusForm } = useEngagementStatus();
  const href = (patch: Partial<ProjectListQuery>) => projectListHref({ ...query, ...patch }, "/produtos");
  const go = (patch: Partial<ProjectListQuery>) => router.push(href(patch), { scroll: false });
  const filtered = !!query.search || !!query.company || query.status !== "active";
  // Staff get the company as its own column while the list spans companies; a
  // client with several companies keeps it in the subtitle.
  const companyColumn = admin && showCompany && !query.company;
  const subtitle = (row: ProductRow) =>
    [
      !admin && showCompany && !query.company ? row.company : "",
      row.kind === "service" ? "Serviço" : "Produto",
      row.kind === "product" ? (row.url ? hostOf(row.url) : "Sem link cadastrado") : "",
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <ListCard
      label="Lista de produtos e serviços"
      toolbar={
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
            <SelectTrigger aria-label="Filtrar por situação" className="w-[188px]">
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
            <div className="flex basis-full flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Produto ou serviço</TableHead>
              {companyColumn && <TableHead className="hidden md:table-cell">Empresa</TableHead>}
              <TableHead>Situação</TableHead>
              <TableHead className="hidden text-right md:table-cell">Valor</TableHead>
              <TableHead className="hidden md:table-cell">Próximo vencimento</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              // Services have a page in the Console; products open their own link.
              const servicePage = row.kind === "service" ? `/produtos/${row.id}` : null;
              const link = row.kind === "product" ? webUrl(row.url) : null;
              const cells = (
                <>
                  <PrimaryCell href={servicePage ?? link} external={!servicePage} title={row.name} subtitle={subtitle(row)} />
                  {companyColumn && (
                    <CompanyCell>{row.company}</CompanyCell>
                  )}
                  <TableCell>
                    <EngagementStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="hidden text-right whitespace-nowrap tabular-nums md:table-cell">
                    {row.amountCents != null ? (
                      <>
                        <span className="font-medium text-foreground">{currency(row.amountCents)}</span>
                        {row.interval && (
                          <span className="text-muted-foreground">{intervalLabel[row.interval]}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums md:table-cell">
                    {row.nextDueDate ? dateLabel(row.nextDueDate) : "—"}
                  </TableCell>
                  <ProductRowActions
                    row={row}
                    admin={admin}
                    servicePage={servicePage}
                    link={link}
                    onEdit={setEditing}
                    onStatus={change}
                  />
                </>
              );
              return (
                <LinkRow key={row.id} href={servicePage ?? link} external={!servicePage}>
                  {cells}
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
        </>
      )}
    </ListCard>
  );
}
