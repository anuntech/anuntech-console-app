import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { canSeeMoney, getActor } from "@/lib/access/access";
import { catalogIconSrc } from "@/lib/catalog/catalog-icons";
import { pageCountOf } from "@/lib/list-query";
import { projectListQuery } from "@/lib/projects/project-table";
import { listProducts } from "@/lib/products/product-list";
import { engagementLinks } from "@/lib/record-links";
import { appForUrl, protectedApps } from "@/lib/apps/registry";
import { mailPageOf } from "@/lib/products/product-opening";
import { Button } from "@/components/ui/button";
import { listLayoutFor } from "@/lib/list-layout-server";
import { PageHeader } from "@/components/console/page-header";
import { ProductsList } from "@/components/produtos/products-list";
import { SuspendedNotice } from "@/components/produtos/suspension";
import { suspensionView } from "@/lib/suspensions/suspension-view";
import { companyDisplayName } from "@/lib/companies/display-name";
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
  const query = projectListQuery(await searchParams);
  // The page's rows, filters and suspensions come from listProducts, shared with the app's products.list.
  const { rows, total, paging, showCompany, companyFilter, shortcuts, inactive, suspensions, suspended } = await listProducts(actor, query);
  // Staff see "Excluir" only where nothing billed or signed points at the item.
  const links = actor.admin ? await engagementLinks(rows.map((row) => row.id)) : null;
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
        rows={rows.map(({ amountCents, interval, nextDueDate, subscriptionId, catalogItemId, icon, suspensionKind, companyDocument, ...row }) => ({
          ...row,
          // The name people read; the razão social stays on the company's Cadastro.
          company: companyDisplayName(row.company, companyDocument),
          suspension: suspensionView(suspensions.get(row.id), suspensionKind, actor.admin),
          kind: row.kind === "service" ? "service" : "product",
          // The e-mail product opens the company's mailboxes; a protected app opens inside the Console too.
          appPage: mailPageOf(row.kind, suspensionKind, row.companyId) ?? (row.kind === "product" && appForUrl(row.url, apps) ? `/apps/${row.id}` : null),
          icon: catalogIconSrc(catalogItemId, icon),
          // Left out (not nulled) where the viewer does not see money, so nothing reaches the browser.
          ...(canSeeMoney(actor, row.companyId) ? { money: { amountCents, interval, nextDueDate, subscriptionId } } : {}),
          links: links?.get(row.id),
        }))}
        showMoney={actor.admin || rows.some((row) => canSeeMoney(actor, row.companyId))}
        compact={!actor.admin && total <= 8 && !paging.search && !paging.company && paging.status === "active" && inactive === 0}
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
