import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { companies, engagements, tickets, user } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { TicketsTable } from "@/components/chamados/tickets-table";
import { clampPage, offsetOf, pageCountOf } from "@/lib/list-query";
import { ticketFilterStatuses, ticketQuery } from "@/lib/ticket-table";
export const metadata: Metadata = {
  title: "Chamados",
  description:
    "Os chamados e as conversas com a equipe da Anuntech.",
};

// `assignedTo` holds an e-mail; the list shows the name of the user who has it.
const assignee = alias(user, "assignee");

export default async function Tickets({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const ids = allowedIds(actor, "support");
  const query = ticketQuery(await searchParams);
  // Clients can only narrow within their own companies.
  if (!actor.admin && query.company && !ids.includes(query.company))
    query.company = "";
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const statuses = ticketFilterStatuses(query.status);
  const where =
    and(
      actor.admin
        ? undefined
        : ids.length
          ? inArray(tickets.companyId, ids)
          : sql`false`,
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
      })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .innerJoin(user, eq(user.id, tickets.authorId))
      .leftJoin(engagements, eq(engagements.id, tickets.engagementId))
      // e-mail is unique, so this adds at most one row per ticket.
      .leftJoin(assignee, eq(assignee.email, tickets.assignedTo))
      .where(where)
      // The id breaks ties, so a row never shows on two pages or on none.
      .orderBy(desc(tickets.updatedAt), desc(tickets.id))
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
        title="Chamados"
        count={total}
        description={
          actor.admin
            ? "Solicitações dos clientes e o andamento de cada conversa."
            : "Suas solicitações e as conversas com a equipe."
        }
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
      />
      <TicketsTable
        rows={list.map(({ assignee, ...row }) => ({
          ...row,
          // Only staff see the "Responsável" column.
          assignee: actor.admin ? assignee : null,
          updatedAt: row.updatedAt.toISOString(),
        }))}
        query={{ ...query, page }}
        total={total}
        pageCount={pageCount}
        now={new Date().toISOString()}
        admin={actor.admin}
        showCompany={actor.admin || ids.length > 1}
        canCreate={canCreate}
        companyFilter={companyFilter}
      />
    </>
  );
}
