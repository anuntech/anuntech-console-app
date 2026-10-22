import "server-only";
import { eq } from "drizzle-orm";
import { contractChangeRequests, contracts as contractTable, engagements, quotes as quoteTable, tasks as taskTable } from "@/db/schema";
import { db } from "../../db";
import { answersForClient, canSeeEngagement } from "../../access/access";
import { decisionEvidence, partyFor } from "../../access/client-decision";
import { saoPauloDate } from "../../dates";
import { engagementLabels } from "../../format";
import { projectListQuery } from "../../projects/project-table";
import { listProjects } from "../../projects/project-list";
import { findEngagement, projectTasks } from "../../projects/project-view";
import { TASK_STATUSES, taskPriorityLabels, taskStatusLabels } from "../../projects/task-model";
import { reviewTaskAs } from "../../projects/task-review";
import { contractKindLabels, contractQuery, contractStatusLabels, contractTerm, contractTermLabel } from "../../contracts/contract-table";
import { listContracts } from "../../contracts/contract-list";
import { findContract } from "../../contracts/contract-access";
import { signContractAs } from "../../contracts/contract-sign";
import { contractRecord } from "../../contracts/contract-view";
import { changeRequestStatusLabels, reviewBlocks, reviewRounds } from "../../contracts/contract-review-view";
import { deleteChangeRequestAs, saveChangeRequestAs, submitChangeRequestsAs } from "../../contracts/contract-review";
import { quoteTableQuery } from "../../quotes/quote-table";
import { listQuotes } from "../../quotes/quote-list";
import { findQuote, quoteVersionList } from "../../quotes/quote-access";
import {
  discountShareLabel,
  quoteExpired,
  quoteNumberLabel,
  quoteStatusLabels,
  quoteTotals,
  quoteValidity,
  quoteValidityLabel,
} from "../../quotes/quote-model";
import { answerQuoteAs } from "../../quotes/quote-answer";
import { bookmarkQuery, bookmarksFor, foldersFor, scopeOf } from "../../bookmarks/bookmarks";
import { api } from "../server";
import { guard, missing } from "../access";
import { answer, refuse } from "../managed-company";

const label = (labels: Record<string, string>, value: string) => labels[value] ?? value;
const pageParams = (page: number) => ({ page: String(page) });
/** "Válido por 12 dias" while a proposal waits (the web's validityText); null otherwise. */
const validityLabel = (status: string, validUntil: string | null, today: string) => {
  if (status !== "sent") return null;
  const validity = quoteValidity(validUntil, today);
  return validity.state === "open" ? quoteValidityLabel(validity) : null;
};
/** The company of a record the input names, for the guard; unknown ids reach no one. */
const companyOf =
  (table: typeof engagements | typeof contractTable | typeof quoteTable) =>
  async ({ id }: { id: string }) =>
    (await db.select({ companyId: table.companyId }).from(table).where(eq(table.id, id)))[0]?.companyId;
/** The project a task sits on; its company is what the guard checks. */
const taskProject = async ({ id }: { id: string }) =>
  (
    await db
      .select({ id: engagements.id, companyId: engagements.companyId })
      .from(taskTable)
      .innerJoin(engagements, eq(engagements.id, taskTable.engagementId))
      .where(eq(taskTable.id, id))
  )[0];

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
        // Approving a delivery is the client's decision: its Administradores, never the team.
        canReview: answersForClient(context.actor, row.project.companyId),
      };
    }),
  reviewTask: api.projects.reviewTask
    .use(guard({ area: "overview", company: async (input: { id: string }) => (await taskProject(input))?.companyId }))
    .handler(async ({ input, context }) => {
      // A Membro with a selection reaches only the projects chosen for them, as on the web's board.
      const project = await taskProject(input);
      if (!project || !canSeeEngagement(context.actor, project)) throw missing();
      return answer(await reviewTaskAs(context.actor, input));
    }),
};

/** A signed contract against its dates, as the web's badges say it; quiet before it is signed. */
const termOf = (status: string, dates: { startsAt: string | null; endsAt: string | null }, today: string) => {
  if (status !== "signed") return null;
  const term = contractTerm(dates, today);
  return { state: term.state, label: contractTermLabel(term) };
};
/** The company of a change request's contract, for the guard. */
const requestCompany = async ({ id }: { id: string }) =>
  (
    await db
      .select({ contractId: contractChangeRequests.contractId, companyId: contractTable.companyId })
      .from(contractChangeRequests)
      .innerJoin(contractTable, eq(contractTable.id, contractChangeRequests.contractId))
      .where(eq(contractChangeRequests.id, id))
  )[0];

