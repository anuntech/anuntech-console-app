"use client";
import { SearchField } from "@/components/console/search-field";
import type { ChargeTerms } from "@/lib/billing/billing-terms";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BanIcon,
  Building2Icon,
  CopyIcon,
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  Repeat2Icon,
  Trash2Icon,
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
import { EmptyState } from "@/components/console/page-header";
import { ConfirmDialog } from "@/components/console/server-form";
import {
  CompanyCell,
  FilterChip,
  LinkRow,
  ListCard,
  ListPagination,
  PrimaryCell,
  RowActions,
} from "@/components/console/list-view";
import { toast } from "@/components/shell/notifications";
import { cancelDraft } from "@/lib/actions";
import { deleteDraftInvoice } from "@/lib/billing/invoice-deletion";
import { daysOverdue } from "@/lib/billing/billing-notice-rules";
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
} from "@/lib/billing/invoice-table";
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
  /** The boleto's date when the obligation is already past due. */
  bankDueDate?: string | null;
  recurring: boolean;
  interval: "monthly" | "yearly" | null;
  publicUrl: string | null;
  /** Which sheet "Editar" opens; null when nothing can change any more. */
  editable: "draft" | "issued" | null;
  cancellable: boolean;
  /** Staff only: a draft (or cancelled draft) that never reached the Inter. */
  deletable?: boolean;
  /** Cancelled by the Inter itself: deleting removes a charge that did exist. */
  bankClosed?: boolean;
  terms: ChargeTerms;
};

export const billingTypeLabel = (
  recurring: boolean,
  interval: "monthly" | "yearly" | null,
) =>
  recurring
    ? `Recorrente · ${interval === "yearly" ? "Anual" : "Mensal"}`
    : "Cobrança única";

/**
 * Deleting an invoice for good: a draft that never reached the bank, or a
 * charge the Inter already cancelled. Nothing is sent to the Inter or to
 * anyone. From the list it stays on the list (filters and page); from the
 * invoice it goes back to the list.
 */
export function DeleteInvoiceDialog({
  invoice,
  company,
  recurring,
  open,
  onOpenChange,
  fromList = false,
}: {
  invoice: { id: string; amountCents: number; dueDate: string; bankClosed?: boolean };
  company: string;
  recurring: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromList?: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      action={deleteDraftInvoice}
      fields={fromList ? { id: invoice.id, from: "list" } : { id: invoice.id }}
      title={invoice.bankClosed ? "Excluir fatura cancelada?" : "Excluir rascunho de fatura?"}
      description={(invoice.bankClosed
        ? [
            `A cobrança de ${currency(invoice.amountCents)} para ${company}, com vencimento em ${dateLabel(invoice.dueDate)}, já foi cancelada no Inter e sai do Console junto com os avisos enviados. O registro da exclusão fica na atividade.`,
            recurring && "A recorrência continua como está.",
            "Isso não pode ser desfeito.",
          ]
        : [
            `O rascunho de ${currency(invoice.amountCents)} para ${company}, com vencimento em ${dateLabel(invoice.dueDate)}, será apagado. Nada foi enviado ao Inter.`,
            recurring &&
              "Se a recorrência ainda não foi ativada, ela sai junto; se já rodou, a exclusão é recusada (pause ou cancele a recorrência).",
            "Isso não pode ser desfeito.",
          ]
      )
        .filter(Boolean)
        .join(" ")}
      confirmLabel="Excluir"
      destructive
    />
  );
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link de pagamento copiado.");
  } catch {
    toast.error("Não foi possível copiar. Abra a fatura e copie o link.");
  }
}

