import { and, count, desc, eq, inArray, isNotNull, or, sum } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  accountEmails,
  auditEvents,
  companies,
  contracts,
  quotes,
  engagements,
  invoices,
  memberships,
  tickets,
  user,
} from "@/db/schema";
import { requireAdmin } from "@/lib/access/access";
import { companyLinks } from "@/lib/record-links";
import { OPEN_TICKET_STATUSES } from "@/lib/tickets/ticket-status";
import { saoPauloDate } from "@/lib/dates";
import { CompanyDetail } from "@/components/empresas/company-detail";
import { ServiceTermsCard } from "@/components/empresas/service-terms-card";
import { HoursBankCard } from "@/components/service-terms/hours-bank-card";
import { bankCard, previousMonth } from "@/lib/service-terms/hours-bank";
import { overageCharge } from "@/lib/service-terms/hours-delivery";
import { automationEvents, serviceTerms } from "@/db/schema";
export const metadata = {
  title: "Detalhes da empresa",
  description: "Cadastro, contatos e acessos de uma empresa.",
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
    [quoteRow],
    [engagementRow],
    links,
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
      .from(quotes)
      .where(eq(quotes.companyId, id)),
    db
      .select({ n: count() })
      .from(engagements)
      .where(eq(engagements.companyId, id)),
    // "Excluir" shows only without invoices, recurrences, contracts or proposals.
    companyLinks([id]),
  ]);
  // One row per person even when an older verified e-mail also matched.
  const seen = new Set<string>();
  const members = people.filter((m) => {
    const key = m.email;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // What the company's contracts promise, kept by the team (Condições de atendimento).
  const [termRows, termEngagements, termContracts] = await Promise.all([
    db.select().from(serviceTerms).where(and(eq(serviceTerms.companyId, id), eq(serviceTerms.active, true))).orderBy(desc(serviceTerms.updatedAt)),
    db.select({ id: engagements.id, name: engagements.name }).from(engagements).where(eq(engagements.companyId, id)).orderBy(engagements.name),
    db
      .select({ id: contracts.id, title: contracts.title })
      .from(contracts)
      .where(and(eq(contracts.companyId, id), inArray(contracts.status, ["signed", "sent", "in_review"])))
      .orderBy(desc(contracts.updatedAt)),
  ]);
  const bank = await bankCard(id, company.name);
  // Last month's hours beyond the bank, once the client's window to contest closed: ready to bill, once.
  const overageMonth = bank ? previousMonth(bank.month) : null;
  const overage = overageMonth ? await overageCharge(id, overageMonth) : null;
  const overagePrepared = overage
    ? !!(await db
        .select({ id: automationEvents.id })
        .from(automationEvents)
        .where(and(eq(automationEvents.kind, "hours.overage_billed"), eq(automationEvents.entityId, `${id}:${overageMonth}`)))
        .then((r) => r.length))
    : false;
  const termsCard = (
    <>
    <ServiceTermsCard
      companyId={id}
      items={termRows.map((t) => ({
        id: t.id,
        label: t.label,
        basis: t.basis,
        preset: t.preset,
        engagementId: t.engagementId,
        contractId: t.contractId,
        policy: t.policy,
        personClient: t.personClient,
        publishAt: t.publishAt?.toISOString() ?? null,
        verifiedAt: t.verifiedAt?.toISOString() ?? null,
        verifiedBy: t.verifiedBy,
        version: t.version,
      }))}
      engagements={termEngagements}
      contracts={termContracts}
      now={new Date().toISOString()}
    />
    {bank && (
      <HoursBankCard
        viewer="team"
        bank={bank}
        overage={overage && !overagePrepared ? { ...overage, href: `/financeiro/nova?excedente=${id}&mes=${overageMonth}` } : null}
      />
    )}
    </>
  );
  return (
    <CompanyDetail
      termsCard={termsCard}
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
          quotes: quoteRow?.n ?? 0,
          engagements: engagementRow?.n ?? 0,
        },
        // Lists that filter by company get a deep link; the rest arrives per subject.
        links: {
          tickets: `/chamados?company=${id}`,
          invoices: `/financeiro?company=${id}`,
          contracts: `/contratos?company=${id}`,
          quotes: `/orcamentos?company=${id}`,
          engagements: `/projetos?company=${id}`,
        },
        deleteLinks: links.get(id),
      }}
    />
  );
}
