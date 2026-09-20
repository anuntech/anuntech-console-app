"use client";

// Adapted from shadcn.io/blocks/crud-data-table and crud-invoice-manager.
import Link from "next/link";
import {
  Copy,
  Eye,
  MoreVertical,
  Search,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  Repeat2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { currency, dateLabel } from "@/lib/format";
import {
  invoiceDisplayStatus,
  invoiceListHref,
  type InvoiceStatusFilter,
  type InvoiceDisplayStatus,
  type InvoiceTableStatus,
} from "@/lib/invoice-table";
import styles from "./crud-invoice-manager.module.css";

export interface InvoiceTableRow {
  id: string;
  description: string;
  company: string;
  amountCents: number;
  status: InvoiceTableStatus;
  dueDate: string;
  createdDate: string;
  recurring?: boolean;
  scheduled?: boolean;
  publicUrl?: string;
}

type StatusFilter = InvoiceStatusFilter;
const labels: Record<StatusFilter, string> = {
  all: "Todas",
  paid: "Pagas",
  issued: "Em aberto",
  overdue: "Vencidas",
  draft: "Rascunhos",
  scheduled: "Agendadas",
  cancelled: "Canceladas",
};
const statusLabels: Record<InvoiceDisplayStatus, string> = {
  paid: "Paga",
  issued: "Em aberto",
  overdue: "Vencida",
  draft: "Rascunho",
  scheduled: "Agendada",
  cancelled: "Cancelada",
};

export default function CrudInvoiceManager({
  invoices,
  today,
  admin,
  query,
  counts,
  total,
  pageCount,
}: {
  invoices: InvoiceTableRow[];
  today: string;
  admin: boolean;
  query: {
    status: StatusFilter;
    search: string;
    page: number;
    pageSize: number;
  };
  counts: Record<StatusFilter, number>;
  total: number;
  pageCount: number;
}) {
  const router = useRouter();
  const filters: StatusFilter[] = admin
    ? ["all", "issued", "overdue", "paid", "scheduled", "draft", "cancelled"]
    : ["all", "issued", "overdue", "paid"];
  const href = (patch: Partial<typeof query>) =>
    invoiceListHref({ ...query, ...patch });

  async function copyLink(id: string, publicUrl?: string) {
    try {
      await navigator.clipboard.writeText(
        publicUrl || new URL(`/financeiro/${id}`, window.location.origin).href,
      );
      toast.success("Link da fatura copiado.");
    } catch {
      toast.error(
        "Não foi possível copiar o link. Abra a fatura e copie o endereço.",
      );
    }
  }

  return (
    <section className={styles.manager} aria-label="Lista de faturas">
      <nav className={styles.filters} aria-label="Filtrar faturas por situação">
        {filters.map((status) => (
          <Link
            key={status}
            href={href({ status, page: 1 })}
            aria-current={query.status === status ? "page" : undefined}
            scroll={false}
          >
            {labels[status]} <span>{counts[status]}</span>
          </Link>
        ))}
      </nav>
      <form
        action="/financeiro"
        className={styles.toolbar}
        role="search"
        aria-label="Buscar faturas"
      >
        <input type="hidden" name="status" value={query.status} />
        <input type="hidden" name="size" value={query.pageSize} />
        <div className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            key={query.search}
            type="search"
            name="q"
            defaultValue={query.search}
            placeholder="Buscar cliente ou descrição..."
            aria-label="Buscar faturas por cliente ou descrição"
            maxLength={160}
          />
        </div>
        <button type="submit" className={styles.control}>
          Buscar
        </button>
        {query.search && (
          <Link className={styles.clear} href={href({ search: "", page: 1 })}>
            Limpar busca
          </Link>
        )}
      </form>
      <div
        className={styles.scroll}
        role="region"
        aria-label="Tabela de faturas"
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className="sr-only">
            Faturas, clientes, valores, situações e vencimentos
          </caption>
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Cliente</th>
              <th scope="col" className={styles.money}>
                Valor
              </th>
              <th scope="col">Situação</th>
              <th scope="col">Vencimento</th>
              <th scope="col" className={styles.actions}>
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const status = invoiceDisplayStatus(invoice, today);
              const invoiceLabel = `${invoice.description} — ${invoice.company}, vencimento ${dateLabel(invoice.dueDate)}`;
              return (
                <tr key={invoice.id}>
                  <td>
                    <Link
                      className={styles.product}
                      href={`/financeiro/${invoice.id}`}
                      aria-label={invoiceLabel}
                    >
                      {invoice.description}
                    </Link>
                    <span className={styles.created}>
                      {invoice.recurring && (
                        <Repeat2 size={11} aria-hidden="true" />
                      )}
                      {invoice.recurring ? "Recorrente" : "Única"}
                    </span>
                  </td>
                  <td>
                    <span className={styles.company}>{invoice.company}</span>
                    <span className={styles.created}>
                      Criada em {dateLabel(invoice.createdDate)}
                    </span>
                  </td>
                  <td className={styles.money}>
                    {currency(invoice.amountCents)}
                  </td>
                  <td>
                    <span className={styles.status} data-status={status}>
                      <span aria-hidden="true" className={styles.dot} />
                      {statusLabels[status]}
                    </span>
                  </td>
                  <td className={styles.date}>{dateLabel(invoice.dueDate)}</td>
                  <td className={styles.actions}>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          className={styles.menuButton}
                          aria-label={`Ações da fatura: ${invoiceLabel}`}
                        >
                          <MoreVertical size={17} aria-hidden="true" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className={styles.menu}
                          align="end"
                          sideOffset={6}
                        >
                          <DropdownMenu.Item
                            asChild
                            className={styles.menuItem}
                          >
                            <Link
                              href={`/financeiro/${invoice.id}`}
                              aria-label={`Ver fatura: ${invoiceLabel}`}
                            >
                              <Eye size={16} aria-hidden="true" />
                              Ver fatura
                            </Link>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className={styles.menuItem}
                            onSelect={() =>
                              void copyLink(invoice.id, invoice.publicUrl)
                            }
                          >
                            <Copy size={16} aria-hidden="true" />
                            {invoice.publicUrl
                              ? "Copiar link de pagamento"
                              : "Copiar link interno"}
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              );
            })}
            {!invoices.length && (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  <ReceiptText size={28} strokeWidth={1.5} aria-hidden="true" />
                  <strong>Nenhuma fatura encontrada</strong>
                  <p>Tente outra situação ou busca.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <label className={styles.pageSize}>
          Por página
          <select
            aria-label="Faturas por página"
            value={query.pageSize}
            onChange={(event) =>
              router.push(
                href({ pageSize: Number(event.target.value), page: 1 }),
                { scroll: false },
              )
            }
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span aria-live="polite">
          {total
            ? `${(query.page - 1) * query.pageSize + 1}–${Math.min(query.page * query.pageSize, total)} de ${total} faturas`
            : "0 faturas"}
        </span>
        <nav className={styles.pagination} aria-label="Paginação de faturas">
          {query.page > 1 ? (
            <Link
              className={styles.control}
              href={href({ page: query.page - 1 })}
              scroll={false}
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Anterior
            </Link>
          ) : (
            <button type="button" className={styles.control} disabled>
              <ChevronLeft size={15} aria-hidden="true" />
              Anterior
            </button>
          )}
          <span>
            Página {query.page} de {pageCount}
          </span>
          {query.page < pageCount ? (
            <Link
              className={styles.control}
              href={href({ page: query.page + 1 })}
              scroll={false}
            >
              Próxima
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          ) : (
            <button type="button" className={styles.control} disabled>
              Próxima
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          )}
        </nav>
      </div>
    </section>
  );
}
