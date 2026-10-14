import type { Metadata } from "next";
import Link from "next/link";
import { dueLabel } from "@/lib/format";
import { visibleToClient } from "@/lib/service-terms/ticket-clock";
import { PlusIcon } from "lucide-react";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { companies, engagements, tickets, user } from "@/db/schema";
import { getActor, allowedIds, ticketWhere } from "@/lib/access/access";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { TicketsTable } from "@/components/chamados/tickets-table";
import { clampPage, offsetOf, pageCountOf } from "@/lib/list-query";
import { ticketFilterStatuses, ticketQuery } from "@/lib/tickets/ticket-table";
export const metadata: Metadata = {
  title: "Chamados",
  description:
    "Os chamados e as conversas com a equipe da Anuntech.",
};

// `assignedTo` holds an e-mail; the list shows the name of the user who has it.
const assignee = alias(user, "assignee");

/** The one deadline a row shows: the first response while pending, else the goal; paused while waiting. */
function listDue(
  t: {
    status: string;
    terms: (typeof tickets.$inferSelect)["terms"];
    waitingSince: Date | null;
    firstResponseAt: Date | null;
    responseDueAt: Date | null;
    resolutionDueAt: Date | null;
  },
  admin: boolean,
  now: Date,
) {
  if (!t.terms || t.status === "resolved" || t.status === "closed") return null;
  if (!admin && !visibleToClient(t.terms, now)) return null;
  if (t.status === "waiting_customer" && t.terms.policy.pausesWhileWaiting) return { label: "Prazo pausado", late: false };
  const [what, at] = !t.firstResponseAt && t.responseDueAt ? ["Resposta", t.responseDueAt] : ["Meta", t.resolutionDueAt];
  if (!at) return null;
  return { label: `${what} até ${dueLabel(at, now)}`, late: admin && at < now };
}

export default async function Tickets({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const now = new Date();
  const ids = allowedIds(actor, "support");
  const query = ticketQuery(await searchParams);
  // Clients can only narrow within their own companies.
  if (!actor.admin && query.company && !ids.includes(query.company))
    query.company = "";
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const statuses = ticketFilterStatuses(query.status);
  const where =
    and(
      // The company's support area; a Membro with a selection skips requests about products left out (except their own).
      ticketWhere(actor, { company: tickets.companyId, engagement: tickets.engagementId, author: tickets.authorId }),
      statuses ? inArray(tickets.status, statuses) : undefined,
      query.company ? eq(tickets.companyId, query.company) : undefined,
      search
        ? or(
            ilike(tickets.subject, `%${search}%`),
            ilike(companies.name, `%${search}%`),
          )
        : undefined,
    ) ?? sql`true`;
  const [{ total }] = await db
    .select({ total: count() })
    .from(tickets)
    .innerJoin(companies, eq(companies.id, tickets.companyId))
    .where(where);
  const pageCount = pageCountOf(total, query.pageSize);
  const { page } = clampPage(query, total);
  const [list, companyFilter] = await Promise.all([
    db
      .select({
        id: tickets.id,
        subject: tickets.subject,
        status: tickets.status,
        priority: tickets.priority,
        companyId: tickets.companyId,
        company: companies.name,
        engagement: engagements.name,
        // Accounts created by e-mail code may have no name yet; the e-mail still says who wrote it.
        author: sql<string>`coalesce(nullif(${user.name}, ''), ${user.email})`,
        assignedTo: tickets.assignedTo,
        assignee: assignee.name,
        updatedAt: tickets.updatedAt,
        kind: tickets.kind,
        terms: tickets.terms,
        waitingSince: tickets.waitingSince,
        firstResponseAt: tickets.firstResponseAt,
        responseDueAt: tickets.responseDueAt,
        resolutionDueAt: tickets.resolutionDueAt,
      })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .innerJoin(user, eq(user.id, tickets.authorId))
      .leftJoin(engagements, eq(engagements.id, tickets.engagementId))
      // e-mail is unique, so this adds at most one row per ticket.
      .leftJoin(assignee, eq(assignee.email, tickets.assignedTo))
      .where(where)
      // The team works the nearest unanswered deadline first; then the latest activity.
      // The id breaks ties, so a row never shows on two pages or on none.
      .orderBy(
        ...(actor.admin
          ? [
              sql`case when ${tickets.firstResponseAt} is null and ${tickets.responseDueAt} is not null and ${tickets.status} in ('open', 'in_progress') then 0 else 1 end`,
              sql`case when ${tickets.firstResponseAt} is null and ${tickets.status} in ('open', 'in_progress') then ${tickets.responseDueAt} end asc nulls last`,
            ]
          : []),
        desc(tickets.updatedAt),
        desc(tickets.id),
      )
      .limit(query.pageSize)
      .offset(offsetOf({ ...query, page })),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((rows) => rows[0] ?? null)
      : null,
  ]);
  const canCreate = actor.admin || ids.length > 0;
  return (
    <>
      <PageHeader
        className="mb-4"
        title="Chamados"
        count={total}
      />
      <TicketsTable
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/chamados/novo">
                <PlusIcon />
                Abrir chamado
              </Link>
            </Button>
          )
        }
        rows={list.map(({ assignee, terms, waitingSince, firstResponseAt, responseDueAt, resolutionDueAt, ...row }) => ({
          ...row,
          // Only staff see the "Responsável" column; clients never see a team e-mail.
          assignee: actor.admin ? assignee : null,
          assignedTo: actor.admin ? row.assignedTo : null,
          updatedAt: row.updatedAt.toISOString(),
          due: listDue({ status: row.status, terms, waitingSince, firstResponseAt, responseDueAt, resolutionDueAt }, actor.admin, now),
        }))}
        query={{ ...query, page }}
        total={total}
        pageCount={pageCount}
        now={now.toISOString()}
        admin={actor.admin}
        showCompany={actor.admin || ids.length > 1}
        canCreate={canCreate}
        companyFilter={companyFilter}
      />
    </>
  );
}
