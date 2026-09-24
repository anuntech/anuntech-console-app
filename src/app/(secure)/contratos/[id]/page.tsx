import type { Metadata } from "next";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  auditEvents,
  companies,
  contractSignatures,
  contractTemplates,
  contractVersions,
  contracts,
  engagements,
} from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
import { saoPauloDate } from "@/lib/dates";
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
  const visible = actor.admin ? undefined : inArray(contracts.status, ["sent", "signed"]);
  const [signatures, versions, amendments, parent, events] = await Promise.all([
    db
      .select()
      .from(contractSignatures)
      .where(eq(contractSignatures.contractId, id))
      .orderBy(asc(contractSignatures.signedAt)),
    db
      .select({
        version: contractVersions.version,
        sentAt: contractVersions.sentAt,
        hash: contractVersions.documentHash,
      })
      .from(contractVersions)
      .where(eq(contractVersions.contractId, id))
      .orderBy(desc(contractVersions.version)),
    db
      .select({
        id: contracts.id,
        title: contracts.title,
        status: contracts.status,
        signedAt: contracts.signedAt,
        endsAt: contracts.endsAt,
      })
      .from(contracts)
      .where(and(eq(contracts.parentId, id), actor.admin ? ne(contracts.status, "cancelled") : visible))
      .orderBy(asc(contracts.createdAt)),
    c.parentId
      ? db
          .select({ id: contracts.id, title: contracts.title, status: contracts.status })
          .from(contracts)
          .where(and(eq(contracts.id, c.parentId), visible))
          .then((r) => r[0] ?? null)
      : null,
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
  const current = signatures.filter((s) => s.documentHash === c.documentHash);
  return (
    <ContractDetail
      data={{
        contract: {
          id: c.id,
          title: text.title,
          body: text.body,
          kind: c.kind,
          status: c.status,
          revision: c.revision,
          version: c.publishedVersion,
          companyId: c.companyId,
          company: row.company.name,
          companyDocument: row.company.document,
          engagement: row.engagement,
          template: row.template,
          documentHash: c.status === "draft" ? null : c.documentHash,
          startsAt: c.startsAt,
          endsAt: c.endsAt,
          sentAt: c.publishedAt?.toISOString() ?? null,
          signedAt: c.signedAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
          pendingVariables: c.status === "draft" ? pendingContractVariables(c.body) : [],
        },
        parent,
        amendments: amendments.map((a) => ({ ...a, signedAt: a.signedAt?.toISOString() ?? null })),
        versions: versions.map((v) => ({
          version: v.version,
          sentAt: v.sentAt.toISOString(),
          hash: v.hash,
          current: c.status !== "draft" && v.hash === c.documentHash,
          signedBy: signatures.filter((s) => s.documentHash === v.hash).map((s) => s.party),
        })),
        signatures: current.map((s) => ({
          party: s.party,
          name: s.name,
          email: s.email,
          signedAt: s.signedAt.toISOString(),
          ip: s.ip,
        })),
        viewer: { admin: actor.admin, party, name: actor.user.name || actor.user.email },
        events: events.map((e) => ({ id: e.id, action: e.action, createdAt: e.createdAt.toISOString() })),
        now: new Date().toISOString(),
        today: saoPauloDate(),
      }}
    />
  );
}
