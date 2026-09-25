"use client";
import { companyInitials } from "@/components/console/company-mark";
import { SearchField } from "@/components/console/search-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  Building2Icon,
  HeadsetIcon,
  LogInIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { cn } from "cn";
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
import { EmptyState } from "@/components/console/page-header";
import {
  LinkRow,
  ListCard,
  ListPagination,
  PrimaryCell,
  RowActions,
} from "@/components/console/list-view";
import { setCompanyArchived } from "@/lib/actions";
import { startAssistedSession } from "@/lib/assisted-actions";
import {
  companyFilters,
  companyListHref,
  companyStatusLabels,
  type CompanyQuery,
  type CompanyStatusFilter,
} from "@/lib/company-table";
import { formatDocument, formatPhone } from "@/lib/company-input";
import type { CompanyAddress } from "@/lib/company-billing";
import { CompanySheet } from "./company-sheet";

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
};

export { companyInitials };

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
  const [confirm, setConfirm] = useState<null | "assist" | "archive">(null);
  const ask = (which: "assist" | "archive") =>
    // The menu closes on select; open the dialog after it has let go.
    setTimeout(() => setConfirm(which), 0);
  return (
    <RowActions
      label={company.name}
      extra={
        <>
          <ConfirmDialog
            open={confirm === "assist"}
            onOpenChange={(open) => !open && setConfirm(null)}
            action={startAssistedSession}
            fields={{ companyId: company.id }}
            title="Entrar como esta empresa?"
            description={`Você passa a ver e usar o Console exatamente como ${company.name}, com acesso completo. Suas telas de administrador ficam ocultas até você sair do modo assistido.`}
            confirmLabel="Entrar como esta empresa"
          />
          <ConfirmDialog
            open={confirm === "archive"}
            onOpenChange={(open) => !open && setConfirm(null)}
            action={setCompanyArchived}
            fields={{ id: company.id, archived: company.archived ? "no" : "yes" }}
            title={company.archived ? "Restaurar cliente?" : "Arquivar cliente?"}
            description={
              company.archived
                ? `${company.name} volta para a lista de clientes ativos.`
                : `${company.name} sai da lista de ativos. Histórico, acessos e cobranças são preservados e você pode restaurar depois.`
            }
            confirmLabel={company.archived ? "Restaurar" : "Arquivar"}
            destructive={!company.archived}
          />
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
      <DropdownMenuItem
        variant={company.archived ? "default" : "destructive"}
        onSelect={() => ask("archive")}
      >
        {company.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
        {company.archived ? "Restaurar cliente" : "Arquivar cliente"}
      </DropdownMenuItem>
    </RowActions>
  );
}

export function CompaniesTable({
  rows,
  query,
  total,
  pageCount,
}: {
  rows: CompanyRow[];
  query: CompanyQuery;
  total: number;
  pageCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const href = (patch: Partial<CompanyQuery>) =>
    companyListHref({ ...query, ...patch });
  const go = (patch: Partial<CompanyQuery>) =>
    router.push(href(patch), { scroll: false });
  const filtered = !!query.search || query.status !== "active";

  return (
    <>
      <ListCard
        label="Lista de empresas"
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
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Empresa</TableHead>
                <TableHead>Situação</TableHead>
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
                    leading={
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-primary">
                        {companyInitials(company.name)}
                      </span>
                    }
                    title={company.name}
                    subtitle={
                      <span className="tabular-nums">
                        {formatDocument(company.document)}
                      </span>
                    }
                  />
                  <TableCell>
                    <StatusDot archived={company.archived} />
                  </TableCell>
                  <TableCell className="hidden max-w-[18rem] md:table-cell">
                    <span className="block truncate text-foreground">
                      {company.billingEmail}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {company.phone ? formatPhone(company.phone) : "Sem telefone"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                    {company.people
                      ? `${company.people} ${company.people === 1 ? "pessoa" : "pessoas"}`
                      : "Ninguém ainda"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {company.openTickets ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning tabular-nums">
                        {company.openTickets}{" "}
                        {company.openTickets === 1 ? "aberto" : "abertos"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <CompanyActions company={company} onEdit={setEditing} />
                </LinkRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Building2Icon />}
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