export const contracts = {
  list: api.contracts.list
    // listContracts keeps a client to their finance companies and what went out; a Membro sees none.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const result = await listContracts(
        context.actor,
        contractQuery({ ...pageParams(input.page), status: input.status, q: input.search }),
      );
      return {
        rows: result.list.map((row) => ({
          id: row.id,
          title: row.title,
          company: row.company,
          status: row.status,
          statusLabel: label(contractStatusLabels, row.status),
          kind: row.kind,
          kindLabel: label(contractKindLabels, row.kind),
          parentTitle: row.parentTitle,
          signedBy: row.signedBy,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          term: termOf(row.status, row, result.today),
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
      const party = partyFor(context.actor, c.companyId);
      // What the client sees is the text frozen when it was sent.
      const text = c.publication ?? { title: c.title, body: c.body };
      const record = await contractRecord(context.actor, c);
      const signatures = record.signatures.filter((s) => s.documentHash === (c.documentHash ?? ""));
      // Same as the web's contract page: the client's side, a version waiting for signatures it has not given.
      const canRequest = c.status === "sent" && party === "client" && !signatures.some((s) => s.party === "client");
      const rounds = reviewRounds(
        record.requests.map((r) => ({ ...r, statusLabel: label(changeRequestStatusLabels, r.status) })),
        c.publishedVersion,
      );
      const pdfPath = `/api/contratos/${c.id}/pdf`;
      // The team reads the draft it is editing on the web; here, what was sent.
      const shown = c.status === "draft" ? null : record.previousBody;
      return {
        id: c.id,
        title: text.title,
        company: row.company.name,
        engagement: row.engagement,
        status: c.status,
        statusLabel: label(contractStatusLabels, c.status),
        kind: c.kind,
        kindLabel: label(contractKindLabels, c.kind),
        updatedAt: c.updatedAt.toISOString(),
        body: text.body,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        term: termOf(c.status, c, saoPauloDate()),
        signatures: signatures.map((s) => ({ party: s.party, name: s.name, signedAt: s.signedAt.toISOString() })),
        pdfPath,
        documentHash: c.status === "draft" ? null : c.documentHash,
        version: c.status === "draft" ? null : c.publishedVersion,
        sentAt: c.status === "draft" ? null : (c.publishedAt?.toISOString() ?? null),
        template: row.template,
        companyDocument: row.company.document || null,
        party,
        // Same as the web's Assinaturas card: the version waits for signatures and this side has not signed it.
        canSign: c.status === "sent" && party !== null && !signatures.some((s) => s.party === party),
        blocks: reviewBlocks(text.body, shown),
        previousVersion: shown ? c.publishedVersion - 1 : null,
        review: { canRequest, requests: rounds.current, drafts: rounds.drafts, history: rounds.history },
        versions: record.versions.map((v) => ({
          version: v.version,
          sentAt: v.sentAt,
          current: v.current,
          signedBy: v.signedBy,
          pdfPath: v.current ? pdfPath : `${pdfPath}?versao=${v.version}`,
        })),
        parent: record.parent
          ? { id: record.parent.id, title: record.parent.title, statusLabel: label(contractStatusLabels, record.parent.status) }
          : null,
        amendments: record.amendments.map((a) => ({
          id: a.id,
          title: a.title,
          status: a.status,
          statusLabel: label(contractStatusLabels, a.status),
          signedAt: a.signedAt,
          endsAt: a.endsAt,
        })),
      };
    }),
  sign: api.contracts.sign
    .use(guard({ area: "finance", company: companyOf(contractTable) }))
    .handler(async ({ input, context }) => {
      // What the client cannot open (a draft, a cancellation) cannot be signed either: 404, as in contracts.get.
      if (!(await findContract(context.actor, input.id))) throw missing();
      const result = await signContractAs(
        context.actor,
        { id: input.id, consent: input.consent },
        decisionEvidence(context.headers, context.session),
      );
      if ("error" in result) throw refuse(result.error);
      return { message: result.success, signed: result.signed };
    }),
  saveRequest: api.contracts.saveRequest
    .use(guard({ area: "finance", company: async (input: { contractId: string }) => companyOf(contractTable)({ id: input.contractId }) }))
    .handler(async ({ input, context }) => {
      // A contract the client cannot open (a draft, a cancellation) answers 404, as in contracts.get.
      if (!(await findContract(context.actor, input.contractId))) throw missing();
      return answer(await saveChangeRequestAs(context.actor, { ...input, requestId: input.requestId ?? "" }));
    }),
  discardRequest: api.contracts.discardRequest
    .use(guard({ area: "finance", company: async (input: { id: string }) => (await requestCompany(input))?.companyId }))
    .handler(async ({ input, context }) => {
      const request = await requestCompany(input);
      if (!request || !(await findContract(context.actor, request.contractId))) throw missing();
      return answer(await deleteChangeRequestAs(context.actor, input));
    }),
  submitRequests: api.contracts.submitRequests
    .use(guard({ area: "finance", company: async (input: { contractId: string }) => companyOf(contractTable)({ id: input.contractId }) }))
    .handler(async ({ input, context }) => {
      if (!(await findContract(context.actor, input.contractId))) throw missing();
      return answer(await submitChangeRequestsAs(context.actor, input));
    }),
};

export const quotes = {
  list: api.quotes.list
    // listQuotes keeps a client to their finance companies and what went out; a Membro sees none.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const result = await listQuotes(
        context.actor,
        quoteTableQuery({ ...pageParams(input.page), status: input.status, q: input.search }),
      );
      return {
        rows: result.list.map((row) => {
          const expired = quoteExpired(row.status, row.validUntil, result.today);
          return {
            id: row.id,
            number: row.number,
            title: row.title,
            company: row.company,
            status: row.status,
            // A proposal waiting past its date reads as expired, as the web's badge.
            statusLabel: expired ? "Expirado" : label(quoteStatusLabels, row.status),
            totalCents: row.totalCents,
            validUntil: row.validUntil,
            hoursMin: row.hoursMin,
            hoursMax: row.hoursMax,
            expired,
            validityLabel: validityLabel(row.status, row.validUntil, result.today),
            updatedAt: row.updatedAt,
          };
        }),
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
      const content = frozen ?? q.content;
      const totals = quoteTotals(content);
      const validUntil = frozen ? frozen.validUntil : q.validUntil;
      const today = saoPauloDate();
      const expired = quoteExpired(q.status, validUntil, today);
      const pdfPath = `/api/orcamentos/${q.id}/pdf`;
      const versions = await quoteVersionList(q);
      return {
        id: q.id,
        number: frozen?.number ?? quoteNumberLabel(q.year, q.seq),
        title: frozen?.title ?? q.title,
        company: frozen?.companyName ?? row.company.name,
        status: q.status,
        statusLabel: label(quoteStatusLabels, q.status),
        updatedAt: q.updatedAt.toISOString(),
        validUntil,
        validityLabel: validityLabel(q.status, validUntil, today),
        totalCents: totals.totalCents,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        discountShare: discountShareLabel(totals),
        upfrontCents: totals.upfrontCents,
        balanceCents: totals.balanceCents,
        hourlyRateCents: content.hourlyRateCents,
        hoursMin: totals.hoursMin,
        hoursMax: totals.hoursMax,
        stack: content.stack,
        decision:
          q.decidedAt && q.decidedParty && q.decidedName
            ? {
                party: q.decidedParty,
                name: q.decidedName,
                note: q.decisionNote,
                at: q.decidedAt.toISOString(),
                // The web shows who answered and from where only for the client's own answer.
                email: q.decidedParty === "client" ? q.decidedEmail : null,
                ip: q.decidedParty === "client" ? q.decidedIp : null,
              }
            : null,
        pdfPath,
        summary: content.summary,
        phases: content.phases.map((phase) => ({
          name: phase.name,
          description: phase.description,
          hoursMin: phase.hoursMin,
          hoursMax: phase.hoursMax,
          weeks: phase.weeks ?? null,
          tasks: phase.tasks.map((task) => ({ title: task.title, description: task.description })),
        })),
        notes: content.notes,
        upfrontPercent: content.upfrontPercent,
        documentHash: q.status === "draft" ? null : q.documentHash,
        version: q.status === "draft" ? null : q.publishedVersion,
        sentAt: q.status === "draft" ? null : (q.publishedAt?.toISOString() ?? null),
        expired,
        // Same as the web: sent, still valid, and the viewer answers for the company.
        canAnswer: q.status === "sent" && !expired && partyFor(context.actor, q.companyId) === "client",
        versions: versions.map((v) => ({
          version: v.version,
          sentAt: v.sentAt,
          current: v.current,
          pdfPath: v.current ? pdfPath : `${pdfPath}?versao=${v.version}`,
        })),
      };
    }),
  answer: api.quotes.answer
    .use(guard({ area: "finance", company: companyOf(quoteTable) }))
    .handler(async ({ input, context }) => {
      // What the client cannot open (a draft, a cancellation) cannot be answered either: 404, as in quotes.get.
      if (!(await findQuote(context.actor, input.id))) throw missing();
      const evidence = decisionEvidence(context.headers, context.session);
      return answer(await answerQuoteAs(context.actor, input, evidence));
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
