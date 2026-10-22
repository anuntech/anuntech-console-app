import type { Metadata } from "next";
import { and, asc, count, desc, eq, inArray, ne, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  auditEvents,
  automationEvents,
  contractChangeRequests,
  contractSignatures,
  contractVersions,
  contracts,
  engagements,
  invoices,
  quotes,
  serviceTerms,
  subscriptions,
  user,
} from "@/db/schema";
import { addDays } from "@/lib/billing/recurrence";
import { managerInvite } from "@/lib/access/invite-manager";
import { presetForTemplate, termsPresets } from "@/lib/service-terms/presets";
import { quoteNumberLabel } from "@/lib/quotes/quote-model";
import type { ContractHandoff } from "@/components/contratos/contract-handoff-card";
import { getActor } from "@/lib/access/access";
import { findContract } from "@/lib/contracts/contract-access";
import { saoPauloDate } from "@/lib/dates";
import { hasPermission } from "@/lib/access/permissions";
import { contractFields } from "@/lib/contracts/contract-fields";
import { billingProblemsLabel, billingReadiness } from "@/lib/billing/billing-readiness";
import { contractFieldSuggestions } from "@/lib/contracts/contract-suggestions";
import { CLIENT_CONTRACT_STATUSES } from "@/lib/contracts/contract-table";
import { ContractDetail } from "@/components/contratos/contract-detail";
import { readjustFor } from "@/lib/contracts/readjust";
export const metadata: Metadata = {
  title: "Contrato",
  description: "Leia, assine e acompanhe um contrato.",
};

export default async function Contract({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  const row = await findContract(actor, id);
  if (!row) notFound();
  const c = row.contract;
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
  const handoff = actor.admin && c.status === "signed" && c.kind === "contract" ? await contractHandoff(c, row.template) : undefined;
  // The yearly readjust, when its anniversary is near (or passed without one): the amendment comes prepared.
  const readjust = actor.admin && c.status === "signed" && c.kind === "contract" ? await readjustFor(c.id) : null;
  const grant = actor.grants.find((g) => g.company.id === c.companyId);
  const party = actor.admin ? "anuntech" : grant && hasPermission(grant.role, "finance") ? "client" : null;
  // Staff edit the next version during a review; everyone else reads what was sent.
  const editing = actor.admin && (c.status === "draft" || c.status === "in_review");
  // The draft's open fields, with what the Console already knows for them.
  const fieldSuggestions = editing
    ? await contractFieldSuggestions(c, { name: actor.user.name, email: actor.user.email }, contractFields(c.body).map((field) => field.key))
    : {};
  const invite = editing ? await managerInvite(c.companyId) : null;
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
        readjust: readjust ? { anniversary: readjust.anniversary, currentCents: readjust.currentCents, newCents: readjust.newCents, percent: readjust.percent } : null,
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
        // A client with a single company is not named back to itself.
        viewer: { admin: actor.admin, party, name: actor.user.name || actor.user.email, companies: actor.admin ? 0 : actor.grants.length },
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
        handoff,
        invite,
        now: new Date().toISOString(),
        today: saoPauloDate(),
      }}
    />
  );
}

/** Staff, on a signed contract: the proposal behind it and what is ready to prepare from it. */
async function contractHandoff(c: typeof contracts.$inferSelect, template: string | null): Promise<ContractHandoff> {
  const today = saoPauloDate();
  const [[quote], [item], recurrences, [prepared], [terms], [pending]] = await Promise.all([
    c.quoteId ? db.select().from(quotes).where(eq(quotes.id, c.quoteId)) : Promise.resolve([]),
    c.engagementId
      ? db.select({ amountCents: engagements.amountCents, subscriptionId: engagements.subscriptionId }).from(engagements).where(eq(engagements.id, c.engagementId))
      : Promise.resolve([]),
    // The item's recurrences with their invoices, newest first: running, still a draft, or paused after a cancelled draft.
    c.engagementId
      ? db
          .select({ status: subscriptions.status, invoiceId: invoices.id, invoiceStatus: invoices.status })
          .from(subscriptions)
          .innerJoin(engagements, eq(engagements.id, c.engagementId))
          .leftJoin(invoices, eq(invoices.subscriptionId, subscriptions.id))
          .where(
            and(
              ne(subscriptions.status, "cancelled"),
              or(eq(subscriptions.engagementId, c.engagementId), eq(engagements.subscriptionId, subscriptions.id)),
            ),
          )
          .orderBy(desc(invoices.dueDate))
      : Promise.resolve([]),
    db
      .select({ details: automationEvents.details })
      .from(automationEvents)
      .where(and(eq(automationEvents.kind, "contract.recurrence"), eq(automationEvents.entityId, c.id))),
    db.select({ id: serviceTerms.id, verifiedAt: serviceTerms.verifiedAt }).from(serviceTerms).where(eq(serviceTerms.contractId, c.id)).limit(1),
    c.endsAt && c.endsAt <= addDays(today, 30)
      ? db
          .select({ id: contracts.id })
          .from(contracts)
          .where(and(eq(contracts.parentId, c.id), inArray(contracts.status, ["draft", "sent", "in_review"])))
          .limit(1)
      : Promise.resolve([]),
  ]);
  const preset = presetForTemplate(template);
  // A paused recurrence whose only invoices were cancelled drafts bills nothing: the contract can prepare a new one.
  const running = recurrences.find((r) => r.status === "active" || (r.status === "paused" && r.invoiceStatus && r.invoiceStatus !== "cancelled"));
  const drafted = recurrences.find((r) => r.status === "draft");
  return {
    quote: quote ? { id: quote.id, label: `Orçamento ${quoteNumberLabel(quote.year, quote.seq)} · ${quote.publication?.title ?? quote.title}` } : null,
    recurrence: running
      ? { state: "active", href: running.invoiceId ? `/financeiro/${running.invoiceId}` : null }
      : drafted || prepared
        ? { state: "prepared", href: drafted?.invoiceId ? `/financeiro/${drafted.invoiceId}` : `/financeiro/${String(prepared?.details?.invoiceId ?? "")}` }
        : item?.amountCents
          ? { state: "ready" }
          : null,
    terms: terms
      ? { state: "exists", href: `/empresas/${c.companyId}`, confirmed: !!terms.verifiedAt }
      : preset
        ? { state: "ready", label: termsPresets.find((p) => p.key === preset)!.label }
        : null,
    renewal: !c.endsAt || c.endsAt > addDays(today, 30) ? null : pending ? { state: "pending", href: `/contratos/${pending.id}` } : { state: "ready" },
  };
}
