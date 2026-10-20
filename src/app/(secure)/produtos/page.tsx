import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { and, asc, count, eq, ilike, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { catalogItems, companies, engagementSuspensions, engagements, subscriptions } from "@/db/schema";
import { productNextDueDate } from "@/lib/billing/product-due";
import { allowedIds, canSeeMoney, engagementWhere, getActor } from "@/lib/access/access";
import { catalogIconSrc } from "@/lib/catalog/catalog-icons";
import { clampPage, offsetOf, pageCountOf } from "@/lib/list-query";
import { companyShortcuts, projectListQuery } from "@/lib/projects/project-table";
import { engagementLinks } from "@/lib/record-links";
import { appForUrl, protectedApps } from "@/lib/apps/registry";
import { Button } from "@/components/ui/button";
import { listLayoutFor } from "@/lib/list-layout-server";
import { PageHeader } from "@/components/console/page-header";
import { ProductsList } from "@/components/produtos/products-list";
import { SuspendedNotice } from "@/components/produtos/suspension";
import { openSuspensions } from "@/lib/suspensions/suspensions";
import { suspensionView } from "@/lib/suspensions/suspension-view";
export const metadata: Metadata = {
  title: "Produtos e serviços",
  description: "Os produtos e serviços que cada empresa tem com a Anuntech.",
};

export default async function Products({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  const view = await listLayoutFor("products");
  const ids = [...new Set(allowedIds(actor, "overview"))];
  const query = projectListQuery(await searchParams);
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
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, query.company))
          .then((found) => found[0] ?? null)
      : null,
    // The companies behind every match (not only this page), for the "Só desta empresa" shortcuts.
    query.search && !query.company && showCompany
      ? db
          .selectDistinct({ id: companies.id, name: companies.name })
          .from(engagements)
          .innerJoin(companies, eq(companies.id, engagements.companyId))
          .where(where)
          .orderBy(asc(companies.name))
          .then((found) => companyShortcuts(found, query.search))
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
  // Staff see "Excluir" only where nothing billed or signed points at the item.
  const links = actor.admin ? await engagementLinks(rows.map((row) => row.id)) : null;
  // Staff get the whole open suspension (the menu and the checklist); a client only that it is suspended and since when.
  const suspensions = await openSuspensions(rows.map((row) => row.id));
  // Every suspended product the client sees, whatever page or filter is open.
  const suspended = actor.admin
    ? []
    : (
        await db
          .select({ name: engagements.name, companyId: engagements.companyId, since: engagementSuspensions.suspendedAt, reason: engagementSuspensions.reason })
          .from(engagementSuspensions)
          .innerJoin(engagements, eq(engagements.id, engagementSuspensions.engagementId))
          .where(and(visible, eq(engagements.status, "suspended"), isNull(engagementSuspensions.liftedAt)))
          .orderBy(asc(engagements.name))
      ).map((row) => ({ name: row.name, since: row.since?.toISOString() ?? null, reason: row.reason, canPay: canSeeMoney(actor, row.companyId) }));
  // Products whose URL is an app that only runs inside the Console open there.
  const apps = protectedApps();
  return (
    <>
      <PageHeader
        className="mb-4"
        title="Produtos e serviços"
        count={total}
      />
      {suspended.length > 0 && <SuspendedNotice products={suspended} />}
      <ProductsList
        view={view}
        actions={
          actor.admin && (
            <Button asChild>
              <Link href="/produtos/novo" data-assistant-action="">
                <PlusIcon />
                Vincular
              </Link>
            </Button>
          )
        }
        rows={rows.map(({ amountCents, interval, nextDueDate, subscriptionId, catalogItemId, icon, suspensionKind, ...row }) => ({
          ...row,
          suspension: suspensionView(suspensions.get(row.id), suspensionKind, actor.admin),
          kind: row.kind === "service" ? "service" : "product",
          appPage: row.kind === "product" && appForUrl(row.url, apps) ? `/apps/${row.id}` : null,
          icon: catalogIconSrc(catalogItemId, icon),
          // Left out (not nulled) where the viewer does not see money, so nothing reaches the browser.
          ...(canSeeMoney(actor, row.companyId) ? { money: { amountCents, interval, nextDueDate, subscriptionId } } : {}),
          links: links?.get(row.id),
        }))}
        showMoney={actor.admin || rows.some((row) => canSeeMoney(actor, row.companyId))}
        compact={!actor.admin && total <= 8 && !query.search && !query.company && query.status === "active" && inactive === 0}
        query={paging}
        total={total}
        pageCount={pageCountOf(total, paging.pageSize)}
        admin={actor.admin}
        showCompany={showCompany}
        companyFilter={companyFilter}
        companyShortcuts={shortcuts}
      />
    </>
  );
}
