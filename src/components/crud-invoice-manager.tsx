"use client";

// Adapted from shadcn.io/blocks/crud-invoice-manager to Console's billing flow.
import Link from "next/link";
import { Copy, Eye, MoreVertical } from "lucide-react";
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { currency, dateLabel } from "@/lib/format";
import {
  invoiceDisplayStatus,
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
}

type StatusFilter = "all" | InvoiceDisplayStatus;
const labels: Record<StatusFilter, string> = {
  all: "Todas",
  paid: "Pagas",
  issued: "Em aberto",
  overdue: "Vencidas",
  draft: "Rascunhos",
  cancelled: "Canceladas",
};
const statusLabels: Record<InvoiceDisplayStatus, string> = {
  paid: "Paga",
  issued: "Em aberto",
  overdue: "Vencida",
  draft: "Rascunho",
  cancelled: "Cancelada",
};

export default function CrudInvoiceManager({
  invoices,
  today,
  admin,
}: {
  invoices: InvoiceTableRow[];
  today: string;
  admin: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const filters: StatusFilter[] = admin
    ? ["all", "paid", "issued", "overdue", "draft", "cancelled"]
    : ["all", "paid", "issued", "overdue"];
  const filteredInvoices = invoices.filter(
    (invoice) =>
      statusFilter === "all" ||
      invoiceDisplayStatus(invoice, today) === statusFilter,
  );
  const totalAmount = filteredInvoices.reduce(
    (sum, invoice) => sum + invoice.amountCents,
    0,
  );

  async function copyLink(id: string) {
    try {
      await navigator.clipboard.writeText(
        new URL(`/financeiro/${id}`, window.location.origin).href,
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
      <div className={styles.header}>
        <h2>Faturas</h2>
        <div className={styles.summary} aria-live="polite" aria-atomic="true">
          <span>Total da seleção</span>
          <strong>{currency(totalAmount)}</strong>
        </div>
      </div>
      <div
        className={styles.filters}
        role="group"
        aria-label="Filtrar faturas por situação"
      >
        {filters.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={statusFilter === status}
            onClick={() => setStatusFilter(status)}
          >
            {labels[status]}{" "}
            <span>
              (
              {status === "all"
                ? invoices.length
                : invoices.filter(
                    (invoice) =>
                      invoiceDisplayStatus(invoice, today) === status,
                  ).length}
              )
            </span>
          </button>
        ))}
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
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
            {filteredInvoices.map((invoice) => {
              const status = invoiceDisplayStatus(invoice, today);
              return (
                <tr key={invoice.id}>
                  <td>
                    <Link
                      className={styles.product}
                      href={`/financeiro/${invoice.id}`}
                    >
                      {invoice.description}
                    </Link>
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
                    <span className={styles.status}>
                      <span
                        aria-hidden="true"
                        className={`${styles.dot} ${styles[status]}`}
                      />
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
                          aria-label={`Ações da fatura: ${invoice.description} — ${invoice.company}`}
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
                            <Link href={`/financeiro/${invoice.id}`}>
                              <Eye size={16} aria-hidden="true" />
                              Ver fatura
                            </Link>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className={styles.menuItem}
                            onSelect={() => void copyLink(invoice.id)}
                          >
                            <Copy size={16} aria-hidden="true" />
                            Copiar link
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              );
            })}
            {!filteredInvoices.length && (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  {invoices.length
                    ? "Nenhuma fatura nesta situação."
                    : "Nenhuma fatura disponível."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <span aria-live="polite">
          Exibindo {filteredInvoices.length} de {invoices.length} faturas
        </span>
        <strong>Total: {currency(totalAmount)}</strong>
      </div>
    </section>
  );
}
