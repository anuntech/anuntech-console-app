import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { ZodError } from "zod";
import { logDatabaseFault } from "../../action-errors";
import { engagements, tickets as ticketTable } from "@/db/schema";
import { db } from "../../db";
import { accessibleCompanies, allowedIds, canAccess, engagementWhere, type Actor } from "../../access/access";
import { companyDisplayName } from "../../companies/display-name";
import { clientTicketLabels, dateTimeLabel, dueLabel, priorityLabels, ticketLabels } from "../../format";
import {
  ticketDescriptionHints,
  ticketImpactLabels,
  ticketImpacts,
  ticketKindHints,
  ticketKindLabels,
  ticketKindShort,
  ticketKinds,
} from "../../tickets/ticket-intake";
import { ticketClockView } from "../../tickets/ticket-clock-view";
import { ticketPreview } from "../../tickets/ticket-preview";
import { decideEstimateAs } from "../../service-terms/estimate-decision";
import { listTickets } from "../../tickets/ticket-list";
import { loadTicketThread } from "../../tickets/ticket-thread";
import { replyToTicket } from "../../tickets/ticket-reply";
import { openTicket, ticketInput } from "../../tickets/ticket-create";
import { api } from "../server";
import { guard, missing } from "../access";
import { companyOptions } from "../company-options";

const statusLabel = (actor: Actor, status: string) =>
  (actor.admin ? ticketLabels : clientTicketLabels)[status] ?? status;
/** The company of the ticket the input names, for the guard; unknown ids reach no one. */
const ticketCompany = async ({ id }: { id: string }) =>
  (await db.select({ companyId: ticketTable.companyId }).from(ticketTable).where(eq(ticketTable.id, id)))[0]?.companyId;
const refuse = (message: string) => new ORPCError("BAD_REQUEST", { message });
/** Hours as the web's estimate card writes them: "1,5 h". */
const hoursAmount = (minutes: number) => `${String(Math.round((minutes / 60) * 10) / 10).replace(".", ",")} h`;

/** A list row as the app gets it (tickets.list and overview.get). */
export function ticketRow(actor: Actor, row: Awaited<ReturnType<typeof listTickets>>["rows"][number]) {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    statusLabel: statusLabel(actor, row.status),
    priority: row.priority,
    kindLabel: row.kind ? ticketKindShort[row.kind] : null,
    // The name people read, as the web's list; the search still looks in the razão social.
    company: companyDisplayName(row.company, row.companyDocument),
    engagement: row.engagement,
    author: row.author,
    assignee: row.assignee,
    updatedAt: row.updatedAt,
    due: row.due,
  };
}

