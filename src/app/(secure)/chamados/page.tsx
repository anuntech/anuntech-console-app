import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, engagements, tickets, user } from "@/db/schema";
import { getActor, allowedIds } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/console/page-header";
import { TicketsTable } from "@/components/chamados/tickets-table";
import { ticketFilterStatuses, ticketQuery } from "@/lib/ticket-table";
export const metadata: Metadata = {
  title: "Chamados",
  description:
    "Consulte as solicitações de atendimento e acompanhe as conversas com a equipe.",
};

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
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);
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
        author: user.name,
        assignedTo: tickets.assignedTo,
        updatedAt: tickets.updatedAt,
      })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .innerJoin(user, eq(user.id, tickets.authorId))
      .leftJoin(engagements, eq(engagements.id, tickets.engagementId))
      .where(where)
      .orderBy(desc(tickets.updatedAt))
      .limit(query.pageSize)
      .offset((page - 1) * query.pageSize),
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
        rows={list.map((row) => ({
          ...row,
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
