import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { contractSignatures, contracts as contractTable, engagements, quotes as quoteTable } from "@/db/schema";
import { db } from "../../db";
import { engagementLabels } from "../../format";
import { projectListQuery } from "../../projects/project-table";
import { listProjects } from "../../projects/project-list";
import { findEngagement, projectTasks } from "../../projects/project-view";
import { TASK_STATUSES, taskPriorityLabels, taskStatusLabels } from "../../projects/task-model";
import { contractKindLabels, contractQuery, contractStatusLabels } from "../../contracts/contract-table";
import { listContracts } from "../../contracts/contract-list";
import { findContract } from "../../contracts/contract-access";
import { quoteTableQuery } from "../../quotes/quote-table";
import { listQuotes } from "../../quotes/quote-list";
import { findQuote } from "../../quotes/quote-access";
import { quoteNumberLabel, quoteStatusLabels, quoteTotals } from "../../quotes/quote-model";
import { bookmarkQuery, bookmarksFor, foldersFor, scopeOf } from "../../bookmarks/bookmarks";
import { api } from "../server";
import { guard, missing } from "../access";

const label = (labels: Record<string, string>, value: string) => labels[value] ?? value;
const pageParams = (page: number) => ({ page: String(page) });
/** The company of a record the input names, for the guard; unknown ids reach no one. */
const companyOf =
  (table: typeof engagements | typeof contractTable | typeof quoteTable) =>
  async ({ id }: { id: string }) =>
    (await db.select({ companyId: table.companyId }).from(table).where(eq(table.id, id)))[0]?.companyId;

export const projects = {
  list: api.projects.list
    // listProjects keeps each person to their companies and, for a Membro, the projects chosen for them.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const list = await listProjects(context.actor, projectListQuery(pageParams(input.page)));
      return {
        rows: list.rows.map((row) => ({
          id: row.id,
          name: row.name,
          statusLabel: label(engagementLabels, row.status),
          company: row.company,
          tasks: row.tasks,
          updatedAt: row.updatedAt,
        })),
        page: list.paging.page,
        pageCount: list.pageCount,
        showCompany: list.showCompany,
      };
    }),
  get: api.projects.get
    .use(guard({ area: "overview", company: companyOf(engagements) }))
    .handler(async ({ input, context }) => {
      const row = await findEngagement(context.actor, input.id);
      if (!row || row.project.kind !== "project") throw missing();
      const tasks = await projectTasks(context.actor, row.project);
      return {
        id: row.project.id,
        name: row.project.name,
        description: row.project.description,
        company: row.company,
        statusLabel: label(engagementLabels, row.project.status),
        columns: TASK_STATUSES.map((status) => ({
          status,
          label: taskStatusLabels[status],
          tasks: tasks
            .filter((task) => task.status === status)
            .map((task) => ({
              id: task.id,
              title: task.title,
              description: task.description,
              priorityLabel: label(taskPriorityLabels, task.priority),
              dueDate: task.dueDate,
              assignees: task.assignees.map((person) => person.name),
              comments: task.comments.length,
              files: task.files.length,
              reviewDue: task.reviewDue,
            })),
        })),
      };
    }),
};

