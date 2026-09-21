"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Search,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { startAssistedSession } from "@/lib/assisted-actions";
import {
  companyFilters,
  companyListHref,
  companyStatusLabels,
  type CompanyStatusFilter,
} from "@/lib/company-table";
import styles from "./crud-company-manager.module.css";

export type CompanyTableRow = {
  id: string;
  name: string;
  document: string;
  billingEmail: string;
  archived: boolean;
};

function RowActions({ company }: { company: CompanyTableRow }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector<HTMLElement>("a, button:not([disabled])")
      ?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return (
    <div className={styles.rowMenu} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.menuButton}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Ações de ${company.name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical size={17} aria-hidden="true" />
      </button>
      {/* Stays mounted while closed so the assisted-session form and its
          confirmation dialog survive the click that hides this panel. */}
      <div
        ref={panelRef}
        hidden={!open}
        className={styles.menu}
        onClickCapture={() => setOpen(false)}
      >
        <Link className={styles.menuItem} href={`/empresas/${company.id}`}>
          Gerenciar cadastro
        </Link>
        <Link
          className={styles.menuItem}
          href={`/chamados/novo?companyId=${company.id}`}
        >
          Abrir chamado
        </Link>
        <ActionForm
          action={startAssistedSession}
          className={styles.menuItemForm}
          label="Entrar como esta empresa"
          submitAriaLabel={`Entrar como ${company.name}`}
          confirm={{
            title: "Entrar como esta empresa?",
            description: `Você vai ver e usar o Console exatamente como ${company.name} vê, com acesso completo à empresa. Suas telas de administrador ficam ocultas até você sair do modo assistido.`,
            confirmLabel: "Entrar como esta empresa",
          }}
        >
          <input type="hidden" name="companyId" value={company.id} />
        </ActionForm>
      </div>
    </div>
  );
}

export default function CrudCompanyManager({
  rows,
  query,
  total,
  pageCount,
}: {
  rows: CompanyTableRow[];
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
  const href = (patch: Partial<typeof query>) =>
    companyListHref({ ...query, ...patch });
  return (
    <section className={styles.manager} aria-label="Lista de empresas">
      <div className={styles.toolbar}>
        <form
          action="/empresas"
          className={styles.searchForm}
          role="search"
          aria-label="Buscar empresas"
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
              placeholder="Buscar por nome, CNPJ ou e-mail..."
              aria-label="Buscar empresas por nome, CNPJ ou e-mail"
              maxLength={160}
            />
          </div>
          <button type="submit" className={styles.control}>
            Buscar
          </button>
        </form>
        <label className={styles.filter}>
          <span className="sr-only">Filtrar por situação</span>
          <select
            value={query.status}
            aria-label="Filtrar empresas por situação"
            onChange={(event) =>
              router.push(
                href({
                  status: event.target.value as CompanyStatusFilter,
                  page: 1,
                }),
                { scroll: false },
              )
            }
          >
            {companyFilters.map((status) => (
              <option key={status} value={status}>
                {companyStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        {query.search && (
          <Link className={styles.clear} href={href({ search: "", page: 1 })}>
            Limpar busca
          </Link>
        )}
      </div>
      <div
        className={styles.scroll}
        role="region"
        aria-label="Tabela de empresas"
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption className="sr-only">
            Empresas, documentos, contatos financeiros e situação
          </caption>
          <thead>
            <tr>
              <th scope="col">Empresa</th>
              <th scope="col">CNPJ</th>
              <th scope="col">E-mail financeiro</th>
              <th scope="col">Situação</th>
              <th scope="col" className={styles.actions}>
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((company) => (
              <tr key={company.id}>
                <td>
                  <Link
                    className={styles.entity}
                    href={`/empresas/${company.id}`}
                  >
                    <span className={styles.avatar}>
                      <Building2 size={16} aria-hidden="true" />
                    </span>
                    <span>{company.name}</span>
                  </Link>
                </td>
                <td className={styles.document}>{company.document}</td>
                <td className={styles.muted}>{company.billingEmail}</td>
                <td>
                  <span
                    className={styles.status}
                    data-status={company.archived ? "archived" : "active"}
                  >
                    <span aria-hidden="true" className={styles.dot} />
                    {company.archived ? "Arquivado" : "Ativo"}
                  </span>
                </td>
                <td className={styles.actions}>
                  <RowActions company={company} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  <Building2 size={28} strokeWidth={1.5} aria-hidden="true" />
                  <strong>Nenhuma empresa encontrada</strong>
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
            aria-label="Empresas por página"
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
            ? `${(query.page - 1) * query.pageSize + 1}–${Math.min(query.page * query.pageSize, total)} de ${total} ${total === 1 ? "empresa" : "empresas"}`
            : "0 empresas"}
        </span>
        <nav className={styles.pagination} aria-label="Paginação de empresas">
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
