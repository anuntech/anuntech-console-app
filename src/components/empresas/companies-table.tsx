"use client";
import { companyInitials } from "@/components/console/company-mark";
import { SearchField } from "@/components/console/search-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  Building2Icon,
  HeadsetIcon,
  LogInIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/console/server-form";
import { CardGrid, GridCard, useListLayout, ViewToggle } from "@/components/console/list-grid";
import { EmptyState } from "@/components/console/page-header";
import type { ListLayout } from "@/lib/list-layout";
import {
  LinkRow,
  ListCard,
  ListPagination,
  PrimaryCell,
  RowActions,
} from "@/components/console/list-view";
import { setCompanyArchived } from "@/lib/actions";
import { startAssistedSession } from "@/lib/access/assisted-actions";
import {
  companyFilters,
  companyListHref,
  companyStatusLabels,
  type CompanyQuery,
  type CompanyStatusFilter,
} from "@/lib/companies/company-table";
import { formatDocument, formatPhone, onlyDigits } from "@/lib/companies/company-input";
import { companyDisplayName } from "@/lib/companies/display-name";
import type { CompanyAddress } from "@/lib/companies/company-billing";
import { canDeleteCompany, type CompanyLinks } from "@/lib/deletion-rules";
import { CompanySheet } from "./company-sheet";
import { DeleteCompanyDialog } from "./delete-company-dialog";
import { CompanyTile } from "./company-tile";

export type CompanyRow = {
  id: string;
  name: string;
  document: string;
  billingEmail: string;
  phone: string | null;
  billingAddress: CompanyAddress | null;
  autoIssueNfse: boolean;
  archived: boolean;
  people: number;
  openTickets: number;
  /** What points at it, so "Excluir" shows only when it can go. */
  links?: CompanyLinks;
};

export { companyInitials };

/** Who signs in for the company. On a card there is no column name to say what the count is about. */
function PeopleLabel({ people, inCard = false }: { people: number; inCard?: boolean }) {
  if (!people) return inCard ? "Ninguém com acesso" : "Ninguém ainda";
  return `${people} ${people === 1 ? "pessoa" : "pessoas"}${inCard ? " com acesso" : ""}`;
}

export function StatusDot({ archived }: { archived: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          archived ? "bg-muted-foreground/40" : "bg-success",
        )}
      />
      {archived ? "Arquivado" : "Ativo"}
    </span>
  );
}

function CompanyActions({
  company,
  onEdit,
}: {
  company: CompanyRow;
  onEdit: (company: CompanyRow) => void;
}) {
  const [confirm, setConfirm] = useState<null | "assist" | "archive" | "delete">(null);
  const ask = (which: "assist" | "archive" | "delete") =>
    // The menu closes on select; open the dialog after it has let go.
    setTimeout(() => setConfirm(which), 0);
  // The list is staff-only; the rule decides whether the company can go.
  const deletable = canDeleteCompany(company.links);
  const name = companyDisplayName(company.name, company.document);
  return (
    <RowActions
      label={name}
      extra={
        <>
          <ConfirmDialog
            open={confirm === "assist"}
            onOpenChange={(open) => !open && setConfirm(null)}
            action={startAssistedSession}
            fields={{ companyId: company.id }}
            title="Entrar como esta empresa?"
            description={`Você passa a ver e usar o Console exatamente como ${name}, com acesso completo. Suas telas de administrador ficam ocultas até você sair do modo assistido.`}
            confirmLabel="Entrar como esta empresa"
          />
          {company.archived && (
            <ConfirmDialog
              open={confirm === "archive"}
              onOpenChange={(open) => !open && setConfirm(null)}
              action={setCompanyArchived}
              fields={{ id: company.id, archived: "no" }}
              title="Restaurar cliente?"
              description={`${name} volta para a lista de clientes ativos.`}
              confirmLabel="Restaurar"
            />
          )}
          {deletable && (
            <DeleteCompanyDialog
              company={company}
              fromList
              open={confirm === "delete"}
              onOpenChange={(open) => !open && setConfirm(null)}
            />
          )}
        </>
      }
    >
      <DropdownMenuItem asChild>
        <Link href={`/empresas/${company.id}`}>
          <Building2Icon />
          Abrir cadastro
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setTimeout(() => onEdit(company), 0)}>
        <PencilIcon />
        Editar dados
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href={`/chamados/novo?companyId=${company.id}`}>
          <HeadsetIcon />
          Abrir chamado
        </Link>
      </DropdownMenuItem>
      {!company.archived && (
        <DropdownMenuItem onSelect={() => ask("assist")}>
          <LogInIcon />
          Entrar como esta empresa
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      {company.archived ? (
        <DropdownMenuItem onSelect={() => ask("archive")}>
          <ArchiveRestoreIcon />
          Restaurar cliente
        </DropdownMenuItem>
      ) : (
        // Archiving shows what still runs and what to wind down with it: that lives on the company page.
        <DropdownMenuItem variant="destructive" asChild>
          <Link href={`/empresas/${company.id}?arquivar=1`}>
            <ArchiveIcon />
            Arquivar cliente
          </Link>
        </DropdownMenuItem>
      )}
      {deletable && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => ask("delete")}>
            <Trash2Icon />
            Excluir
          </DropdownMenuItem>
        </>
      )}
    </RowActions>
  );
}