export const contracts = {
  list: api.contracts.list
    // listContracts keeps a client to their finance companies and what went out; a Membro sees none.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const result = await listContracts(context.actor, contractQuery(pageParams(input.page)));
      return {
        rows: result.list.map((row) => ({
          id: row.id,
          title: row.title,
          company: row.company,
          status: row.status,
          statusLabel: label(contractStatusLabels, row.status),
          kindLabel: label(contractKindLabels, row.kind),
          updatedAt: row.updatedAt,
        })),
        page: result.query.page,
        pageCount: result.pageCount,
        showCompany: result.showCompany,
      };
    }),
  get: api.contracts.get
    .use(guard({ area: "finance", company: companyOf(contractTable) }))
    .handler(async ({ input, context }) => {
      const row = await findContract(context.actor, input.id);
      if (!row) throw missing();
      const c = row.contract;
      // What the client sees is the text frozen when it was sent.
      const text = c.publication ?? { title: c.title, body: c.body };
      const signatures = await db
        .select({ party: contractSignatures.party, name: contractSignatures.name, signedAt: contractSignatures.signedAt })
        .from(contractSignatures)
        .where(and(eq(contractSignatures.contractId, c.id), eq(contractSignatures.documentHash, c.documentHash ?? "")))
        .orderBy(asc(contractSignatures.signedAt));
      return {
        id: c.id,
        title: text.title,
        company: row.company.name,
        engagement: row.engagement,
        status: c.status,
        statusLabel: label(contractStatusLabels, c.status),
        kindLabel: label(contractKindLabels, c.kind),
        updatedAt: c.updatedAt.toISOString(),
        body: text.body,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        signatures: signatures.map((s) => ({ party: s.party, name: s.name, signedAt: s.signedAt.toISOString() })),
        pdfPath: `/api/contratos/${c.id}/pdf`,
      };
    }),
};

export const quotes = {
  list: api.quotes.list
    // listQuotes keeps a client to their finance companies and what went out; a Membro sees none.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const result = await listQuotes(context.actor, quoteTableQuery(pageParams(input.page)));
      return {
        rows: result.list.map((row) => ({
          id: row.id,
          number: row.number,
          title: row.title,
          company: row.company,
          status: row.status,
          statusLabel: label(quoteStatusLabels, row.status),
          totalCents: row.totalCents,
          validUntil: row.validUntil,
          updatedAt: row.updatedAt,
        })),
        page: result.paged.page,
        pageCount: result.pageCount,
        showCompany: context.actor.admin || result.ids.length > 1,
      };
    }),
  get: api.quotes.get
    .use(guard({ area: "finance", company: companyOf(quoteTable) }))
    .handler(async ({ input, context }) => {
      const row = await findQuote(context.actor, input.id);
      if (!row) throw missing();
      const q = row.quote;
      // The figures the client was sent; a draft (team only) shows what it would send.
      const frozen = q.status !== "draft" && q.publication ? q.publication : null;
      const totals = quoteTotals(frozen ?? q.content);
      return {
        id: q.id,
        number: frozen?.number ?? quoteNumberLabel(q.year, q.seq),
        title: frozen?.title ?? q.title,
        company: frozen?.companyName ?? row.company.name,
        status: q.status,
        statusLabel: label(quoteStatusLabels, q.status),
        updatedAt: q.updatedAt.toISOString(),
        validUntil: frozen ? frozen.validUntil : q.validUntil,
        totalCents: totals.totalCents,
        hoursMin: totals.hoursMin,
        hoursMax: totals.hoursMax,
        decision:
          q.decidedAt && q.decidedParty && q.decidedName
            ? { party: q.decidedParty, name: q.decidedName, note: q.decisionNote, at: q.decidedAt.toISOString() }
            : null,
        pdfPath: `/api/orcamentos/${q.id}/pdf`,
      };
    }),
};

export const bookmarks = {
  list: api.bookmarks.list
    // foldersFor and bookmarksFor keep each person to their companies and to the folders shared with them.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const scope = scopeOf(context.actor);
      const query = bookmarkQuery({ pasta: input.folder, q: input.search }, scope);
      const folders = await foldersFor(scope, query.company);
      const { items } = await bookmarksFor(
        scope,
        folders.map((f) => f.id),
        query,
        { page: 1, pageSize: 100 },
      );
      return {
        folders: folders.map((f) => ({ id: f.id, name: f.name, company: f.company, count: f.count })),
        items: items.map((item) => {
          const kind = item.board ? ("board" as const) : item.url ? ("link" as const) : ("file" as const);
          return {
            id: item.id,
            title: item.title,
            kind,
            url: item.url,
            fileName: item.fileName,
            filePath:
              kind === "file" ? `/api/bookmarks/${item.id}` : kind === "board" && item.preview ? `/api/bookmarks/${item.id}/preview` : null,
            folderId: item.folderId,
          };
        }),
      };
    }),
};
