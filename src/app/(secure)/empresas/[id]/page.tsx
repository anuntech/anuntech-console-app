import { and, count, desc, eq, inArray, isNotNull, or, sum } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  accountEmails,
  auditEvents,
  companies,
  contracts,
  engagements,
  invoices,
  memberships,
  tickets,
  user,
} from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { OPEN_TICKET_STATUSES } from "@/lib/ticket-status";
import { saoPauloDate } from "@/lib/dates";
import { CompanyDetail } from "@/components/empresas/company-detail";
export const metadata = {
  title: "Detalhes da empresa",
  description: "Consulte os dados da empresa, contatos e permissões de acesso.",
};
export default async function Company({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id));
  if (!company) notFound();
  const [
    people,
    events,
    [ticketRow],
    [invoiceRow],
    [contractRow],
    [engagementRow],
  ] = await Promise.all([
    db
      .select({
        id: memberships.id,
        email: memberships.email,
        role: memberships.role,
        name: user.name,
        verified: user.emailVerified,
      })
      .from(memberships)
      .leftJoin(
        accountEmails,
        and(
          eq(accountEmails.email, memberships.email),
          isNotNull(accountEmails.verifiedAt),
        ),
      )
      .leftJoin(
        user,
        or(
          eq(user.email, memberships.email),
          eq(user.id, accountEmails.userId),
        ),
      )
      .where(and(eq(memberships.companyId, id), eq(memberships.active, true)))
      .orderBy(memberships.email),
    db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(eq(auditEvents.companyId, id))
      .orderBy(desc(auditEvents.createdAt))
      .limit(12),
    db
      .select({ n: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.companyId, id),
          inArray(tickets.status, OPEN_TICKET_STATUSES),
        ),
      ),
    db
      .select({ n: count(), cents: sum(invoices.amountCents) })
      .from(invoices)
      .where(and(eq(invoices.companyId, id), eq(invoices.status, "issued"))),
    db
      .select({ n: count() })
      .from(contracts)
      .where(eq(contracts.companyId, id)),
    db
      .select({ n: count() })
      .from(engagements)
      .where(eq(engagements.companyId, id)),
  ]);
  // One row per person even when an older verified e-mail also matched.
  const seen = new Set<string>();
  const members = people.filter((m) => {
    const key = m.email;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <CompanyDetail
      editorOpen={typeof query.editar === "string"}
      data={{
        company: {
          id: company.id,
          name: company.name,
          document: company.document,
          billingEmail: company.billingEmail,
          phone: company.phone,
          billingAddress: company.billingAddress,
          autoIssueNfse: company.autoIssueNfse,
          archived: company.archived,
          createdAt: saoPauloDate(company.createdAt),
        },
        members: members.map((m) => ({
          id: m.id,
          email: m.email,
          name: m.name ?? null,
          role: m.role,
          verified: m.verified === true,
        })),
        events: events.map((e) => ({
          id: e.id,
          action: e.action,
          createdAt: saoPauloDate(e.createdAt),
        })),
        relations: {
          openTickets: ticketRow?.n ?? 0,
          openInvoices: invoiceRow?.n ?? 0,
          openInvoicesCents: Number(invoiceRow?.cents ?? 0),
          contracts: contractRow?.n ?? 0,
          engagements: engagementRow?.n ?? 0,
        },
        // Lists that filter by company get a deep link; the rest arrives per subject.
        links: {
          tickets: `/chamados?company=${id}`,
          invoices: `/financeiro?company=${id}`,
          contracts: "/contratos",
          engagements: `/produtos?company=${id}`,
        },
      }}
    />
  );
}
