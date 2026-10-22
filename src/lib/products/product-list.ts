import "server-only";
import { and, asc, count, eq, ilike, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { catalogItems, companies, engagementSuspensions, engagements, subscriptions } from "@/db/schema";
import { productNextDueDate } from "../billing/product-due";
import { allowedIds, canSeeMoney, engagementWhere, type Actor } from "../access/access";
import { clampPage, offsetOf } from "../list-query";
import { companyShortcuts, type ProjectListQuery } from "../projects/project-table";
import { companyDisplayName } from "../companies/display-name";
import { openSuspensions } from "../suspensions/suspensions";
import type { SuspendedProduct } from "../suspensions/suspension-notice";

/**
 * The products and services a person sees, one page at a time: the web's
 * /produtos and the app's products.list. A Membro with a selection sees only
 * the items chosen for them; amounts and due dates are read only where the
 * person sees money (moneyAnywhere) and handed out per row by canSeeMoney.
 */
export async function listProducts(actor: Actor, input: ProjectListQuery) {
  const ids = [...new Set(allowedIds(actor, "overview"))];
  const query = { ...input };
  if (!actor.admin && query.company && !ids.includes(query.company)) query.company = "";
  const showCompany = actor.admin || ids.length > 1;
  const search = query.search.replace(/[\\%_]/g, "\\$&");
  // The company and, for a Membro with a selection, only the products chosen for them.
  const visible = and(inArray(engagements.kind, ["product", "service"]), engagementWhere(actor, engagements.id, engagements.companyId));
  const where = and(
    visible,
    // A suspended product is still contracted: it stays with the active ones.
    query.status === "all" ? undefined : query.status === "active" ? inArray(engagements.status, ["active", "suspended"]) : eq(engagements.status, query.status),
    query.company ? eq(engagements.companyId, query.company) : undefined,
    search
      ? or(ilike(engagements.name, `%${search}%`), ilike(companies.name, `%${search}%`))
      : undefined,
  );
  // Amounts and due dates are read only for the companies where the viewer sees money.
  const moneyAnywhere = actor.admin || allowedIds(actor, "finance").length > 0;
  const [{ total }] = await db
    .select({ total: count() })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .where(where);
  const paging = { ...query, ...clampPage(query, total) };
  const [rows, companyFilter, shortcuts, inactive] = await Promise.all([
    db
      .select({
        id: engagements.id,
        kind: engagements.kind,
        name: engagements.name,
        status: engagements.status,
        description: engagements.description,
        url: engagements.url,
        amountCents: moneyAnywhere
          ? sql<number | null>`coalesce(${subscriptions.amountCents}, ${engagements.amountCents})`
          : sql<number | null>`null`,
        interval: moneyAnywhere ? subscriptions.interval : sql<null>`null`,
        nextDueDate: moneyAnywhere ? productNextDueDate() : sql<string | null>`null`,
        subscriptionId: engagements.subscriptionId,
        companyId: engagements.companyId,
        company: companies.name,
        companyDocument: companies.document,
        catalogItemId: engagements.catalogItemId,
        icon: catalogItems.icon,
        suspensionKind: catalogItems.suspensionKind,
      })
      .from(engagements)
      .innerJoin(companies, eq(companies.id, engagements.companyId))
      .leftJoin(subscriptions, eq(subscriptions.id, engagements.subscriptionId))
      .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
      .where(where)
      // The id breaks ties between equal names, so pages never overlap.
      .orderBy(asc(engagements.name), asc(engagements.id))
      .limit(paging.pageSize)
      .offset(offsetOf(paging)),
    query.company
      ? db
          .select({ id: companies.id, name: companies.name, document: companies.document })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => (found[0] ? { id: found[0].id, name: companyDisplayName(found[0].name, found[0].document) } : null))
      : null,
    // The companies behind every match (not only this page), for the "Só desta empresa" shortcuts.
    query.search && !query.company && showCompany
      ? db
          .selectDistinct({ id: companies.id, name: companies.name, document: companies.document })
          .from(engagements)
          .innerJoin(companies, eq(companies.id, engagements.companyId))
          .where(where)
          .orderBy(asc(companies.name))
          .then((found) => companyShortcuts(found, query.search).map((company) => ({ id: company.id, name: companyDisplayName(company.name, company.document) })))
      : [],
    // Clients get the status filter only when something is paused or closed.
    actor.admin
      ? null
      : db
          .select({ n: count() })
          .from(engagements)
          .where(and(visible, notInArray(engagements.status, ["active", "suspended"])))
          .then(([found]) => found.n),
  ]);
  // Staff get the whole open suspension (the menu and the checklist); a client only that it is suspended and since when.
  const suspensions = await openSuspensions(rows.map((row) => row.id));
  // Every suspended product the client sees, whatever page or filter is open.
  const suspended: SuspendedProduct[] = actor.admin
    ? []
    : (
        await db
          .select({ name: engagements.name, companyId: engagements.companyId, since: engagementSuspensions.suspendedAt, reason: engagementSuspensions.reason })
          .from(engagementSuspensions)
          .innerJoin(engagements, eq(engagements.id, engagementSuspensions.engagementId))
          .where(and(visible, eq(engagements.status, "suspended"), isNull(engagementSuspensions.liftedAt)))
          .orderBy(asc(engagements.name))
      ).map((row) => ({ name: row.name, since: row.since?.toISOString() ?? null, reason: row.reason, canPay: canSeeMoney(actor, row.companyId) }));
  return { rows, total, paging, showCompany, companyFilter, shortcuts, inactive, suspensions, suspended };
}