export const tickets = {
  list: api.tickets.list
    // Each row is filtered by ticketWhere inside listTickets; a person without support sees none.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const list = await listTickets(actor, {
        status: input.status,
        search: input.search.trim(),
        // listTickets drops a company the person does not reach, as /chamados?company= on the web.
        company: input.company,
        page: input.page,
        pageSize: 25,
      });
      return {
        rows: list.rows.map((row) => ticketRow(actor, row)),
        total: list.total,
        page: list.query.page,
        pageCount: list.pageCount,
        canCreate: list.canCreate,
        showCompany: list.showCompany,
        companies: companyOptions(actor, allowedIds(actor, "support")),
        companyFilter: list.companyFilter
          ? { id: list.companyFilter.id, name: companyDisplayName(list.companyFilter.name, list.companyFilter.document) }
          : null,
      };
    }),
  get: api.tickets.get
    .use(guard({ area: "support", company: ticketCompany }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const thread = await loadTicketThread(actor, input.id);
      if (!thread) throw missing();
      const t = thread.ticket;
      const row = thread.row;
      const now = new Date();
      // The same card as /chamados/[id]: Prazos, in words (the team's "Atrasado" stays on the web).
      const clock = await ticketClockView(actor, row, now);
      const done = t.status === "resolved" || t.status === "closed";
      // The client's estimate card: shown once the team proposed one (components/chamados/ticket-hours.tsx).
      const estimate =
        row.estimateStatus && row.estimateMinutes
          ? {
              minutes: row.estimateMinutes,
              amount: hoursAmount(row.estimateMinutes),
              status: row.estimateStatus,
              canApprove: !actor.admin && canAccess(actor, t.companyId, "finance"),
            }
          : null;
      return {
        id: t.id,
        subject: t.subject,
        status: t.status,
        statusLabel: statusLabel(actor, t.status),
        priority: t.priority,
        priorityLabel: priorityLabels[t.priority] ?? t.priority,
        kindLabel: t.kind ? ticketKindLabels[t.kind] : null,
        impactLabel: t.impact ? ticketImpactLabels[t.impact] : null,
        companyId: t.companyId,
        company: companyDisplayName(t.company, t.companyDocument),
        // The web's ticket page: a client with one company is not told its own name.
        showCompany: actor.admin || new Set(allowedIds(actor, "support")).size > 1,
        engagement: t.engagement,
        author: t.author.name || t.author.email,
        // The e-mail only when it is one: a client reads "Equipe Anuntech" for the team.
        authorEmail: t.author.email.includes("@") ? t.author.email : null,
        assigneeName: actor.admin ? null : t.assigneeName,
        waitingFor: t.waitingFor,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        canReply: t.status !== "closed",
        clock: clock
          ? {
              label: clock.label,
              firstResponse: clock.firstResponseAt
                ? `Respondido em ${clock.respondedIn}`
                : clock.responseDueAt
                  ? `Até ${dueLabel(clock.responseDueAt, now)}`
                  : "Sem prazo",
              firstResponseAt: clock.firstResponseAt ? dateTimeLabel(clock.firstResponseAt) : null,
              resolution: clock.resolutionDueAt && !done ? `Até ${dueLabel(clock.resolutionDueAt, now)}` : null,
              paused: clock.pausedSince ? `Prazo pausado desde ${dateTimeLabel(clock.pausedSince)}.` : null,
            }
          : null,
        estimate,
        entries: thread.entries.map((entry) =>
          entry.kind === "message"
            ? {
                kind: "message" as const,
                id: entry.id,
                body: entry.body,
                createdAt: entry.createdAt,
                author: entry.author,
                authorImage: entry.authorImage,
                staff: entry.staff,
                mine: entry.authorId === actor.user.id,
              }
            : {
                kind: "file" as const,
                id: entry.file.id,
                name: entry.file.name,
                size: entry.file.size,
                mime: entry.file.mime,
                createdAt: entry.file.createdAt,
                author: entry.file.author,
                staff: entry.staff,
                href: `/api/anexos/${entry.file.id}`,
              },
        ),
      };
    }),
  reply: api.tickets.reply
    .use(guard({ area: "support", company: ticketCompany }))
    .handler(async ({ input, context }) => {
      const result = await replyToTicket(context.actor, { ticketId: input.id, body: input.body, uploadIds: input.uploadIds });
      if ("error" in result) throw refuse(result.error);
      return { ok: true as const, message: result.success };
    }),
  decideEstimate: api.tickets.decideEstimate
    // Whoever sees the ticket reaches the rule, which answers a Membro or the team with the web's words.
    .use(guard({ area: "support", company: ticketCompany }))
    .handler(async ({ input, context }) => {
      if (!(await loadTicketThread(context.actor, input.id))) throw missing();
      const result = await decideEstimateAs(context.actor, {
        ticketId: input.id,
        decision: input.decision,
        minutes: input.minutes,
      });
      if ("error" in result) throw refuse(result.error);
      return { message: result.success, status: input.decision === "approve" ? ("approved" as const) : ("declined" as const) };
    }),
  choices: api.tickets.choices
    .use(guard({ self: true }))
    .handler(async ({ context }) => {
      const { actor } = context;
      // Archived clients stay out of the picker, as on the web.
      const companies = (await accessibleCompanies(actor, "support"))
        .filter((c) => !c.archived)
        .map((c) => ({ id: c.id, name: companyDisplayName(c.name, c.document) }));
      const ids = [...new Set(companies.map((c) => c.id))];
      const running = ids.length
        ? await db
            .select({ id: engagements.id, name: engagements.name, companyId: engagements.companyId })
            .from(engagements)
            .where(
              and(
                inArray(engagements.companyId, ids),
                eq(engagements.status, "active"),
                // A Membro with a selection picks only among the products chosen for them.
                engagementWhere(actor, engagements.id, engagements.companyId, "support"),
              ),
            )
            .orderBy(asc(engagements.name))
        : [];
      return {
        companies: [...new Map(companies.map((c) => [c.id, c])).values()],
        engagements: running,
        kinds: ticketKinds.map((value) => ({
          value,
          label: ticketKindLabels[value],
          hint: ticketKindHints[value],
          placeholder: ticketDescriptionHints[value],
        })),
        impacts: ticketImpacts.map((value) => ({ value, label: ticketImpactLabels[value] })),
      };
    }),
  preview: api.tickets.preview
    .use(guard({ area: "support", company: (input) => input.companyId }))
    .handler(({ input, context }) =>
      ticketPreview(context.actor, {
        companyId: input.companyId,
        engagementId: input.engagementId,
        kind: input.kind,
        impact: input.impact,
      }),
    ),
  create: api.tickets.create
    .use(guard({ area: "support", company: (input) => input.companyId }))
    .handler(async ({ input, context }) => {
      // The guard already checked the company; the same schema the web form uses.
      if (!canAccess(context.actor, input.companyId, "support")) throw missing();
      try {
        const { uploadIds, ...fields } = input;
        const ticket = await openTicket(context.actor, ticketInput.parse({ ...fields, channel: "console" }), { uploadIds });
        return { id: ticket.id };
      } catch (error) {
        // The attachments' own refusals ("Os anexos expiraram…") say what to do; anything else stays generic.
        const words =
          error instanceof Error && !(error instanceof ZodError) && error.message && !logDatabaseFault("api tickets", error)
            ? error.message
            : "Não foi possível abrir o chamado. Confira os dados e tente novamente.";
        throw refuse(words);
      }
    }),
};
