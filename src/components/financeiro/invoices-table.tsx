"use client";
import { SearchField } from "@/components/console/search-field";
import type { ChargeTerms } from "@/lib/billing-terms";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2Icon,
  CopyIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  Repeat2Icon,
  Trash2Icon,
  XIcon,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/console/page-header";
import { ConfirmDialog } from "@/components/console/server-form";
import { TablePagination } from "@/components/console/table-pagination";
import { toast } from "@/components/notifications";
import { cancelDraft } from "@/lib/actions";
import { daysOverdue } from "@/lib/billing-notice-rules";
import { currency, dateLabel } from "@/lib/format";
import { DateField } from "@/components/console/date-field";
import {
  clientInvoiceFilters,
  invoiceFilterLabels,
  invoiceFilters,
  invoiceListHref,
  invoicePeriodLabels,
  invoicePeriods,
  type InvoicePeriod,
  type InvoiceDisplayStatus,
  type InvoiceQuery,
  type InvoiceStatusFilter,
  type InvoiceTableStatus,
} from "@/lib/invoice-table";
import { InvoiceStatusBadge } from "./invoice-badges";
import { InvoiceSheet, type InvoiceEditMode } from "./invoice-sheet";

export type InvoiceRow = {
  id: string;
  description: string;
  companyId: string;
  company: string;
  amountCents: number;
  status: InvoiceTableStatus;
  display: InvoiceDisplayStatus;
  dueDate: string;
  recurring: boolean;
  interval: "monthly" | "yearly" | null;
  publicUrl: string | null;
  /** Which sheet "Editar" opens; null when nothing can change any more. */
  editable: "draft" | "issued" | null;
  cancellable: boolean;
  terms: ChargeTerms;
};

export const billingTypeLabel = (
  recurring: boolean,
  interval: "monthly" | "yearly" | null,
) =>
  recurring
    ? `Recorrente · ${interval === "yearly" ? "Anual" : "Mensal"}`
    : "Cobrança única";

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link de pagamento copiado.");
  } catch {
    toast.error("Não foi possível copiar. Abra a fatura e copie o link.");
  }
}

