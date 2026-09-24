import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auditEvents, companies, quoteVersions, quotes } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { saoPauloDate } from "@/lib/dates";
import { hasPermission } from "@/lib/permissions";
import { quoteNumberLabel } from "@/lib/quote-model";
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
        now: new Date().toISOString(),
        today: saoPauloDate(),
      }}
    />
  );
}