export function CompaniesTable({
  rows,
  query,
  total,
  pageCount,
  actions,
  view = "grid",
}: {
  rows: CompanyRow[];
  query: CompanyQuery;
  total: number;
  pageCount: number;
  /** The page's own buttons, at the right end of the toolbar. */
  actions?: ReactNode;
  /** List or grid, as the viewer last chose (the page reads it from a cookie). */
  view?: ListLayout;
}) {
  const router = useRouter();
  const [layout, chooseLayout] = useListLayout("companies", view);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const href = (patch: Partial<CompanyQuery>) =>
    companyListHref({ ...query, ...patch });
  const go = (patch: Partial<CompanyQuery>) =>
    router.push(href(patch), { scroll: false });
  const filtered = !!query.search || query.status !== "active";
  // A list filtered by status says it in the filter; rows name it only when both kinds are mixed, and only the exception.
  const archivedMark = (company: CompanyRow) => query.status === "all" && company.archived;
  // The document stays in Cadastro; it comes back on a row only when the search was for a number.
  const byNumber = onlyDigits(query.search).length >= 3;
  const documentLine = (company: CompanyRow) =>
    byNumber ? <span className="tabular-nums">{formatDocument(company.document)}</span> : undefined;

  return (
    <>
      <ListCard
        fill
        empty={total === 0}
        actions={actions}
        label="Lista de empresas"
        layout={<ViewToggle view={layout} onChange={chooseLayout} />}
        toolbar={
          <>
            <SearchField
              value={query.search}
              onChange={(search) => go({ search, page: 1 })}
              placeholder="Buscar por nome, CNPJ ou e-mail"
            />
            <Select
              value={query.status}
              onValueChange={(status) =>
                go({ status: status as CompanyStatusFilter, page: 1 })
              }
            >
              <SelectTrigger aria-label="Filtrar por situação" className="w-[168px]">
                <SelectValue>{companyStatusLabels[query.status]}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {companyFilters.map((status) => (
                  <SelectItem key={status} value={status}>
                    {companyStatusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        footer={
          <ListPagination
            page={query.page}
            pageSize={query.pageSize}
            total={total}
            pageCount={pageCount}
            noun={["empresa", "empresas"]}
            hrefFor={href}
          />
        }
      >
        {rows.length && layout === "grid" ? (
          <CardGrid>
            {rows.map((company) => (
              <GridCard
                key={company.id}
                href={`/empresas/${company.id}`}
                leading={<CompanyTile name={company.name} />}
                title={companyDisplayName(company.name, company.document)}
                subtitle={documentLine(company)}
                actions={<CompanyActions company={company} onEdit={setEditing} />}
                footer={
                  archivedMark(company) || company.openTickets > 0 ? (
                    <>
                      {archivedMark(company) && <StatusDot archived />}
                      {company.openTickets > 0 && (
                        <span className="ml-auto shrink-0 rounded-md bg-warning-soft px-2 py-0.5 font-medium text-warning tabular-nums">
                          {company.openTickets} {company.openTickets === 1 ? "chamado aberto" : "chamados abertos"}
                        </span>
                      )}
                    </>
                  ) : undefined
                }
              >
                <div className="min-w-0">
                  <span className="block truncate text-foreground">{company.billingEmail}</span>
                  {/* The dot opens the next item, so a wrapped line never ends on one. */}
                  <span className="flex flex-wrap gap-x-1.5 text-muted-foreground tabular-nums [&>*+*]:before:mr-1.5 [&>*+*]:before:content-['·']">
                    {company.phone && <span>{formatPhone(company.phone)}</span>}
                    <span>
                      <PeopleLabel people={company.people} inCard />
                    </span>
                  </span>
                </div>
              </GridCard>
            ))}
          </CardGrid>
        ) : rows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Empresa</TableHead>
                <TableHead className="hidden md:table-cell">Contato financeiro</TableHead>
                <TableHead className="hidden md:table-cell">Acesso</TableHead>
                <TableHead className="hidden md:table-cell">Chamados</TableHead>
                <TableHead className="w-12 pr-3">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((company) => (
                <LinkRow key={company.id} href={`/empresas/${company.id}`}>
                  <PrimaryCell
                    href={`/empresas/${company.id}`}
                    leading={<CompanyTile name={company.name} size="sm" />}
                    title={companyDisplayName(company.name, company.document)}
                    subtitle={archivedMark(company) ? <StatusDot archived /> : documentLine(company)}
                  />
                  <TableCell className="hidden max-w-[18rem] md:table-cell">
                    <span className="block truncate text-foreground">
                      {company.billingEmail}
                    </span>
                    {company.phone && (
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {formatPhone(company.phone)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                    <PeopleLabel people={company.people} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {company.openTickets > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning tabular-nums">
                        {company.openTickets}{" "}
                        {company.openTickets === 1 ? "aberto" : "abertos"}
                      </span>
                    )}
                  </TableCell>
                  <CompanyActions company={company} onEdit={setEditing} />
                </LinkRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            art={filtered ? "busca" : "projetos"}
            title={filtered ? "Nenhuma empresa encontrada" : "Nenhum cliente ainda"}
            description={
              filtered
                ? "Tente outro termo ou mude os filtros."
                : "Cadastre a primeira empresa para começar."
            }
            action={
              filtered ? (
                <Button variant="outline" asChild>
                  <Link
                    href={companyListHref({
                      status: "active",
                      search: "",
                      page: 1,
                      pageSize: query.pageSize,
                    })}
                    scroll={false}
                  >
                    Limpar filtros
                  </Link>
                </Button>
              ) : (
                // The header's NewCompanyButton opens its sheet on `?nova=1`;
                // a second button here would mount a second sheet.
                <Button asChild>
                  <Link href="/empresas?nova=1" scroll={false}>
                    <PlusIcon />
                    Cadastrar empresa
                  </Link>
                </Button>
              )
            }
          />
        )}
      </ListCard>
      <CompanySheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        company={editing}
        companyId={editing?.id}
      />
    </>
  );
}
