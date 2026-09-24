"use client";
import { SearchField } from "@/components/console/search-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2Icon,
  FolderKanbanIcon,
  PlusIcon,
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
import { EmptyState } from "@/components/console/page-header";
import {
  projectFilterLabels,
  projectFilters,
  projectListHref,
  type ProjectQuery,
  type ProjectStatusFilter,
} from "@/lib/project-table";
import { EngagementStatusBadge } from "./project-badges";

export type ProjectRow = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  companyId: string;
  company: string;
  tasks: { total: number; done: number };
};

const fold = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");

export function ProjectsList({
  rows,
  query,
  admin,
  showCompany,
  companyFilter = null,
}: {
  rows: ProjectRow[];
  query: ProjectQuery;
  admin: boolean;
  showCompany: boolean;
  companyFilter?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const href = (patch: Partial<ProjectQuery>) => projectListHref({ ...query, ...patch });
  const go = (patch: Partial<ProjectQuery>) => router.push(href(patch), { scroll: false });
  const filtered = !!query.search || !!query.company;
  // Typing a company's name offers a one-click narrowing to that company.
  const companyMatches = query.search
    ? [...new Map(rows.map((row) => [row.companyId, { id: row.companyId, name: row.company }])).values()]
        .filter((company) => fold(company.name).includes(fold(query.search.trim())))
        .slice(0, 4)
    : [];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField
          value={query.search}
          onChange={(search) => go({ search })}
          placeholder={showCompany ? "Buscar por nome ou empresa" : "Buscar por nome"}
        />
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
          onValueChange={(status) => go({ status: status as ProjectStatusFilter })}
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

      {query.search && !query.company && showCompany && companyMatches.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Só desta empresa:</span>
          {companyMatches.map((company) => (
            <Link
              key={company.id}
              href={href({ company: company.id, search: "" })}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <Building2Icon className="size-3.5 text-muted-foreground" />
              {company.name}
            </Link>
          ))}
        </div>
      )}
      {rows.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const progress = row.tasks.total
              ? Math.round((row.tasks.done / row.tasks.total) * 100)
              : 0;
            return (
              <li key={row.id}>
                <Link
                  href={`/projetos/${row.id}`}
                  className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-card transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-5">
                      <FolderKanbanIcon />
                    </span>
                    <EngagementStatusBadge status={row.status} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-foreground group-hover:text-primary">
                      {row.name}
                    </h2>
                    {showCompany && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.company}</p>
                    )}
                    <p
                      className={cn(
                        "mt-3 line-clamp-2 text-sm",
                        row.description ? "text-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {row.description || "Sem descrição."}
                    </p>
                  </div>
                  <div className="mt-auto">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {row.tasks.total
                          ? `${row.tasks.done} de ${row.tasks.total} ${row.tasks.total === 1 ? "tarefa" : "tarefas"}`
                          : "Nenhuma tarefa ainda"}
                      </span>
                      {row.tasks.total > 0 && <span className="tabular-nums">{progress}%</span>}
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Tarefas concluídas"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <section className="rounded-xl border bg-card shadow-card">
          <EmptyState
            icon={<FolderKanbanIcon />}
            title={filtered ? "Nada encontrado" : "Nenhum projeto ainda"}
            description={
              filtered
                ? "Tente outro termo ou mude o filtro de situação."
                : admin
                  ? "Crie o primeiro projeto de um cliente e organize as tarefas no quadro."
                  : "Os projetos da sua empresa com a Anuntech aparecem aqui."
            }
            action={
              query.search ? (
                <Button variant="outline" asChild>
                  <Link href={href({ search: "" })}>Limpar busca</Link>
                </Button>
              ) : admin && !filtered ? (
                <Button asChild>
                  <Link href="/projetos/novo">
                    <PlusIcon />
                    Novo projeto
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </section>
      )}
    </>
  );
}
