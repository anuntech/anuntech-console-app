import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, engagements } from "@/db/schema";
import { getActor } from "@/lib/access";
import { projectQuery } from "@/lib/project-table";
import { taskSummary } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { ProjectsList } from "@/components/projetos/projects-list";
export const metadata: Metadata = {
  title: "Projetos",
  description: "Os projetos em andamento e o quadro de tarefas de cada um.",
};

export default async function Projects({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const ids = actor.grants.map((g) => g.company.id);
  const query = projectQuery(await searchParams);
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const where = and(
    eq(engagements.kind, "project"),
    actor.admin ? undefined : ids.length ? inArray(engagements.companyId, ids) : sql`false`,
    query.status === "all" ? undefined : eq(engagements.status, query.status),
    query.company ? eq(engagements.companyId, query.company) : undefined,
    search
      ? or(ilike(engagements.name, `%${search}%`), ilike(companies.name, `%${search}%`))
      : undefined,
  );
  const [rows, companyFilter] = await Promise.all([
    db
      .select({
        id: engagements.id,
        name: engagements.name,
        status: engagements.status,
        description: engagements.description,
        companyId: engagements.companyId,
        company: companies.name,
      })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .where(where)
      .orderBy(asc(engagements.name)),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => found[0] ?? null)
      : null,
  ]);
  const summary = await taskSummary(rows.map((row) => row.id));
  return (
    <>
      <PageHeader
        title="Projetos"
        count={rows.length}
        description={
          actor.admin
            ? "O que está em andamento com cada cliente, com o quadro de tarefas de cada projeto."
            : "O que sua empresa constrói com a Anuntech e como cada projeto avança."
        }
        actions={
          actor.admin && (
            <Button asChild>
              <Link href="/projetos/novo">
                <PlusIcon />
                Novo projeto
              </Link>
            </Button>
          )
        }
      />
      <ProjectsList
        rows={rows.map((row) => ({
          ...row,
          tasks: summary.get(row.id) ?? { total: 0, done: 0 },
        }))}
        query={query}
        admin={actor.admin}
        showCompany={actor.admin || ids.length > 1}
        companyFilter={companyFilter}
      />
    </>
  );
}
