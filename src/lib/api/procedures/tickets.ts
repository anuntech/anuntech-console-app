import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { engagements, tickets as ticketTable } from "@/db/schema";
import { db } from "../../db";
import { accessibleCompanies, canAccess, engagementWhere, type Actor } from "../../access/access";
import { clientTicketLabels, ticketLabels } from "../../format";
import { ticketImpactLabels, ticketImpacts, ticketKindHints, ticketKindLabels, ticketKindShort, ticketKinds } from "../../tickets/ticket-intake";
import { listTickets } from "../../tickets/ticket-list";
import { loadTicketThread } from "../../tickets/ticket-thread";
import { replyToTicket } from "../../tickets/ticket-reply";
import { openTicket, ticketInput } from "../../tickets/ticket-create";
import { api } from "../server";
import { guard, missing } from "../access";

const statusLabel = (actor: Actor, status: string) =>
  (actor.admin ? ticketLabels : clientTicketLabels)[status] ?? status;
/** The company of the ticket the input names, for the guard; unknown ids reach no one. */
const ticketCompany = async ({ id }: { id: string }) =>
  (await db.select({ companyId: ticketTable.companyId }).from(ticketTable).where(eq(ticketTable.id, id)))[0]?.companyId;
const refuse = (message: string) => new ORPCError("BAD_REQUEST", { message });

/** A list row as the app gets it (tickets.list and overview.get). */
export function ticketRow(actor: Actor, row: Awaited<ReturnType<typeof listTickets>>["rows"][number]) {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    statusLabel: statusLabel(actor, row.status),
    kindLabel: row.kind ? ticketKindShort[row.kind] : null,
    company: row.company,
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
        company: "",
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
      };
    }),
  get: api.tickets.get
    .use(guard({ area: "support", company: ticketCompany }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const thread = await loadTicketThread(actor, input.id);
      if (!thread) throw missing();
      const t = thread.ticket;
      return {
        id: t.id,
        subject: t.subject,
        status: t.status,
        statusLabel: statusLabel(actor, t.status),
        kindLabel: t.kind ? ticketKindLabels[t.kind] : null,
        company: t.company,
        engagement: t.engagement,
        author: t.author.name || t.author.email,
        assigneeName: actor.admin ? null : t.assigneeName,
        waitingFor: t.waitingFor,
        createdAt: t.createdAt,
        canReply: t.status !== "closed",
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
      const result = await replyToTicket(context.actor, { ticketId: input.id, body: input.body });
      if ("error" in result) throw refuse(result.error);
      return { ok: true as const, message: result.success };
    }),
  choices: api.tickets.choices
    .use(guard({ self: true }))
    .handler(async ({ context }) => {
      const { actor } = context;
      // Archived clients stay out of the picker, as on the web.
      const companies = (await accessibleCompanies(actor, "support"))
        .filter((c) => !c.archived)
        .map((c) => ({ id: c.id, name: c.name }));
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
        kinds: ticketKinds.map((value) => ({ value, label: ticketKindLabels[value], hint: ticketKindHints[value] })),
        impacts: ticketImpacts.map((value) => ({ value, label: ticketImpactLabels[value] })),
      };
    }),
  create: api.tickets.create
    .use(guard({ area: "support", company: (input) => input.companyId }))
    .handler(async ({ input, context }) => {
      // The guard already checked the company; the same schema the web form uses.
      if (!canAccess(context.actor, input.companyId, "support")) throw missing();
      try {
        const ticket = await openTicket(context.actor, ticketInput.parse({ ...input, channel: "console" }));
        return { id: ticket.id };
      } catch {
        throw refuse("Não foi possível abrir o chamado. Confira os dados e tente novamente.");
      }
    }),
};