function InvoiceActions({
  invoice,
  admin,
  onEdit,
}: {
  invoice: InvoiceRow;
  admin: boolean;
  onEdit: (invoice: InvoiceRow) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletable = admin && !!invoice.deletable;
  return (
    <RowActions
      label={invoice.description}
      extra={
        admin && (
          <>
            {invoice.cancellable && (
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
            {deletable && (
              <DeleteInvoiceDialog
                invoice={invoice}
                company={invoice.company}
                recurring={invoice.recurring}
                open={deleting}
                onOpenChange={setDeleting}
                fromList
              />
            )}
          </>
        )
      }
    >
      <DropdownMenuItem asChild>
        <Link href={`/financeiro/${invoice.id}`}>
          <ReceiptTextIcon />
          Abrir fatura
        </Link>
      </DropdownMenuItem>
      {admin && invoice.editable && (
        <DropdownMenuItem onSelect={() => setTimeout(() => onEdit(invoice), 0)}>
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
      {admin && (invoice.cancellable || deletable) && <DropdownMenuSeparator />}
      {admin && invoice.cancellable && (
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => setTimeout(() => setCancelling(true), 0)}
        >
          <BanIcon />
          Cancelar rascunho
        </DropdownMenuItem>
      )}
      {deletable && (
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => setTimeout(() => setDeleting(true), 0)}
        >
          <Trash2Icon />
          Excluir
        </DropdownMenuItem>
      )}
    </RowActions>
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
  const filtered =
    !!query.search ||
    !!query.company ||
    query.status !== "all" ||
    query.period !== "all";
  const mode: InvoiceEditMode = editing?.editable === "draft" ? "draft" : "issued";
  // The company matters only while the list spans several: staff get it as its
  // own column, a client with several companies sees it in the subtitle
  // (the "Empresa" column is a staff view). A company filter makes it moot.
  const spansCompanies = showCompany && !query.company;
  const companyColumn = admin && spansCompanies;
  const companyInSubtitle = !admin && spansCompanies;

  return (
    <>
      <ListCard
        label="Lista de faturas"
        toolbar={
          <>
            <SearchField
              value={query.search}
              onChange={(search) => go({ search, page: 1 })}
              placeholder={
                showCompany ? "Buscar por descrição ou empresa" : "Buscar por descrição"
              }
            />
            {companyFilter && (
              <FilterChip
                icon={<Building2Icon />}
                label={companyFilter.name}
                removeHref={href({ company: "", page: 1 })}
              />
            )}
            <Select
              value={query.period}
              onValueChange={(period) =>
                go({ period: period as InvoicePeriod, from: "", to: "", page: 1 })
              }
            >
              <SelectTrigger aria-label="Filtrar por período" className="w-[176px]">
                <SelectValue>{invoicePeriodLabels[query.period]}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {invoicePeriods.map((period) => (
                  <SelectItem key={period} value={period}>
                    {invoicePeriodLabels[period]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {query.period === "custom" && (
              <>
                <DateField
                  name="de"
                  value={query.from}
                  onChange={(from) => go({ from, page: 1 })}
                  placeholder="De"
                  className="w-36 [&>button]:bg-card"
                />
                <DateField
                  name="ate"
                  value={query.to}
                  onChange={(to) => go({ to, page: 1 })}
                  placeholder="Até"
                  className="w-36 [&>button]:bg-card"
                />
              </>
            )}
            <Select
              value={query.status}
              onValueChange={(status) =>
                go({ status: status as InvoiceStatusFilter, page: 1 })
              }
            >
              <SelectTrigger aria-label="Filtrar por situação" className="w-[188px]">
                <SelectValue>{invoiceFilterLabels[query.status]}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {filters.map((status) => (
                  <SelectItem key={status} value={status}>
                    {invoiceFilterLabels[status]}
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
            noun={["fatura", "faturas"]}
            hrefFor={href}
          />
        }
      >
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Fatura</TableHead>
                {companyColumn && (
                  <TableHead className="hidden md:table-cell">Empresa</TableHead>
                )}
                <TableHead>Situação</TableHead>
                <TableHead className="hidden text-right md:table-cell">Valor</TableHead>
                <TableHead className="hidden md:table-cell">Vencimento</TableHead>
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
                  <LinkRow key={invoice.id} href={`/financeiro/${invoice.id}`}>
                    <PrimaryCell
                      href={`/financeiro/${invoice.id}`}
                      className="max-w-[24rem]"
                      title={invoice.description}
                      subtitle={
                        <span className="flex min-w-0 items-center gap-1">
                          {invoice.recurring && (
                            <Repeat2Icon className="size-3 shrink-0" aria-hidden="true" />
                          )}
                          <span className="truncate">
                            {companyInSubtitle && `${invoice.company} · `}
                            {billingTypeLabel(invoice.recurring, invoice.interval)}
                          </span>
                        </span>
                      }
                    />
                    {companyColumn && (
                      <CompanyCell>{invoice.company}</CompanyCell>
                    )}
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.display} />
                    </TableCell>
                    <TableCell className="hidden text-right font-medium whitespace-nowrap text-foreground tabular-nums md:table-cell">
                      {currency(invoice.amountCents)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">
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
                    <InvoiceActions invoice={invoice} admin={admin} onEdit={setEditing} />
                  </LinkRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<ReceiptTextIcon />}
            title={filtered ? "Nenhuma fatura encontrada" : "Nenhuma fatura ainda"}
            description={
              filtered
                ? "Tente outro termo ou mude os filtros."
                : admin
                  ? "Crie a primeira cobrança para um cliente."
                  : "As cobranças da sua empresa aparecem aqui."
            }
            action={
              filtered ? (
                <Button variant="outline" asChild>
                  <Link
                    href={invoiceListHref({
                      status: "all",
                      search: "",
                      company: "",
                      period: "all",
                      from: "",
                      to: "",
                      page: 1,
                      pageSize: query.pageSize,
                    })}
                    scroll={false}
                  >
                    Limpar filtros
                  </Link>
                </Button>
              ) : admin ? (
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
      </ListCard>
      <InvoiceSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode={mode}
        invoice={editing ? { ...editing, bankDueDate: editing.bankDueDate ?? null } : null}
      />
    </>
  );
}
