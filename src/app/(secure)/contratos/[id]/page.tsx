import type { Metadata } from "next";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  auditEvents,
  companies,
  contractChangeRequests,
  contractSignatures,
  contractTemplates,
  contractVersions,
  contracts,
  engagements,
  user,
} from "@/db/schema";
import { getActor, canAccess } from "@/lib/access/access";
import { saoPauloDate } from "@/lib/dates";
import { hasPermission } from "@/lib/access/permissions";
import { contractFields } from "@/lib/contracts/contract-fields";
import { billingProblemsLabel, billingReadiness } from "@/lib/billing/billing-readiness";
import { contractFieldSuggestions } from "@/lib/contracts/contract-suggestions";
import { CLIENT_CONTRACT_STATUSES } from "@/lib/contracts/contract-table";
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
  const visible = actor.admin ? undefined : inArray(contracts.status, CLIENT_CONTRACT_STATUSES);
  // Staff never see the requests a client is still writing; the client's side sees all of theirs.
  const requestsQuery = db
    .select({ request: contractChangeRequests, author: user.name, email: user.email })
    .from(contractChangeRequests)
    .innerJoin(user, eq(user.id, contractChangeRequests.authorId))
    .where(
      and(
        eq(contractChangeRequests.contractId, id),
        actor.admin ? ne(contractChangeRequests.status, "draft") : undefined,
      ),
    )
    .orderBy(asc(contractChangeRequests.version), asc(contractChangeRequests.blockIndex), asc(contractChangeRequests.createdAt));
  // The version before the one shown, so what changed can be marked.
  const previousQuery =
    c.publishedVersion > 1 && c.status !== "draft"
      ? db
          .select({ body: contractVersions.body })
          .from(contractVersions)
          .where(and(eq(contractVersions.contractId, id), eq(contractVersions.version, c.publishedVersion - 1)))
          .then((r) => r[0]?.body ?? null)
      : null;
  const [signatures, versions, amendments, parent, events, amendmentCount, requests, previousBody] = await Promise.all([
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
    // Staff only: every amendment, cancelled ones included, keeps a contract from being deleted.
    actor.admin
      ? db
          .select({ n: count() })
          .from(contracts)
          .where(eq(contracts.parentId, id))
          .then((r) => r[0]?.n ?? 0)
      : 0,
    requestsQuery,
    previousQuery,
  ]);
  const grant = actor.grants.find((g) => g.company.id === c.companyId);
  const party = actor.admin ? "anuntech" : grant && hasPermission(grant.role, "finance") ? "client" : null;
  // Staff edit the next version during a review; everyone else reads what was sent.
  const editing = actor.admin && (c.status === "draft" || c.status === "in_review");
  // The draft's open fields, with what the Console already knows for them.
  const fieldSuggestions = editing
    ? await contractFieldSuggestions(c, { name: actor.user.name, email: actor.user.email }, contractFields(c.body).map((field) => field.key))
    : {};
  const text = !editing && c.publication ? c.publication : { title: c.title, body: c.body };
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
          fieldSuggestions,
          // The first charges of a signed contract go out only with a complete billing record.
          billingProblems: editing ? billingProblemsLabel(billingReadiness(row.company)) || null : null,
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
        review: {
          requests: requests.map(({ request: r, author, email }) => ({
            id: r.id,
            version: r.version,
            blockIndex: r.blockIndex,
            label: r.label,
            excerpt: r.excerpt,
            comment: r.comment,
            proposedText: r.proposedText,
            status: r.status,
            applied: r.applied,
            response: r.response,
            author: author || email,
            createdAt: r.createdAt.toISOString(),
            submittedAt: r.submittedAt?.toISOString() ?? null,
            decidedAt: r.decidedAt?.toISOString() ?? null,
          })),
          previousBody,
        },
        events: events.map((e) => ({ id: e.id, action: e.action, createdAt: e.createdAt.toISOString() })),
        // Every signature on any version, not only the current one, counts against deleting.
        deletion: actor.admin ? { signatures: signatures.length, amendments: amendmentCount } : undefined,
        now: new Date().toISOString(),
        today: saoPauloDate(),
      }}
    />
  );
}
