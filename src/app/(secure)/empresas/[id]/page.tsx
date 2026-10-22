import { and, count, desc, eq, gte, inArray, isNotNull, isNull, or, sql, sum } from "drizzle-orm";
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
  subscriptions,
} from "@/db/schema";
import { requireAdmin } from "@/lib/access/access";
import { companyLinks } from "@/lib/record-links";
import { OPEN_TICKET_STATUSES } from "@/lib/tickets/ticket-status";
import { saoPauloDate } from "@/lib/dates";
import { CompanyDetail } from "@/components/empresas/company-detail";
import { ServiceTermsCard } from "@/components/empresas/service-terms-card";
import { HoursBankCard } from "@/components/service-terms/hours-bank-card";
import { OnboardingCard } from "@/components/empresas/onboarding-card";
import { isNewClient, onboardingMissing } from "@/lib/companies/onboarding";
import { membershipScopes, scopeChoices } from "@/lib/access/member-scope";
import { bankCard } from "@/lib/service-terms/hours-bank";
import { overagesReady, reportsToSend } from "@/lib/service-terms/hours-delivery";
import { serviceTerms } from "@/db/schema";
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
        engagementAccess: memberships.engagementAccess,
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
      // A journey's day-to-day (each step ticked) stays on the journey, as on the Painel.
      .where(
        and(
          eq(auditEvents.companyId, id),
          sql`(${auditEvents.action} not like 'journey.%' or ${auditEvents.action} in ('journey.created', 'journey.finished', 'journey.lost'))`,
        ),
      )
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
  const [bank, memberScopes, scopeEngagements] = await Promise.all([bankCard(id, company.name, {}, company.document), membershipScopes(members), scopeChoices(id)]);
  // Closed months' hours beyond the bank, once the client's window to contest closed (ready to bill, once), and the reports still owed.
  const [overages, reports] = bank ? await Promise.all([overagesReady(id), reportsToSend(id)]) : [[], []];
  const onboarding = isNewClient(company) ? await onboardingMissing(id) : [];
  // What still runs, offered to wind down in the archive dialog.
  const [[recurrences], [runningItems], [signedContracts]] = await Promise.all([
    db.select({ n: count() }).from(subscriptions).where(and(eq(subscriptions.companyId, id), eq(subscriptions.status, "active"))),
    db.select({ n: count() }).from(engagements).where(and(eq(engagements.companyId, id), inArray(engagements.status, ["active", "paused", "suspended"]))),
    db
      .select({ n: count() })
      .from(contracts)
      .where(and(eq(contracts.companyId, id), eq(contracts.status, "signed"), eq(contracts.kind, "contract"), or(isNull(contracts.endsAt), gte(contracts.endsAt, saoPauloDate())))),
  ]);
  const termsCard = (
    <>
    <OnboardingCard steps={onboarding} />
    <div id="condicoes" className="scroll-mt-24">
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
    </div>
    {bank && (
      <HoursBankCard
        viewer="team"
        bank={bank}
        overages={overages.map((overage) => ({ ...overage, href: `/financeiro/nova?excedente=${id}&mes=${overage.month}` }))}
        reports={reports}
      />
    )}
    </>
  );
  return (
    <CompanyDetail
      termsCard={termsCard}
      editorOpen={typeof query.editar === "string"}
      archiveOpen={typeof query.arquivar === "string"}
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
          scope: memberScopes.get(m.id),
        })),
        scopeEngagements,
        events: events.map((e) => ({
          id: e.id,
          action: e.action,
          createdAt: saoPauloDate(e.createdAt),
        })),
        offboarding: {
          recurrences: recurrences?.n ?? 0,
          engagements: runningItems?.n ?? 0,
          openInvoices: { n: invoiceRow?.n ?? 0, cents: Number(invoiceRow?.cents ?? 0) },
          contracts: signedContracts?.n ?? 0,
          tickets: ticketRow?.n ?? 0,
        },
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
