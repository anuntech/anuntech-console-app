"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRightIcon,
  Building2Icon,
  CircleCheckIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PackageIcon,
  WrenchIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/console/page-header";
import {
  projectFilterLabels,
  projectFilters,
  projectListHref,
  type ProjectQuery,
  type ProjectStatusFilter,
} from "@/lib/project-table";
import { EngagementStatusBadge } from "@/components/projetos/project-badges";
import { currency, shortDateLabel } from "@/lib/format";
import { useEngagementStatus } from "@/components/projetos/engagement-status";
import { ProductSheet, type ProductFormValues } from "./product-form";

export type ProductRow = {
  id: string;
  kind: "product" | "service";
  name: string;
  status: string;
  description: string | null;
  url: string | null;
  amountCents: number | null;
  interval: "monthly" | "yearly" | null;
  nextDueDate: string | null;
  subscriptionId?: string | null;
  companyId: string;
  company: string;
};
const intervalLabel = { monthly: "/mês", yearly: "/ano" } as const;

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The products a company has with Anuntech; each card opens the product. */
export function ProductsList({
  rows,
  query,
  admin,
  showCompany,
  companyFilter = null,
}: {
  rows: ProductRow[];
  query: ProjectQuery;
  admin: boolean;
  showCompany: boolean;
  companyFilter?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProductFormValues | null>(null);
  const { change, form: statusForm } = useEngagementStatus();
  const href = (patch: Partial<ProjectQuery>) =>
    projectListHref({ ...query, ...patch }, "/produtos");
  const filtered = !!query.search || !!query.company;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          action="/produtos"
          role="search"
          aria-label="Buscar produtos e serviços"
          className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1"
        >
          <input type="hidden" name="status" value={query.status} />
          {query.company && <input type="hidden" name="company" value={query.company} />}
          <div className="relative w-full max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              key={query.search}
              type="search"
              name="q"
              defaultValue={query.search}
              placeholder={showCompany ? "Buscar por nome ou empresa" : "Buscar por nome"}
              aria-label={showCompany ? "Buscar por nome ou empresa" : "Buscar por nome"}
              maxLength={160}
              className="bg-card pl-9"
            />
          </div>
          {query.search && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={href({ search: "" })}>
                <XIcon />
                Limpar
              </Link>
            </Button>
          )}
        </form>
        {companyFilter && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card pr-1 pl-2.5 text-xs font-medium text-foreground">
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
        <Select
          value={query.status}
          onValueChange={(status) =>
            router.push(href({ status: status as ProjectStatusFilter }), { scroll: false })
          }
        >
          <SelectTrigger aria-label="Filtrar por situação" className="w-[188px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {projectFilters.map((status) => (
              <SelectItem key={status} value={status}>
                {projectFilterLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-5">
                  {row.kind === "service" ? <WrenchIcon /> : <PackageIcon />}
                </span>
                <div className="flex items-center gap-1">
                  <EngagementStatusBadge status={row.status} />
                  {admin && (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground"
                          aria-label={`Ações de ${row.name}`}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onSelect={() =>
                            setTimeout(
                              () =>
                                setEditing({
                                  id: row.id,
                                  name: row.name,
                                  description: row.description,
                                  url: row.url,
                                  amountCents: row.amountCents,
                                  subscriptionId: row.subscriptionId ?? null,
                                }),
                              0,
                            )
                          }
                        >
                          <PencilIcon />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/empresas/${row.companyId}`}>
                            <Building2Icon />
                            Ver empresa
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {row.status !== "active" && (
                          <DropdownMenuItem onSelect={() => change(row.id, "active")}>
                            <PlayIcon />
                            {row.status === "paused" ? "Reativar" : "Reabrir"}
                          </DropdownMenuItem>
                        )}
                        {row.status === "active" && (
                          <DropdownMenuItem onSelect={() => change(row.id, "paused")}>
                            <PauseIcon />
                            Pausar
                          </DropdownMenuItem>
                        )}
                        {row.status !== "completed" && (
                          <DropdownMenuItem onSelect={() => change(row.id, "completed")}>
                            <CircleCheckIcon />
                            Encerrar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <h2 className="m-0 truncate text-base leading-6 font-semibold text-foreground">
                  {row.name}
                </h2>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {row.kind === "service" ? "Serviço" : "Produto"}
                  {showCompany && ` · ${row.company}`}
                </p>
                <p
                  className={cn(
                    "mt-3 line-clamp-2 text-sm",
                    row.description ? "text-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {row.description || "Sem descrição."}
                </p>
                {row.amountCents != null && (
                  <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                    <span className="font-medium text-foreground">{currency(row.amountCents)}</span>
                    {row.interval && intervalLabel[row.interval]}
                    {row.nextDueDate && ` · próximo vencimento ${shortDateLabel(row.nextDueDate)}`}
                  </p>
                )}
              </div>
              <div className="mt-auto flex items-center justify-between gap-3">
                {row.kind === "service" ? (
                  <>
                    <span className="truncate text-xs text-muted-foreground">O que fazemos, prazos e resultados</span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/produtos/${row.id}`}>
                        Ver detalhes
                        <ArrowRightIcon />
                      </Link>
                    </Button>
                  </>
                ) : row.url ? (
                  <>
                    <span className="truncate text-xs text-muted-foreground">{hostOf(row.url)}</span>
                    <Button variant="outline" size="sm" asChild>
                      <a href={row.url} target="_blank" rel="noopener noreferrer">
                        Abrir
                        <ExternalLinkIcon />
                      </a>
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Sem link cadastrado.</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="rounded-xl border bg-card shadow-card">
          <EmptyState
            icon={<PackageIcon />}
            title={filtered ? "Nada encontrado" : "Nenhum produto ou serviço ainda"}
            description={
              filtered
                ? "Tente outro termo ou mude o filtro de situação."
                : admin
                  ? "Vincule um item do catálogo a um cliente, com o preço dele."
                  : "Os produtos e serviços que sua empresa tem com a Anuntech aparecem aqui."
            }
            action={
              query.search ? (
                <Button variant="outline" asChild>
                  <Link href={href({ search: "" })}>Limpar busca</Link>
                </Button>
              ) : admin && !filtered ? (
                <Button asChild>
                  <Link href="/produtos/novo">
                    <PlusIcon />
                    Vincular
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </section>
      )}
      {admin && (
        <>
          <ProductSheet
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            values={editing}
          />
          {statusForm}
        </>
      )}
    </>
  );
}
