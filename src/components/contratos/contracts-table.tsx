"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2Icon, CalendarClockIcon, FileSignatureIcon, PlusIcon, XIcon } from "lucide-react";
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
import { dateLabel, relativeLabel } from "@/lib/format";
import {
  contractFilterLabels,
  contractFilters,
  contractListHref,
  contractTerm,
  contractTermLabel,
  type ContractQuery,
  type ContractStatusFilter,
} from "@/lib/contract-table";
import { ContractKindChip, ContractStatusBadge } from "./contract-badges";
import type { ContractRow } from "./contract-row";

export type { ContractRow } from "./contract-row";

/**
 * Anuntech's view: every client's contracts in one table, with the filters
 * that many rows need. The alert line counts what is about to end.
 */
export function ContractsTable({
  rows,
  query,
  alerts,
  companyFilter = null,
  now,
  today,
}: {
  rows: ContractRow[];
  query: ContractQuery;
  alerts: { expiring: number; expired: number };
  companyFilter?: { id: string; name: string } | null;
  now: string;
  today: string;
}) {
  const router = useRouter();
  const href = (patch: Partial<ContractQuery>) => contractListHref({ ...query, ...patch });
  const go = (patch: Partial<ContractQuery>) => router.push(href(patch), { scroll: false });
  const filtered = !!query.search || !!query.company || query.status !== "all";
  const showAlerts = (alerts.expiring > 0 || alerts.expired > 0) && query.status !== "expiring" && query.status !== "expired";
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <SearchField
          value={query.search}
          onChange={(search) => go({ search })}
          placeholder="Buscar por título ou cliente"
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
            {contractFilters.map((status) => (
              <SelectItem key={status} value={status}>
                {contractFilterLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showAlerts && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-warning-soft/60 px-4 py-2 text-xs text-foreground"
        >
          <CalendarClockIcon className="size-3.5 text-warning" />
          {alerts.expiring > 0 && (
            <Link href={href({ status: "expiring" })} className="font-medium hover:text-primary">
              {alerts.expiring === 1
                ? "1 contrato vence nos próximos 30 dias"
                : `${alerts.expiring} contratos vencem nos próximos 30 dias`}
            </Link>
          )}
          {alerts.expiring > 0 && alerts.expired > 0 && <span aria-hidden="true">·</span>}
          {alerts.expired > 0 && (
            <Link href={href({ status: "expired" })} className="font-medium text-destructive hover:underline">
              {alerts.expired === 1 ? "1 contrato vencido" : `${alerts.expired} contratos vencidos`}
            </Link>
          )}
        </p>
      )}
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Contrato</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Assinaturas</TableHead>
              <TableHead className="pr-4 text-right">Atualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const term = row.status === "signed" ? contractTerm({ startsAt: row.startsAt, endsAt: row.endsAt }, today) : null;
              const termLabel = term ? contractTermLabel(term) : null;
              return (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => router.push(`/contratos/${row.id}`)}>
                  <TableCell className="pl-4">
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/contratos/${row.id}`}
                        className="font-medium text-foreground hover:text-primary"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.title}
                      </Link>
                      <ContractKindChip kind={row.kind} />
                    </span>
                    {(row.kind === "amendment" ? row.parentTitle : row.engagement) && (
                      <span className="block text-xs text-muted-foreground">
                        {row.kind === "amendment" ? `Aditivo de ${row.parentTitle}` : row.engagement}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.company}</TableCell>
                  <TableCell>
                    <ContractStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {row.endsAt ? (
                      <>
                        <span className={cn(term?.state === "expired" ? "text-destructive" : "text-foreground")}>
                          {row.startsAt ? `${dateLabel(row.startsAt)} – ` : "até "}
                          {dateLabel(row.endsAt)}
                        </span>
                        {termLabel && term?.state !== "upcoming" && (
                          <span
                            className={cn(
                              "block font-medium",
                              term?.state === "expired" ? "text-destructive" : "text-warning",
                            )}
                          >
                            {termLabel}
                          </span>
                        )}
                      </>
                    ) : row.startsAt ? (
                      <span className="text-foreground">a partir de {dateLabel(row.startsAt)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<FileSignatureIcon />}
          title={filtered ? "Nada encontrado" : "Nenhum contrato ainda"}
          description={
            filtered ? "Tente outro termo ou mude os filtros." : "Crie um contrato a partir de um modelo e envie para o cliente assinar."
          }
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href="/contratos">Limpar filtros</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/contratos/novo">
                  <PlusIcon />
                  Novo contrato
                </Link>
              </Button>
            )
          }
        />
      )}
    </section>
  );
}
