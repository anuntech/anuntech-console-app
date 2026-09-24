import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  auditEvents,
  companies,
  contractSignatures,
  contractTemplates,
  contracts,
  engagements,
} from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { hasPermission } from "@/lib/permissions";
import { pendingContractVariables } from "@/lib/contract-templates";
import { ContractDetail } from "@/components/contratos/contract-detail";
export const metadata: Metadata = {
  title: "Contrato",
  description: "Leia, assine e acompanhe um contrato.",
};

export default async function Contract({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  const [row] = await db
    .select({
      contract: contracts,
      company: companies,
      engagement: engagements.name,
      template: contractTemplates.name,
    })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .leftJoin(engagements, eq(engagements.id, contracts.engagementId))
    .leftJoin(contractTemplates, eq(contractTemplates.id, contracts.templateId))
    .where(eq(contracts.id, id));
  if (!row || !canAccess(actor, row.contract.companyId, "finance")) notFound();
  const c = row.contract;
  if (!actor.admin && (c.status === "draft" || c.status === "cancelled")) notFound();
  const [signatures, events] = await Promise.all([
    db
      .select()
      .from(contractSignatures)
      .where(eq(contractSignatures.contractId, id))
      .orderBy(asc(contractSignatures.signedAt)),
    actor.admin
      ? db
          .select({ id: auditEvents.id, action: auditEvents.action, createdAt: auditEvents.createdAt })
          .from(auditEvents)
          .where(eq(auditEvents.entityId, id))
          .orderBy(desc(auditEvents.createdAt))
          .limit(12)
      : [],
  ]);
  const grant = actor.grants.find((g) => g.company.id === c.companyId);
  const party = actor.admin ? "anuntech" : grant && hasPermission(grant.role, "finance") ? "client" : null;
  const text = c.status !== "draft" && c.publication ? c.publication : { title: c.title, body: c.body };
  return (
    <ContractDetail
      data={{
        contract: {
          id: c.id,
          title: text.title,
          body: text.body,
          status: c.status,
          revision: c.revision,
          companyId: c.companyId,
          company: row.company.name,
          companyDocument: row.company.document,
          engagement: row.engagement,
          template: row.template,
          documentHash: c.documentHash,
          sentAt: c.publishedAt?.toISOString() ?? null,
          signedAt: c.signedAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
          pendingVariables: c.status === "draft" ? pendingContractVariables(c.body) : [],
        },
        signatures: signatures.map((s) => ({
          party: s.party,
          name: s.name,
          email: s.email,
          signedAt: s.signedAt.toISOString(),
          ip: s.ip,
        })),
        viewer: { admin: actor.admin, party, name: actor.user.name },
        events: events.map((e) => ({ id: e.id, action: e.action, createdAt: e.createdAt.toISOString() })),
        now: new Date().toISOString(),
      }}
    />
  );
}
