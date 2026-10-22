import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db";
import { contractChangeRequests, contractSignatures, contractVersions, contracts, user } from "@/db/schema";
import type { Actor } from "../access/access";
import { CLIENT_CONTRACT_STATUSES } from "./contract-table";

type ContractRow = typeof contracts.$inferSelect;

/**
 * What a contract's page reads around the contract itself, for the web's
 * /contratos/[id] and the app's contracts.get: every signature (each tied to
 * the version it signed by the hash), the versions sent, the amendments and
 * the contract an amendment changes (a client sees only what went out), the
 * change requests and the text of the version before the one shown, so what
 * changed can be marked. Staff never see the requests a client is still
 * writing; the client's side sees all of theirs.
 */
export async function contractRecord(actor: Actor, c: ContractRow) {
  const visible = actor.admin ? undefined : inArray(contracts.status, CLIENT_CONTRACT_STATUSES);
  const [signatures, versions, amendments, parent, requests, previousBody] = await Promise.all([
    db
      .select()
      .from(contractSignatures)
      .where(eq(contractSignatures.contractId, c.id))
      .orderBy(asc(contractSignatures.signedAt)),
    db
      .select({
        version: contractVersions.version,
        sentAt: contractVersions.sentAt,
        hash: contractVersions.documentHash,
      })
      .from(contractVersions)
      .where(eq(contractVersions.contractId, c.id))
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
      .where(and(eq(contracts.parentId, c.id), actor.admin ? ne(contracts.status, "cancelled") : visible))
      .orderBy(asc(contracts.createdAt)),
    c.parentId
      ? db
          .select({ id: contracts.id, title: contracts.title, status: contracts.status })
          .from(contracts)
          .where(and(eq(contracts.id, c.parentId), visible))
          .then((r) => r[0] ?? null)
      : null,
    db
      .select({ request: contractChangeRequests, author: user.name, email: user.email })
      .from(contractChangeRequests)
      .innerJoin(user, eq(user.id, contractChangeRequests.authorId))
      .where(
        and(
          eq(contractChangeRequests.contractId, c.id),
          actor.admin ? ne(contractChangeRequests.status, "draft") : undefined,
        ),
      )
      .orderBy(asc(contractChangeRequests.version), asc(contractChangeRequests.blockIndex), asc(contractChangeRequests.createdAt)),
    // The version before the one shown, so what changed can be marked.
    c.publishedVersion > 1 && c.status !== "draft"
      ? db
          .select({ body: contractVersions.body })
          .from(contractVersions)
          .where(and(eq(contractVersions.contractId, c.id), eq(contractVersions.version, c.publishedVersion - 1)))
          .then((r) => r[0]?.body ?? null)
      : null,
  ]);
  return {
    signatures,
    versions: versions.map((v) => ({
      version: v.version,
      sentAt: v.sentAt.toISOString(),
      hash: v.hash,
      current: c.status !== "draft" && v.hash === c.documentHash,
      signedBy: signatures.filter((s) => s.documentHash === v.hash).map((s) => s.party),
    })),
    amendments: amendments.map((a) => ({ ...a, signedAt: a.signedAt?.toISOString() ?? null })),
    parent,
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
  };
}
