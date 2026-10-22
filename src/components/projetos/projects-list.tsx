"use client";
import { SearchField } from "@/components/console/search-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Building2Icon,
  CircleCheckIcon,
  KanbanIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/cn";
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
import { CardGrid, CardTile, GridCard, useListLayout, ViewToggle } from "@/components/console/list-grid";
import { dateTimeLabel, relativeLabel } from "@/lib/format";
import type { ListLayout } from "@/lib/list-layout";
import {
  projectFilterLabels,
  projectFilters,
  projectListHref,
  type ProjectListQuery,
  type ProjectStatusFilter,
} from "@/lib/projects/project-table";
import { canDeleteEngagement, type EngagementLinks } from "@/lib/deletion-rules";
import { companyDisplayName } from "@/lib/companies/display-name";
import { EngagementStatusBadge } from "./project-badges";
import { useEngagementStatus, type EngagementStatus } from "./engagement-status";
import { ProjectSheet, type ProjectFormValues } from "./project-form";
import { DeleteEngagementDialog } from "./delete-engagement-dialog";

export type ProjectRow = {
  id: string;
  name: string;
  status: string;
  /** Whole text: the edit sheet opens with it. */
  description: string | null;
  companyId: string;
  /** Razão social, as stored; the list shows its display name. */
  company: string;
  /** The company's CNPJ or CPF, when the loader sends it: lets a MEI's name drop its number. */
  companyDocument?: string | null;
  tasks: { total: number; done: number };
  /** ISO instant of the last change on the board (or the project's creation). */
  updatedAt: string;
  /** Staff only: what points at it, so "Excluir" shows only when it can go. */
  links?: EngagementLinks;
};

const firstLine = (text: string | null) => text?.trim().split("\n")[0].trim() || "";

