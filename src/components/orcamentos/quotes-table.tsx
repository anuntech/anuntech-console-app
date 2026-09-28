"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2Icon, CalculatorIcon, CopyPlusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/console/page-header";
import { SearchField } from "@/components/console/search-field";
import { ConfirmDialog } from "@/components/console/server-form";
import {
  CompanyCell,
  DownloadMenuItem,
  FilterChip,
  LinkRow,
  ListCard,
  ListPagination,
  PrimaryCell,
  RowActions,
} from "@/components/console/list-view";
import { duplicateQuote } from "@/lib/quotes/quote-actions";
import { deleteQuote } from "@/lib/quotes/quote-deletion";
import { canDeleteQuote, quoteDecisionNotice } from "@/lib/deletion-rules";
import { currency, dateLabel, dateTimeLabel, relativeLabel } from "@/lib/format";
import { hoursLabel, quoteExpired, quoteFilterLabels, quoteListHref, type QuoteStatusFilter } from "@/lib/quotes/quote-model";
import { QUOTE_NOUN, quoteFiltersFor, type QuoteTableQuery } from "@/lib/quotes/quote-table";
import { QuoteStatusBadge, validityText } from "./quote-badges";
import type { QuoteRow } from "./quote-row";

const hidePhone = "hidden md:table-cell";

function QuoteRowActions({ row, admin, waiting, today }: { row: QuoteRow; admin: boolean; waiting: boolean; today: string }) {
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The PDF route serves drafts to staff only and never serves cancelled proposals.
  const hasPdf = row.status !== "cancelled" && (admin || row.status !== "draft");
  const deletable = admin && canDeleteQuote(row.status, { validUntil: row.validUntil, today });
  const decision = quoteDecisionNotice(row.status);
  return (
    <RowActions
      label={row.title}
      extra={
        admin && (
          <>
            <ConfirmDialog
              open={duplicating}
              onOpenChange={setDuplicating}
              action={duplicateQuote}
              fields={{ id: row.id }}
              title="Duplicar como novo rascunho?"
              description="Um novo orçamento, com número próprio, nasce com as mesmas fases, tarefas e valores para você ajustar."
              confirmLabel="Duplicar"
            />
            {deletable && (
              <ConfirmDialog
                open={deleting}
                onOpenChange={setDeleting}
                action={deleteQuote}
                fields={{ id: row.id, from: "list" }}
                title="Excluir orçamento?"
                description={`O orçamento nº ${row.number} sai do Console junto com as versões enviadas, se houver.${
                  decision ? ` ${decision}` : ""
                } Isso não pode ser desfeito.`}
                confirmLabel="Excluir"
                destructive
              />
            )}
          </>
        )
      }
    >
      <DropdownMenuItem asChild>
        <Link href={`/orcamentos/${row.id}`}>
          <CalculatorIcon />
          {waiting && !admin ? "Abrir e responder" : "Abrir orçamento"}
        </Link>
      </DropdownMenuItem>
      {admin && (
        <DropdownMenuItem asChild>
          <Link href={`/empresas/${row.companyId}`}>
            <Building2Icon />
            Ver empresa
          </Link>
        </DropdownMenuItem>
      )}
      {(hasPdf || admin) && <DropdownMenuSeparator />}
      {hasPdf && (
        <DownloadMenuItem href={`/api/orcamentos/${row.id}/pdf`} filename={`Orçamento ${row.number} — ${row.title}.pdf`} />
      )}
      {admin && (
        // Opened after the menu closes, so the dialog takes focus from a settled page.
        <DropdownMenuItem onSelect={() => setTimeout(() => setDuplicating(true), 0)}>
          <CopyPlusIcon />
          Duplicar como novo rascunho
        </DropdownMenuItem>
      )}
      {deletable && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => setDeleting(true), 0)}>
            <Trash2Icon />
            Excluir
          </DropdownMenuItem>
        </>
      )}
    </RowActions>
  );
}

