import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { catalogItems, companies, contractSignatures, contracts, engagements, invoices, quotes, tasks, tickets } from "@/db/schema";
import { allowedIds, canAccess, engagementWhere, ticketWhere, type Actor } from "../access/access";
import { bookmarksFor, foldersFor, scopeOf } from "../bookmarks/bookmarks";
import { saoPauloDate } from "../dates";
import { upcomingCharges } from "../billing/upcoming-charges";
import { bankCard, type BankCard } from "../service-terms/hours-bank";

/**
 * Each company's hours bank the person sees, once its conditions are
 * published, and whether they approve (an Administrador) or only read it.
 * A Membro with a selection gets only the lines about what was chosen for them.
 */
export async function clientBanks(actor: Actor, now = new Date()) {
  const banks = (
    await Promise.all(
      actor.grants.map((g) =>
        bankCard(g.company.id, g.company.name, { client: true, now, engagements: g.engagements === "all" ? undefined : g.engagements }, g.company.document),
      ),
    )
  ).filter((b): b is BankCard => !!b);
  return banks.map((bank) => ({ bank, viewer: canAccess(actor, bank.companyId, "finance") ? ("approver" as const) : ("member" as const) }));
}

/**
 * What the client's Visão geral shows: the web's Painel (client-dashboard.tsx)
 * and the app's overview.get read the same lists, so the rules stay one.
 * Money is read only for the companies where the person sees it (finance);
 * a Membro with a selection sees only the products and projects chosen.
 */