/** Done over total, as a thin bar and "5/12"; projects without tasks say so. In a card the bar takes the width. */
function TaskProgress({ done, total, wide = false }: { done: number; total: number; wide?: boolean }) {
  if (!total) return <span className="text-xs text-muted-foreground">Sem tarefas</span>;
  const percent = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn("h-1.5 overflow-hidden rounded-full bg-secondary", wide ? "flex-1" : "w-20")}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${done} de ${total} ${total === 1 ? "tarefa concluída" : "tarefas concluídas"}`}
        aria-label="Tarefas concluídas"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums" aria-hidden="true">
        {done}/{total}
      </span>
    </div>
  );
}

function ProjectRowActions({
  row,
  admin,
  onEdit,
  onStatus,
}: {
  row: ProjectRow;
  admin: boolean;
  onEdit: (row: ProjectRow) => void;
  onStatus: (id: string, status: EngagementStatus, name?: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const deletable = admin && canDeleteEngagement(row.links);
  return (
    <RowActions
      label={row.name}
      extra={
        deletable && (
          <DeleteEngagementDialog
            engagement={{ id: row.id, name: row.name, kind: "project" }}
            tasks={row.tasks.total}
            fromList
            open={deleting}
            onOpenChange={setDeleting}
          />
        )
      }
    >
      <DropdownMenuItem asChild>
        <Link href={`/projetos/${row.id}`}>
          <KanbanIcon />
          Abrir quadro
        </Link>
      </DropdownMenuItem>
      {admin && (
        <>
          <DropdownMenuItem onSelect={() => onEdit(row)}>
            <PencilIcon />
            Editar projeto
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
              {row.status === "paused" ? "Retomar" : "Reabrir"}
            </DropdownMenuItem>
          )}
          {row.status === "active" && (
            <DropdownMenuItem onSelect={() => onStatus(row.id, "paused", row.name)}>
              <PauseIcon />
              Pausar
            </DropdownMenuItem>
          )}
          {row.status !== "completed" && (
            <DropdownMenuItem onSelect={() => onStatus(row.id, "completed", row.name)}>
              <CircleCheckIcon />
              Marcar como concluído
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

export function ProjectsList({
  rows,
  query,
  total,
  pageCount,
  now,
  admin,
  showCompany,
  companyFilter = null,
  companyShortcuts = [],
  actions,
  view = "grid",
}: {
  rows: ProjectRow[];
  query: ProjectListQuery;
  total: number;
  pageCount: number;
  /** ISO instant the page was rendered at, so relative times hydrate equal. */
  now: string;
  admin: boolean;
  /** False when everything belongs to the viewer's single company. */
  showCompany: boolean;
  companyFilter?: { id: string; name: string; document?: string | null } | null;
  /** Companies whose name matches the search, offered as a one-click filter. */
  companyShortcuts?: { id: string; name: string; document?: string | null }[];
  /** The page's own buttons, at the right end of the toolbar. */
  actions?: ReactNode;
  /** List or grid, as the viewer last chose (the page reads it from a cookie). */
  view?: ListLayout;
}) {
  const router = useRouter();
  const [layout, chooseLayout] = useListLayout("projects", view);
  const [editing, setEditing] = useState<ProjectFormValues | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const { change, form: statusForm } = useEngagementStatus();
  const href = (patch: Partial<ProjectListQuery>) => projectListHref({ ...query, ...patch });
  const go = (patch: Partial<ProjectListQuery>) => router.push(href(patch), { scroll: false });
  const filtered = !!query.search || !!query.company || query.status !== "active";
  // A list filtered by one situation does not repeat it on every row: only "Todas as situações" shows it,
  // and then only the exception (Ativo is the normal state, as in Empresas and Produtos).
  const statusShown = query.status === "all";
  const companyOf = (row: ProjectRow) => companyDisplayName(row.company, row.companyDocument);
  // Staff get the company as its own column while the list spans companies; a
  // client with several companies keeps it in the subtitle.
  const companyColumn = admin && showCompany && !query.company;
  // A card has no company column: it names the company while the list spans several.
  const companyInCard = showCompany && !query.company;
  const subtitle = (row: ProjectRow) =>
    [!admin && showCompany && !query.company ? companyOf(row) : "", firstLine(row.description)]
      .filter(Boolean)
      .join(" · ");
  const edit = (row: ProjectRow) =>
    // Let the menu close before the sheet takes focus.
    setTimeout(() => {
      setEditing({ id: row.id, name: row.name, description: row.description });
      setEditOpen(true);
    }, 0);

  return (
    <ListCard
      fill
      empty={rows.length === 0}
      actions={actions}
      label="Lista de projetos"
      layout={<ViewToggle view={layout} onChange={chooseLayout} />}
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
              label={companyDisplayName(companyFilter.name, companyFilter.document)}
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
                  {companyDisplayName(company.name, company.document)}
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
          noun={["projeto", "projetos"]}
          hrefFor={href}
        />
      }
    >
      {rows.length && layout === "grid" ? (
        <CardGrid>
          {rows.map((row) => (
            <GridCard
              key={row.id}
              href={`/projetos/${row.id}`}
              leading={
                <CardTile>
                  <KanbanIcon />
                </CardTile>
              }
              title={row.name}
              subtitle={companyInCard ? companyOf(row) : undefined}
              actions={<ProjectRowActions row={row} admin={admin} onEdit={edit} onStatus={change} />}
              footer={
                <>
                  {statusShown && row.status !== "active" && <EngagementStatusBadge status={row.status} />}
                  <time dateTime={row.updatedAt} title={dateTimeLabel(row.updatedAt)} className="ml-auto shrink-0">
                    {relativeLabel(row.updatedAt, now)}
                  </time>
                </>
              }
            >
              {row.description?.trim() && <p className="m-0 line-clamp-2 text-muted-foreground">{row.description.trim()}</p>}
              <TaskProgress {...row.tasks} wide />
            </GridCard>
          ))}
        </CardGrid>
      ) : rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Projeto</TableHead>
              {companyColumn && <TableHead className="hidden md:table-cell">Empresa</TableHead>}
              {statusShown && <TableHead>Situação</TableHead>}
              <TableHead className="hidden md:table-cell">Progresso</TableHead>
              <TableHead className="hidden md:table-cell">Atualizado</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <LinkRow key={row.id} href={`/projetos/${row.id}`}>
                <PrimaryCell href={`/projetos/${row.id}`} title={row.name} subtitle={subtitle(row)} />
                {companyColumn && (
                  <CompanyCell>{companyOf(row)}</CompanyCell>
                )}
                {statusShown && (
                  <TableCell>
                    {row.status !== "active" && <EngagementStatusBadge status={row.status} />}
                  </TableCell>
                )}
                <TableCell className="hidden md:table-cell">
                  <TaskProgress {...row.tasks} />
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                  <time dateTime={row.updatedAt} title={dateTimeLabel(row.updatedAt)}>
                    {relativeLabel(row.updatedAt, now)}
                  </time>
                </TableCell>
                <ProjectRowActions row={row} admin={admin} onEdit={edit} onStatus={change} />
              </LinkRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          art={filtered ? "busca" : "projetos"}
          title={filtered ? "Nenhum projeto encontrado" : "Nenhum projeto ativo"}
          description={
            filtered
              ? "Tente outro termo ou mude os filtros."
              : admin
                ? "Crie um projeto para um cliente e organize as tarefas no quadro."
                : "Um projeto aparece aqui quando o trabalho começa, depois do orçamento aceito."
          }
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link
                  href={projectListHref({ status: "active", search: "", company: "", pageSize: query.pageSize })}
                  scroll={false}
                >
                  Limpar filtros
                </Link>
              </Button>
            ) : admin ? (
              <Button asChild>
                <Link href="/projetos/novo">
                  <PlusIcon />
                  Novo projeto
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/chamados/novo?tipo=novo-projeto">
                  <PlusIcon />
                  Pedir orçamento
                </Link>
              </Button>
            )
          }
        />
      )}
      {admin && (
        <>
          {editing && <ProjectSheet open={editOpen} onOpenChange={setEditOpen} values={editing} />}
          {statusForm}
        </>
      )}
    </ListCard>
  );
}
