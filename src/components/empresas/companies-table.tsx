"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HeadsetIcon,
  LogInIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/console/server-form";
import { EmptyState } from "@/components/console/page-header";
import { setCompanyArchived } from "@/lib/actions";
import { startAssistedSession } from "@/lib/assisted-actions";
import {
  companyFilters,
  companyListHref,
  companyStatusLabels,
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

export function companyInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || "") + (words[1]?.[0] || "")).toUpperCase() || "•";
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

function RowMenu({
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
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ações de ${company.name}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/empresas/${company.id}`}>
              <Building2Icon />
              Abrir cadastro
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setTimeout(() => onEdit(company), 0)}
          >
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
        </DropdownMenuContent>
      </DropdownMenu>
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
  );
}

export function CompaniesTable({
  rows,
  query,
  total,
  pageCount,
}: {
  rows: CompanyRow[];
  query: {
    status: CompanyStatusFilter;
    search: string;
    page: number;
    pageSize: number;
  };
  total: number;
  pageCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const href = (patch: Partial<typeof query>) =>
    companyListHref({ ...query, ...patch });
  const go = (patch: Partial<typeof query>) =>
    router.push(href(patch), { scroll: false });
  const from = total ? (query.page - 1) * query.pageSize + 1 : 0;
  const to = Math.min(query.page * query.pageSize, total);

  return (
    <>
      <section
        aria-label="Lista de empresas"
        className="overflow-hidden rounded-xl border bg-card shadow-card"
      >
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <form
            action="/empresas"
            role="search"
            aria-label="Buscar empresas"
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <input type="hidden" name="status" value={query.status} />
            <input type="hidden" name="size" value={query.pageSize} />
            <div className="relative w-full max-w-sm">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                key={query.search}
                type="search"
                name="q"
                defaultValue={query.search}
                placeholder="Buscar por nome, CNPJ ou e-mail"
                aria-label="Buscar por nome, CNPJ ou e-mail"
                maxLength={160}
                className="pl-9"
              />
            </div>
            {query.search && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={href({ search: "", page: 1 })}>
                  <XIcon />
                  Limpar
                </Link>
              </Button>
            )}
          </form>
          <Select
            value={query.status}
            onValueChange={(status) =>
              go({ status: status as CompanyStatusFilter, page: 1 })
            }
          >
            <SelectTrigger
              aria-label="Filtrar por situação"
              className="w-[168px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {companyFilters.map((status) => (
                <SelectItem key={status} value={status}>
                  {companyStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Empresa</TableHead>
                <TableHead>Contato financeiro</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead>Chamados</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-12 pr-3">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="py-3 pl-4">
                    <Link
                      href={`/empresas/${company.id}`}
                      className="group flex min-w-0 items-center gap-3"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-primary">
                        {companyInitials(company.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground group-hover:text-primary">
                          {company.name}
                        </span>
                        <span className="block text-xs tabular-nums text-muted-foreground">
                          {formatDocument(company.document)}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="block truncate text-foreground">
                      {company.billingEmail}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {company.phone
                        ? formatPhone(company.phone)
                        : "Sem telefone"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.people
                      ? `${company.people} ${company.people === 1 ? "pessoa" : "pessoas"}`
                      : "Ninguém ainda"}
                  </TableCell>
                  <TableCell>
                    {company.openTickets ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                        {company.openTickets}{" "}
                        {company.openTickets === 1 ? "aberto" : "abertos"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusDot archived={company.archived} />
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <RowMenu company={company} onEdit={setEditing} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<Building2Icon />}
            title={
              query.search
                ? "Nenhuma empresa encontrada"
                : query.status === "archived"
                  ? "Nenhum cliente arquivado"
                  : "Nenhum cliente ainda"
            }
            description={
              query.search
                ? "Tente outro nome, CNPJ ou e-mail, ou mude o filtro de situação."
                : query.status === "archived"
                  ? "Clientes arquivados aparecem aqui e podem ser restaurados."
                  : "Cadastre a primeira empresa para começar."
            }
            action={
              query.search ? (
                <Button variant="outline" asChild>
                  <Link href={href({ search: "", page: 1 })}>Limpar busca</Link>
                </Button>
              ) : undefined
            }
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            Por página
            <Select
              value={String(query.pageSize)}
              onValueChange={(size) => go({ pageSize: Number(size), page: 1 })}
            >
              <SelectTrigger size="sm" className="h-7 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <span aria-live="polite" className="tabular-nums">
            {total
              ? `${from}–${to} de ${total} ${total === 1 ? "empresa" : "empresas"}`
              : "0 empresas"}
          </span>
          <nav aria-label="Paginação" className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              disabled={query.page <= 1}
              onClick={() => go({ page: query.page - 1 })}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="px-2 tabular-nums">
              {query.page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Próxima página"
              disabled={query.page >= pageCount}
              onClick={() => go({ page: query.page + 1 })}
            >
              <ChevronRightIcon />
            </Button>
          </nav>
        </div>
      </section>
      <CompanySheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        company={editing}
        companyId={editing?.id}
      />
    </>
  );
}
