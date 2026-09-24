"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2Icon, FileSignatureIcon, PlusIcon, XIcon } from "lucide-react";
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
import { EmptyState } from "@/components/console/page-header";
import { SearchField } from "@/components/console/search-field";
import { relativeLabel } from "@/lib/format";
import {
  clientContractFilters,
  contractFilterLabels,
  contractFilters,
  contractListHref,
  type ContractQuery,
  type ContractStatus,
  type ContractStatusFilter,
} from "@/lib/contract-table";
import { ContractStatusBadge } from "./contract-badges";

export type ContractRow = {
  id: string;
  title: string;
  companyId: string;
  company: string;
  engagement: string | null;
  status: ContractStatus;
  signedBy: ("client" | "anuntech")[];
  updatedAt: string;
};

export function ContractsTable({
  rows,
  query,
  admin,
  showCompany,
  companyFilter = null,
  now,
}: {
  rows: ContractRow[];
  query: ContractQuery;
  admin: boolean;
  showCompany: boolean;
  companyFilter?: { id: string; name: string } | null;
  now: string;
}) {
  const router = useRouter();
  const href = (patch: Partial<ContractQuery>) => contractListHref({ ...query, ...patch });
  const go = (patch: Partial<ContractQuery>) => router.push(href(patch), { scroll: false });
  const filters = admin ? contractFilters : clientContractFilters;
  const filtered = !!query.search || !!query.company || query.status !== "all";
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <SearchField
          value={query.search}
          onChange={(search) => go({ search })}
          placeholder={showCompany ? "Buscar por título ou cliente" : "Buscar por título"}
          className="sm:flex-1"
        />
        {companyFilter && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background pr-1 pl-2.5 text-xs font-medium text-foreground">
            <Building2Icon className="size-3.5 text-muted-foreground" />
            <span className="max-w-[14rem] truncate">{companyFilter.name}</span>
            <Link
              href={href({ company: "" })}
              aria-label={`Remover filtro ${companyFilter.name}`}
              className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </Link>
          </span>
        )}
        <Select value={query.status} onValueChange={(status) => go({ status: status as ContractStatusFilter })}>
          <SelectTrigger aria-label="Filtrar por situação" className="w-[212px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {filters.map((status) => (
              <SelectItem key={status} value={status}>
                {contractFilterLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Contrato</TableHead>
              {showCompany && <TableHead>Cliente</TableHead>}
              <TableHead>Situação</TableHead>
              <TableHead>Assinaturas</TableHead>
              <TableHead className="pr-4 text-right">Atualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => router.push(`/contratos/${row.id}`)}
              >
                <TableCell className="pl-4">
                  <Link
                    href={`/contratos/${row.id}`}
                    className="font-medium text-foreground hover:text-primary"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.title}
                  </Link>
                  {row.engagement && (
                    <span className="block text-xs text-muted-foreground">{row.engagement}</span>
                  )}
                </TableCell>
                {showCompany && <TableCell className="text-muted-foreground">{row.company}</TableCell>}
                <TableCell>
                  <ContractStatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  {row.status === "draft" || row.status === "cancelled" ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs">
                      {(["client", "anuntech"] as const).map((party) => (
                        <span
                          key={party}
                          className={cn(
                            "inline-flex items-center gap-1",
                            row.signedBy.includes(party) ? "text-success" : "text-muted-foreground",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "size-1.5 rounded-full",
                              row.signedBy.includes(party) ? "bg-success" : "bg-muted-foreground/40",
                            )}
                          />
                          {party === "client" ? "Cliente" : "Anuntech"}
                        </span>
                      ))}
                    </span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right text-xs text-muted-foreground tabular-nums">
                  {relativeLabel(row.updatedAt, now)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<FileSignatureIcon />}
          title={filtered ? "Nada encontrado" : "Nenhum contrato ainda"}
          description={
            filtered
              ? "Tente outro termo ou mude os filtros."
              : admin
                ? "Crie um contrato a partir de um modelo e envie para o cliente assinar."
                : "Os contratos da sua empresa com a Anuntech aparecem aqui para leitura e assinatura."
          }
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href="/contratos">Limpar filtros</Link>
              </Button>
            ) : admin ? (
              <Button asChild>
                <Link href="/contratos/novo">
                  <PlusIcon />
                  Novo contrato
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </section>
  );
}
