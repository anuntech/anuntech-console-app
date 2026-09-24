"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2Icon, CalculatorIcon, PlusIcon, XIcon } from "lucide-react";
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
import { currency, dateLabel, relativeLabel } from "@/lib/format";
import {
  hoursLabel,
  quoteExpired,
  quoteFilterLabels,
  quoteFilters,
  quoteListHref,
  type QuoteQuery,
  type QuoteStatusFilter,
} from "@/lib/quote-model";
import { QuoteStatusBadge, validityText } from "./quote-badges";
import type { QuoteRow } from "./quote-row";

/** Anuntech's view: every client's proposals in one table, with filters. */
export function QuotesTable({
  rows,
  query,
  companyFilter = null,
  now,
  today,
}: {
  rows: QuoteRow[];
  query: QuoteQuery;
  companyFilter?: { id: string; name: string } | null;
  now: string;
  today: string;
}) {
  const router = useRouter();
  const href = (patch: Partial<QuoteQuery>) => quoteListHref({ ...query, ...patch });
  const go = (patch: Partial<QuoteQuery>) => router.push(href(patch), { scroll: false });
  const filtered = !!query.search || !!query.company || query.status !== "all";
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <SearchField
          value={query.search}
          onChange={(search) => go({ search })}
          placeholder="Buscar por número, título ou cliente"
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
        <Select value={query.status} onValueChange={(status) => go({ status: status as QuoteStatusFilter })}>
          <SelectTrigger aria-label="Filtrar por situação" className="w-[212px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {quoteFilters.map((status) => (
              <SelectItem key={status} value={status}>
                {quoteFilterLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Orçamento</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="pr-4 text-right">Atualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const expired = quoteExpired(row.status, row.validUntil, today);
              const validity = validityText(row.status, row.validUntil, today);
              return (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => router.push(`/orcamentos/${row.id}`)}>
                  <TableCell className="pl-4">
                    <Link
                      href={`/orcamentos/${row.id}`}
                      className="font-medium text-foreground hover:text-primary"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {row.title}
                    </Link>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      nº {row.number} · {hoursLabel(row.hoursMin, row.hoursMax)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.company}</TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={row.status} validUntil={row.validUntil} today={today} />
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground tabular-nums">{currency(row.totalCents)}</TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {row.validUntil ? (
                      <>
                        <span className={cn(expired ? "text-destructive" : "text-foreground")}>{dateLabel(row.validUntil)}</span>
                        {validity && <span className="block font-medium text-warning">{validity}</span>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
          icon={<CalculatorIcon />}
          title={filtered ? "Nada encontrado" : "Nenhum orçamento ainda"}
          description={
            filtered
              ? "Tente outro termo ou mude os filtros."
              : "Monte a proposta por fases e horas, envie ao cliente e receba o aceite pelo Console."
          }
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href="/orcamentos">Limpar filtros</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/orcamentos/novo">
                  <PlusIcon />
                  Novo orçamento
                </Link>
              </Button>
            )
          }
        />
      )}
    </section>
  );
}
