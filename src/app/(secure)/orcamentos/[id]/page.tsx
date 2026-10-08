import type { Metadata } from "next";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auditEvents, automationEvents, companies, contracts, engagements, quoteVersions, quotes, tickets } from "@/db/schema";
import { BOARD_LIMIT, quoteBoardTasks } from "@/lib/quotes/quote-handoff";
import { managerInvite } from "@/lib/access/invite-manager";
import { getActor, canAccess } from "@/lib/access/access";
import { saoPauloDate } from "@/lib/dates";
import { hasPermission } from "@/lib/access/permissions";
import { quoteNumberLabel } from "@/lib/quotes/quote-model";
import { QuoteDetail } from "@/components/orcamentos/quote-detail";
export const metadata: Metadata = {
  title: "Orçamento",
  description: "Leia a proposta, baixe o PDF e responda.",
};

export default async function Quote({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  const [row] = await db
    .select({ quote: quotes, company: companies })
    .from(quotes)
    .innerJoin(companies, eq(companies.id, quotes.companyId))
    .where(eq(quotes.id, id));
  if (!row || !canAccess(actor, row.quote.companyId, "finance")) notFound();
  const q = row.quote;
  if (!actor.admin && (q.status === "draft" || q.status === "cancelled")) notFound();
  const [versions, events] = await Promise.all([
    db
      .select({ version: quoteVersions.version, sentAt: quoteVersions.sentAt, hash: quoteVersions.documentHash })
      .from(quoteVersions)
      .where(eq(quoteVersions.quoteId, id))
      .orderBy(desc(quoteVersions.version)),
    actor.admin
      ? db
          .select({ id: auditEvents.id, action: auditEvents.action, createdAt: auditEvents.createdAt })
          .from(auditEvents)
          .where(eq(auditEvents.entityId, id))
          .orderBy(desc(auditEvents.createdAt))
          .limit(12)
      : [],
  ]);
  // Staff: what the accepted proposal already became (contract, project, charges) and the request it answers.
  const handoff = actor.admin
    ? await Promise.all([
        q.status === "accepted"
          ? db
              .select({ id: contracts.id, title: contracts.title, status: contracts.status })
              .from(contracts)
              .where(and(eq(contracts.quoteId, q.id), ne(contracts.status, "cancelled")))
              .orderBy(desc(contracts.createdAt))
              .limit(1)
          : Promise.resolve([]),
        q.status === "accepted"
          ? db.select({ id: engagements.id, name: engagements.name }).from(engagements).where(eq(engagements.quoteId, q.id)).limit(1)
          : Promise.resolve([]),
        q.status === "accepted"
          ? db
              .select({ kind: automationEvents.kind, details: automationEvents.details })
              .from(automationEvents)
              .where(and(eq(automationEvents.entityId, q.id), inArray(automationEvents.kind, ["quote.upfront", "quote.balance"])))
          : Promise.resolve([]),
        q.ticketId
          ? db.select({ id: tickets.id, subject: tickets.subject, status: tickets.status }).from(tickets).where(eq(tickets.id, q.ticketId))
          : Promise.resolve([]),
      ]).then(([[contract], [project], charges, [ticket]]) => {
        const invoiceOf = (kind: string) => String(charges.find((c) => c.kind === kind)?.details?.invoiceId ?? "") || null;
        const content = q.publication ?? q.content;
        const cards = quoteBoardTasks(content).length;
        const wanted = 2 + content.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
        return {
          contract: contract ?? null,
          project: project ?? null,
          upfrontInvoiceId: invoiceOf("quote.upfront"),
          balanceInvoiceId: invoiceOf("quote.balance"),
          ticket: ticket ? { id: ticket.id, subject: ticket.subject, open: ticket.status !== "closed" } : null,
          cards,
          cut: wanted > BOARD_LIMIT,
        };
      })
    : undefined;
  const grant = actor.grants.find((g) => g.company.id === q.companyId);
  const party = actor.admin ? "anuntech" : grant && hasPermission(grant.role, "finance") ? "client" : null;
  const frozen = q.status !== "draft" && q.publication ? q.publication : null;
  return (
    <QuoteDetail
      data={{
        quote: {
          id: q.id,
          number: frozen?.number ?? quoteNumberLabel(q.year, q.seq),
          title: frozen?.title ?? q.title,
          status: q.status,
          revision: q.revision,
          version: q.publishedVersion,
          companyId: q.companyId,
          company: frozen?.companyName ?? row.company.name,
          companyDocument: frozen?.companyDocument ?? row.company.document,
          validUntil: frozen ? frozen.validUntil : q.validUntil,
          content: frozen ?? q.content,
          documentHash: q.status === "draft" ? null : q.documentHash,
          sentAt: q.status === "draft" ? null : (q.publishedAt?.toISOString() ?? null),
          decidedAt: q.decidedAt?.toISOString() ?? null,
          decision:
            q.decidedAt && q.decidedParty && q.decidedName
              ? { party: q.decidedParty, name: q.decidedName, email: q.decidedEmail, ip: q.decidedIp, note: q.decisionNote }
              : null,
          createdAt: q.createdAt.toISOString(),
          updatedAt: q.updatedAt.toISOString(),
        },
        versions: versions.map((v) => ({
          version: v.version,
          sentAt: v.sentAt.toISOString(),
          hash: v.hash,
          current: q.status !== "draft" && v.hash === q.documentHash,
        })),
        viewer: { admin: actor.admin, party, name: actor.user.name || actor.user.email },
        events: events.map((e) => ({ id: e.id, action: e.action, createdAt: e.createdAt.toISOString() })),
        handoff,
        invite: actor.admin && q.status === "draft" ? await managerInvite(q.companyId) : null,
        now: new Date().toISOString(),
        today: saoPauloDate(),
      }}
    />
  );
}
