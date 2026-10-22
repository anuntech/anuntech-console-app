import "server-only";
import { and, count, desc, eq, gte, ilike, inArray, lt, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { companies, contractSignatures, contracts, engagements } from "@/db/schema";
import { allowedIds, type Actor } from "../access/access";
import { saoPauloDate } from "../dates";
import { clampPage, offsetOf, pageCountOf } from "../list-query";
import { addDays, CLIENT_CONTRACT_STATUSES, clientContractFilters, EXPIRY_WARNING_DAYS, type contractQuery } from "./contract-table";

/**
 * The contracts a person sees, one page at a time: the web's /contratos and
 * the app's contracts.list. Clients see their finance companies' contracts
 * that went out (sent, in review, signed), never drafts or cancellations.
 */
export async function listContracts(actor: Actor, input: ReturnType<typeof contractQuery>) {
  const ids = allowedIds(actor, "finance");
  const query = { ...input };
  // Clients can only narrow within their own companies, and only by the
  // situations they can see (drafts and cancellations never reach them).
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  if (!actor.admin && !clientContractFilters.includes(query.status)) query.status = "all";
  const today = saoPauloDate();
  const horizon = addDays(today, EXPIRY_WARNING_DAYS);
  const expiring = and(eq(contracts.status, "signed"), gte(contracts.endsAt, today), lte(contracts.endsAt, horizon));
  const expired = and(eq(contracts.status, "signed"), lt(contracts.endsAt, today));
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  const parents = alias(contracts, "parents");
  const where =
    and(
      actor.admin
        ? undefined
        : ids.length
          ? and(inArray(contracts.companyId, ids), inArray(contracts.status, CLIENT_CONTRACT_STATUSES))
          : sql`false`,
      query.status === "all"
        ? undefined
        : query.status === "expiring"
          ? expiring
          : query.status === "expired"
            ? expired
            : eq(contracts.status, query.status),
      query.company ? eq(contracts.companyId, query.company) : undefined,
      search ? or(ilike(contracts.title, `%${search}%`), ilike(companies.name, `%${search}%`)) : undefined,
    ) ?? sql`true`;
  const [[{ total }], companyFilter, alerts] = await Promise.all([
    // Joined with companies because the search also matches the company name.
    db
      .select({ total: count() })
      .from(contracts)
      .innerJoin(companies, eq(companies.id, contracts.companyId))
      .where(where),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name, document: companies.document })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => found[0] ?? null)
      : null,
    actor.admin
      ? Promise.all([
          db.select({ n: count() }).from(contracts).where(expiring),
          db.select({ n: count() }).from(contracts).where(expired),
        ]).then(([a, b]) => ({ expiring: a[0].n, expired: b[0].n }))
      : { expiring: 0, expired: 0 },
  ]);
  const page = clampPage(query, total);
  const rows = await db
    .select({
      id: contracts.id,
      title: contracts.title,
      kind: contracts.kind,
      parentId: contracts.parentId,
      parentTitle: parents.title,
      companyId: contracts.companyId,
      company: companies.name,
      companyDocument: companies.document,
      engagement: engagements.name,
      status: contracts.status,
      startsAt: contracts.startsAt,
      endsAt: contracts.endsAt,
      documentHash: contracts.documentHash,
      updatedAt: contracts.updatedAt,
    })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .leftJoin(engagements, eq(engagements.id, contracts.engagementId))
    .leftJoin(parents, eq(parents.id, contracts.parentId))
    .where(where)
    // The id breaks ties so offset paging never repeats or skips a row.
    .orderBy(desc(contracts.updatedAt), desc(contracts.id))
    .limit(page.pageSize)
    .offset(offsetOf(page));
  const rowIds = rows.map((row) => row.id);
  const [signatures, amendments] = rows.length
    ? await Promise.all([
        db
          .select({
            contractId: contractSignatures.contractId,
            party: contractSignatures.party,
            hash: contractSignatures.documentHash,
          })
          .from(contractSignatures)
          .where(inArray(contractSignatures.contractId, rowIds)),
        // Staff only: what keeps a contract from being deleted (cancelled amendments count too).
        actor.admin
          ? db
              .select({ parentId: contracts.parentId, n: count() })
              .from(contracts)
              .where(inArray(contracts.parentId, rowIds))
              .groupBy(contracts.parentId)
          : [],
      ])
    : [[], []];
  const list = rows.map(({ documentHash, ...row }) => ({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
    signedBy: signatures.filter((s) => s.contractId === row.id && s.hash === documentHash).map((s) => s.party),
    // Every signature on any version, not only the current one, for the delete guard.
    signatures: signatures.filter((s) => s.contractId === row.id).length,
    amendments: amendments.find((a) => a.parentId === row.id)?.n ?? 0,
  }));
  return {
    list,
    query: { ...query, page: page.page },
    total,
    pageCount: pageCountOf(total, page.pageSize),
    showCompany: actor.admin || ids.length > 1,
    alerts,
    companyFilter,
    today,
  };
}
