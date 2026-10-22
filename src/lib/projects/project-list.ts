import "server-only";
import { and, asc, count, eq, ilike, inArray, max, or } from "drizzle-orm";
import { db } from "../db";
import { companies, engagements, tasks } from "@/db/schema";
import { allowedIds, engagementWhere, type Actor } from "../access/access";
import { clampPage, offsetOf, pageCountOf } from "../list-query";
import { companyShortcuts, type projectListQuery } from "./project-table";
import { taskSummary } from "./tasks";

type ProjectQuery = ReturnType<typeof projectListQuery>;

/**
 * The projects a person sees, one page at a time, with each board's progress
 * and last activity: the web's /projetos and the app's projects.list. A
 * Membro with a selection sees only the projects chosen for them.
 */
export async function listProjects(actor: Actor, input: ProjectQuery) {
  const ids = [...new Set(allowedIds(actor, "overview"))];
  const query = { ...input };
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  const showCompany = actor.admin || ids.length > 1;
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const where = and(
    eq(engagements.kind, "project"),
    // The company and, for a Membro with a selection, only the projects chosen for them.
    engagementWhere(actor, engagements.id, engagements.companyId),
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
        companyDocument: companies.document,
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
          .select({ id: companies.id, name: companies.name, document: companies.document })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => found[0] ?? null)
      : null,
    // The companies behind every match (not only this page), for the "Só desta empresa" shortcuts.
    query.search && !query.company && showCompany
      ? db
          .selectDistinct({ id: companies.id, name: companies.name, document: companies.document })
          .from(engagements)
          .innerJoin(companies, eq(companies.id, engagements.companyId))
          .where(where)
          .orderBy(asc(companies.name))
          .then((found) => companyShortcuts(found, query.search))
      : [],
  ]);
  // Tasks are counted only for the projects on this page.
  const pageIds = rows.map((row) => row.id);
  const [summary, activity] = await Promise.all([
    taskSummary(pageIds),
    pageIds.length
      ? db
          .select({ engagementId: tasks.engagementId, at: max(tasks.updatedAt) })
          .from(tasks)
          .where(inArray(tasks.engagementId, pageIds))
          .groupBy(tasks.engagementId)
          .then((found) => new Map(found.map((row) => [row.engagementId, row.at])))
      : new Map<string, Date | null>(),
  ]);
  return {
    rows: rows.map(({ createdAt, ...row }) => ({
      ...row,
      tasks: summary.get(row.id) ?? { total: 0, done: 0 },
      // The project moves with its board: the last task change, or its creation.
      updatedAt: (activity.get(row.id) ?? createdAt).toISOString(),
    })),
    paging,
    total,
    pageCount: pageCountOf(total, paging.pageSize),
    showCompany,
    companyFilter,
    shortcuts,
  };
}