function RowMenu({
  invoice,
  admin,
  onEdit,
}: {
  invoice: InvoiceRow;
  admin: boolean;
  onEdit: (invoice: InvoiceRow) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ações da fatura ${invoice.description}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem asChild>
            <Link href={`/financeiro/${invoice.id}`}>
              <ReceiptTextIcon />
              Ver fatura
            </Link>
          </DropdownMenuItem>
          {admin && invoice.editable && (
            <DropdownMenuItem
              onSelect={() => setTimeout(() => onEdit(invoice), 0)}
            >
              <PencilIcon />
              Editar
            </DropdownMenuItem>
          )}
          {invoice.publicUrl && (
            <>
              <DropdownMenuItem onSelect={() => void copyLink(invoice.publicUrl!)}>
                <CopyIcon />
                Copiar link de pagamento
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={invoice.publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon />
                  Abrir página de pagamento
                </a>
              </DropdownMenuItem>
            </>
          )}
          {admin && (
            <DropdownMenuItem asChild>
              <Link href={`/empresas/${invoice.companyId}`}>
                <Building2Icon />
                Ver empresa
              </Link>
            </DropdownMenuItem>
          )}
          {admin && invoice.cancellable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setTimeout(() => setCancelling(true), 0)}
              >
                <Trash2Icon />
                Cancelar rascunho
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {admin && invoice.cancellable && (
        <ConfirmDialog
          open={cancelling}
          onOpenChange={setCancelling}
          action={cancelDraft}
          fields={{ id: invoice.id }}
          title="Cancelar este rascunho?"
          description={`A cobrança de ${currency(invoice.amountCents)} para ${invoice.company} não será emitida.`}
          confirmLabel="Cancelar rascunho"
          destructive
        />
      )}
    </>
  );
}

export function InvoicesTable({
  rows,
  query,
  total,
  pageCount,
  today,
  admin,
  showCompany,
  companyFilter = null,
}: {
  rows: InvoiceRow[];
  query: InvoiceQuery;
  total: number;
  pageCount: number;
  /** Civil date in São Paulo, for "N dias de atraso". */
  today: string;
  admin: boolean;
  showCompany: boolean;
  companyFilter?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const href = (patch: Partial<InvoiceQuery>) =>
    invoiceListHref({ ...query, ...patch });
  const go = (patch: Partial<InvoiceQuery>) =>
    router.push(href(patch), { scroll: false });
  const filters = admin ? invoiceFilters : clientInvoiceFilters;
  const filtered = !!query.search || !!query.company;
  const mode: InvoiceEditMode = editing?.editable === "draft" ? "draft" : "issued";

  return (
    <>
      <section
        aria-label="Lista de faturas"
        className="overflow-hidden rounded-xl border bg-card shadow-card"
      >
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <SearchField
            value={query.search}
            onChange={(search) => go({ search, page: 1 })}
            placeholder={showCompany
                    ? "Buscar por descrição ou cliente"
                    : "Buscar por descrição"}
          />
          {companyFilter && (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background pr-1 pl-2.5 text-xs font-medium text-foreground">
              <Building2Icon className="size-3.5 text-muted-foreground" />
              <span className="max-w-[14rem] truncate">{companyFilter.name}</span>
              <Link
                href={href({ company: "", page: 1 })}
                aria-label={`Remover filtro ${companyFilter.name}`}
                className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </Link>
            </span>
          )}
          <Select
            value={query.period}
            onValueChange={(period) =>
              go({ period: period as InvoicePeriod, from: "", to: "", page: 1 })
            }
          >
            <SelectTrigger aria-label="Filtrar por período" className="w-[176px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {invoicePeriods.map((period) => (
                <SelectItem key={period} value={period}>
                  {invoicePeriodLabels[period]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={query.status}
            onValueChange={(status) =>
              go({ status: status as InvoiceStatusFilter, page: 1 })
            }
          >
            <SelectTrigger aria-label="Filtrar por situação" className="w-[188px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {filters.map((status) => (
                <SelectItem key={status} value={status}>
                  {invoiceFilterLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {query.period === "custom" && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Vencimento de</span>
            <DateField
              name="de"
              value={query.from}
              onChange={(from) => go({ from, page: 1 })}
              placeholder="Início"
              className="w-40"
            />
            <span className="text-sm text-muted-foreground">até</span>
            <DateField
              name="ate"
              value={query.to}
              onChange={(to) => go({ to, page: 1 })}
              placeholder="Fim"
              className="w-40"
            />
          </div>
        )}

        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Fatura</TableHead>
                {showCompany && <TableHead>Cliente</TableHead>}
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="w-12 pr-3">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((invoice) => {
                const late =
                  invoice.display === "overdue"
                    ? daysOverdue(invoice.dueDate, today)
                    : 0;
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="max-w-[24rem] py-3 pl-4">
                      <Link
                        href={`/financeiro/${invoice.id}`}
                        className="group block min-w-0"
                      >
                        <span className="block truncate font-medium text-foreground group-hover:text-primary">
                          {invoice.description}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {invoice.recurring && (
                            <Repeat2Icon className="size-3" aria-hidden="true" />
                          )}
                          {billingTypeLabel(invoice.recurring, invoice.interval)}
                        </span>
                      </Link>
                    </TableCell>
                    {showCompany && (
                      <TableCell className="max-w-[16rem]">
                        <span className="block truncate text-foreground">
                          {invoice.company}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-right font-medium tabular-nums whitespace-nowrap text-foreground">
                      {currency(invoice.amountCents)}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.display} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span
                        className={cn(
                          "block tabular-nums",
                          late ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {dateLabel(invoice.dueDate)}
                      </span>
                      {late > 0 && (
                        <span className="block text-xs text-destructive">
                          {late === 1 ? "1 dia de atraso" : `${late} dias de atraso`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-3 text-right">
                      <RowMenu invoice={invoice} admin={admin} onEdit={setEditing} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<ReceiptTextIcon />}
            title={
              filtered
                ? "Nenhuma fatura encontrada"
                : query.status === "all"
                  ? "Nenhuma fatura ainda"
                  : "Nenhuma fatura nesta situação"
            }
            description={
              filtered
                ? "Tente outro termo ou mude o filtro de situação."
                : query.status === "all"
                  ? admin
                    ? "Crie a primeira cobrança para um cliente."
                    : "As cobranças da sua empresa aparecem aqui."
                  : "Mude o filtro para ver as demais faturas."
            }
            action={
              query.search ? (
                <Button variant="outline" asChild>
                  <Link href={href({ search: "", page: 1 })}>Limpar busca</Link>
                </Button>
              ) : admin && !filtered && query.status === "all" ? (
                <Button asChild>
                  <Link href="/financeiro/nova">
                    <PlusIcon />
                    Nova cobrança
                  </Link>
                </Button>
              ) : undefined
            }
          />
        )}

        <TablePagination
          page={query.page}
          pageCount={pageCount}
          pageSize={query.pageSize}
          total={total}
          noun={["fatura", "faturas"]}
          onPageChange={(page) => go({ page })}
          onPageSizeChange={(pageSize) => go({ pageSize, page: 1 })}
        />
      </section>
      <InvoiceSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode={mode}
        invoice={editing}
      />
    </>
  );
}
