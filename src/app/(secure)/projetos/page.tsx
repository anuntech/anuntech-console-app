import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, asc, count, eq, ilike, inArray, max, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, engagements, tasks } from "@/db/schema";
import { getActor } from "@/lib/access";
import { clampPage, offsetOf, pageCountOf } from "@/lib/list-query";
import { companyShortcuts, projectListQuery } from "@/lib/project-table";
import { taskSummary } from "@/lib/tasks";
import { engagementLinks } from "@/lib/record-links";
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
  const query = projectListQuery(await searchParams);
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  const showCompany = actor.admin || ids.length > 1;
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
  const [{ total }] = await db
    .select({ total: count() })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .where(where);
  const paging = { ...query, ...clampPage(query, total) };
  const [rows, companyFilter, shortcuts] = await Promise.all([
    db
      .select({
        id: engagements.id,
        name: engagements.name,
        status: engagements.status,
        description: engagements.description,
        companyId: engagements.companyId,
        company: companies.name,
        createdAt: engagements.createdAt,
      })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .where(where)
      // The id breaks ties between equal names, so pages never overlap.
      .orderBy(asc(engagements.name), asc(engagements.id))
      .limit(paging.pageSize)
      .offset(offsetOf(paging)),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => found[0] ?? null)
      : null,
    // The companies behind every match (not only this page), for the "Só desta empresa" shortcuts.
    query.search && !query.company && showCompany
      ? db
          .selectDistinct({ id: companies.id, name: companies.name })
          .from(engagements)
          .innerJoin(companies, eq(companies.id, engagements.companyId))
          .where(where)
          .orderBy(asc(companies.name))
          .then((found) => companyShortcuts(found, query.search))
      : [],
  ]);
  // Tasks are counted only for the projects on this page.
  const pageIds = rows.map((row) => row.id);
  const [summary, activity, links] = await Promise.all([
    taskSummary(pageIds),
    pageIds.length
      ? db
          .select({ engagementId: tasks.engagementId, at: max(tasks.updatedAt) })
          .from(tasks)
          .where(inArray(tasks.engagementId, pageIds))
          .groupBy(tasks.engagementId)
          .then((found) => new Map(found.map((row) => [row.engagementId, row.at])))
      : new Map<string, Date | null>(),
    // Staff see "Excluir" only where nothing billed or signed points at the project.
    actor.admin ? engagementLinks(pageIds) : null,
  ]);
  return (
    <>
      <PageHeader
        title="Projetos"
        count={total}
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
        rows={rows.map(({ createdAt, ...row }) => ({
          ...row,
          tasks: summary.get(row.id) ?? { total: 0, done: 0 },
          // The project moves with its board: the last task change, or its creation.
          updatedAt: (activity.get(row.id) ?? createdAt).toISOString(),
          links: links?.get(row.id),
        }))}
        query={paging}
        total={total}
        pageCount={pageCountOf(total, paging.pageSize)}
        now={new Date().toISOString()}
        admin={actor.admin}
        showCompany={showCompany}
        companyFilter={companyFilter}
        companyShortcuts={shortcuts}
      />
    </>
  );
}