/** Every proposal the viewer can see: staff across all clients, a client within their companies. */
export function QuotesTable({
  rows,
  query,
  total,
  pageCount,
  admin,
  multiCompany,
  companyFilter = null,
  now,
  today,
}: {
  rows: QuoteRow[];
  query: QuoteTableQuery;
  total: number;
  pageCount: number;
  /** Staff: every company, drafts and cancelled proposals, and the staff actions. */
  admin: boolean;
  /** A client of more than one company, who needs the company named on each row. */
  multiCompany: boolean;
  companyFilter?: { id: string; name: string } | null;
  /** ISO instant the page was rendered at, so relative times hydrate equal. */
  now: string;
  /** São Paulo civil date, for validity. */
  today: string;
}) {
  const router = useRouter();
  const href = (patch: Partial<QuoteTableQuery>) => quoteListHref({ ...query, ...patch });
  const go = (patch: Partial<QuoteTableQuery>) => router.push(href(patch), { scroll: false });
  const filtered = !!query.search || !!query.company || query.status !== "all";
  // A list narrowed to one company names it in the chip, not on every row.
  const companyColumn = admin && !query.company;
  const companyInSubtitle = !admin && multiCompany && !query.company;
  const filters = quoteFiltersFor(admin);

  return (
    <ListCard
      label="Lista de orçamentos"
      toolbar={
        <>
          <SearchField
            value={query.search}
            onChange={(search) => go({ search, page: 1 })}
            placeholder={admin || multiCompany ? "Buscar por número, título ou empresa" : "Buscar por número ou título"}
          />
          {companyFilter && (
            <FilterChip
              icon={<Building2Icon />}
              label={companyFilter.name}
              removeHref={href({ company: "", page: 1 })}
            />
          )}
          <Select value={query.status} onValueChange={(status) => go({ status: status as QuoteStatusFilter, page: 1 })}>
            <SelectTrigger aria-label="Filtrar por situação" className="w-[212px]">
              <SelectValue>{quoteFilterLabels[query.status]}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {filters.map((status) => (
                <SelectItem key={status} value={status}>
                  {quoteFilterLabels[status]}
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
          noun={QUOTE_NOUN}
          hrefFor={href}
        />
      }
    >
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Orçamento</TableHead>
              {companyColumn && <TableHead className={hidePhone}>Empresa</TableHead>}
              <TableHead>Situação</TableHead>
              <TableHead className={cn(hidePhone, "text-right")}>Valor</TableHead>
              <TableHead className={hidePhone}>Validade</TableHead>
              <TableHead className={hidePhone}>Atualizado</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const open = `/orcamentos/${row.id}`;
              const expired = quoteExpired(row.status, row.validUntil, today);
              const validity = validityText(row.status, row.validUntil, today);
              return (
                <LinkRow key={row.id} href={open}>
                  <PrimaryCell
                    href={open}
                    title={row.title}
                    subtitle={
                      <span className="tabular-nums">
                        nº {row.number} · {hoursLabel(row.hoursMin, row.hoursMax)}
                        {companyInSubtitle && ` · ${row.company}`}
                      </span>
                    }
                  />
                  {companyColumn && (
                    <CompanyCell>{row.company}</CompanyCell>
                  )}
                  <TableCell>
                    <QuoteStatusBadge status={row.status} validUntil={row.validUntil} today={today} />
                  </TableCell>
                  <TableCell className={cn(hidePhone, "text-right font-medium text-foreground tabular-nums")}>
                    {currency(row.totalCents)}
                  </TableCell>
                  <TableCell className={cn(hidePhone, "tabular-nums")}>
                    {row.validUntil ? (
                      <>
                        <span className={expired ? "text-destructive" : "text-foreground"}>{dateLabel(row.validUntil)}</span>
                        {validity && <span className="block text-xs font-medium text-warning">{validity}</span>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(hidePhone, "text-muted-foreground tabular-nums")}>
                    <time dateTime={row.updatedAt} title={dateTimeLabel(row.updatedAt)}>
                      {relativeLabel(row.updatedAt, now)}
                    </time>
                  </TableCell>
                  <QuoteRowActions row={row} admin={admin} waiting={row.status === "sent" && !expired} today={today} />
                </LinkRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={<CalculatorIcon />}
          title={filtered ? "Nenhum orçamento encontrado" : "Nenhum orçamento ainda"}
          description={
            filtered
              ? "Tente outro termo ou mude os filtros."
              : admin
                ? "Monte a proposta por fases e horas, envie ao cliente e receba o aceite pelo Console."
                : "As propostas da Anuntech para a sua empresa aparecem aqui, para leitura e resposta."
          }
          action={
            filtered ? (
              <Button variant="outline" asChild>
                <Link href={quoteListHref({ status: "all", search: "", company: "", pageSize: query.pageSize })}>
                  Limpar filtros
                </Link>
              </Button>
            ) : admin ? (
              <Button asChild>
                <Link href="/orcamentos/novo">
                  <PlusIcon />
                  Novo orçamento
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </ListCard>
  );
}