export async function clientOverview(actor: Actor, now = new Date()) {
  const today = saoPauloDate(now);
  const workIds = allowedIds(actor, "overview");
  const supportIds = allowedIds(actor, "support");
  const financeIds = allowedIds(actor, "finance");
  const canSupport = supportIds.length > 0;
  const canFinance = financeIds.length > 0;
  const none = sql`false`;
  // The company and, for a Membro with a selection, only the products and projects chosen for them.
  const workScope = () => (workIds.length ? (engagementWhere(actor, engagements.id, engagements.companyId) ?? none) : none);
  // Requests about products left out of a Membro's selection stay out, except the ones they opened.
  const ticketScope = () =>
    and(inArray(tickets.companyId, supportIds), ticketWhere(actor, { company: tickets.companyId, engagement: tickets.engagementId, author: tickets.authorId }));
  const scope = scopeOf(actor);

  const [
    openInvoices,
    [dueTotals],
    [ticketsWaiting],
    [quotesToAnswer],
    [contractsToSign],
    projects,
    products,
    recentTickets,
    folders,
  ] = await Promise.all([
    canFinance
      ? db
          .select({ invoice: invoices, company: companies.name, document: companies.document })
          .from(invoices)
          .innerJoin(companies, eq(companies.id, invoices.companyId))
          .where(and(inArray(invoices.companyId, financeIds), eq(invoices.status, "issued")))
          .orderBy(asc(invoices.dueDate), asc(invoices.id))
          .limit(5)
      : [],
    canFinance
      ? db
          .select({
            n: count(),
            total: sql<string>`coalesce(sum(${invoices.amountCents}), 0)`,
            overdueN: sql<number>`count(*) filter (where ${invoices.dueDate} < ${today})::int`,
            overdueTotal: sql<string>`coalesce(sum(${invoices.amountCents}) filter (where ${invoices.dueDate} < ${today}), 0)`,
          })
          .from(invoices)
          .where(and(inArray(invoices.companyId, financeIds), eq(invoices.status, "issued")))
      : [{ n: 0, total: "0", overdueN: 0, overdueTotal: "0" }],
    canSupport
      ? db.select({ n: count() }).from(tickets).where(and(ticketScope(), eq(tickets.status, "waiting_customer")))
      : [{ n: 0 }],
    canFinance
      ? db
          .select({ n: count() })
          .from(quotes)
          .where(and(inArray(quotes.companyId, financeIds), eq(quotes.status, "sent"), sql`(${quotes.validUntil} is null or ${quotes.validUntil} >= ${today})`))
      : [{ n: 0 }],
    // Only what still waits for the client's signature, not what waits for Anuntech's;
    // a signature of an earlier version of the text does not count (contract-actions.ts).
    canFinance
      ? db
          .select({ n: count() })
          .from(contracts)
          .where(
            and(
              inArray(contracts.companyId, financeIds),
              eq(contracts.status, "sent"),
              sql`not exists (select 1 from ${contractSignatures} where ${contractSignatures.contractId} = ${contracts.id} and ${contractSignatures.party} = 'client' and ${contractSignatures.documentHash} = ${contracts.documentHash})`,
            ),
          )
      : [{ n: 0 }],
    db
      .select({ id: engagements.id, name: engagements.name, status: engagements.status, company: companies.name, document: companies.document })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .where(and(workScope(), eq(engagements.kind, "project"), inArray(engagements.status, ["active", "paused"])))
      .orderBy(asc(engagements.status), asc(engagements.name))
      .limit(4),
    db
      .select({
        id: engagements.id,
        name: engagements.name,
        kind: engagements.kind,
        url: engagements.url,
        company: companies.name,
        document: companies.document,
        catalogItemId: engagements.catalogItemId,
        icon: catalogItems.icon,
        status: engagements.status,
        companyId: engagements.companyId,
        suspensionKind: catalogItems.suspensionKind,
      })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
      // A suspended product is still contracted, and shown first.
      .where(and(workScope(), inArray(engagements.kind, ["product", "service"]), inArray(engagements.status, ["active", "suspended"])))
      .orderBy(desc(sql`${engagements.status} = 'suspended'`), asc(engagements.name))
      .limit(5),
    canSupport
      ? db
          .select({ ticket: tickets, company: companies.name, document: companies.document })
          .from(tickets)
          .innerJoin(companies, eq(companies.id, tickets.companyId))
          .where(ticketScope())
          .orderBy(desc(tickets.updatedAt))
          .limit(5)
      : [],
    foldersFor(scope, "all"),
  ]);

  // Task progress only for the projects on screen.
  const progress = projects.length
    ? await db
        .select({
          engagementId: tasks.engagementId,
          total: count(),
          done: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
        })
        .from(tasks)
        .where(inArray(tasks.engagementId, projects.map((p) => p.id)))
        .groupBy(tasks.engagementId)
    : [];
  const bookmarkPage = await bookmarksFor(scope, folders.map((f) => f.id), { folder: "all", search: "", company: "all" }, { page: 1, pageSize: 5 });
  // Suspended products come first: the client pays or talks to the team (the list on Produtos says how).
  const suspended = products.filter((product) => product.status === "suspended");
  // With nothing open, the next recurring charge says when the next boleto comes.
  const [nextCharge] = canFinance && !dueTotals.n ? await upcomingCharges({ admin: false, companyIds: financeIds }) : [];
  const banks = await clientBanks(actor, now);
  // Improvements whose estimate waits for an Administrador.
  const estimates = canFinance
    ? await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(and(inArray(tickets.companyId, financeIds), eq(tickets.estimateStatus, "proposed")))
    : [];
  // Deliveries waiting for the Administrador's test: approve or point out a problem on each card.
  const toReview = canFinance
    ? await db
        .select({ projectId: tasks.engagementId })
        .from(tasks)
        .where(and(inArray(tasks.companyId, financeIds), eq(tasks.status, "review")))
    : [];
  return {
    today,
    canSupport,
    canFinance,
    openInvoices,
    dueTotals,
    ticketsWaiting: ticketsWaiting.n,
    quotesToAnswer: quotesToAnswer.n,
    contractsToSign: contractsToSign.n,
    projects,
    progress,
    products,
    suspended,
    recentTickets,
    folders,
    bookmarkPage,
    nextCharge: nextCharge ?? null,
    banks,
    estimates,
    toReview,
  };
}
