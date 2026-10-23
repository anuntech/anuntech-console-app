import "server-only";
import { eq } from "drizzle-orm";
import { engagements } from "@/db/schema";
import { db } from "../../db";
import { allowedIds, canSeeMoney, type Actor } from "../../access/access";
import { catalogIconSrc } from "../../catalog/catalog-icons";
import { companyDisplayName } from "../../companies/display-name";
import { engagementLabels } from "../../format";
import { protectedApps } from "../../apps/registry";
import { pageCountOf } from "../../list-query";
import { projectListQuery } from "../../projects/project-table";
import { listProducts } from "../../products/product-list";
import { findProduct, productSuspension } from "../../products/product-view";
import { productOpening } from "../../products/product-opening";
import { suspensionNotice } from "../../suspensions/suspension-notice";
import { api } from "../server";
import { guard, missing } from "../access";

type ProductSource = {
  id: string;
  kind: string;
  name: string;
  description?: string | null;
  status: string;
  url: string | null;
  company: string;
  document: string | null;
  catalogItemId: string | null;
  icon: string | null;
};

/** A product or service as the app's rows read it: how it opens, its icon and its situation in words. */
export function productCard(row: ProductSource, apps = protectedApps()) {
  return {
    id: row.id,
    kind: row.kind === "service" ? ("service" as const) : ("product" as const),
    name: row.name,
    description: row.description ?? null,
    status: row.status,
    statusLabel: engagementLabels[row.status] ?? row.status,
    company: companyDisplayName(row.company, row.document),
    iconPath: catalogIconSrc(row.catalogItemId, row.icon),
    ...productOpening(row.kind, row.url, apps),
  };
}

/** The company of the engagement the input names, for the guard; unknown ids reach no one. */
export const engagementCompany = async ({ id }: { id: string }) =>
  (await db.select({ companyId: engagements.companyId }).from(engagements).where(eq(engagements.id, id)))[0]?.companyId;

const showsCompany = (actor: Actor) => actor.admin || new Set(allowedIds(actor, "overview")).size > 1;

export const products = {
  list: api.products.list
    // listProducts keeps each person to their companies and, for a Membro, the items chosen for them.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      // listProducts drops a company the person does not reach, as /produtos?company= on the web.
      const query = projectListQuery({ status: input.status, q: input.search, company: input.company, page: String(input.page) });
      const list = await listProducts(actor, query);
      const apps = protectedApps();
      return {
        rows: list.rows.map((row) => ({
          ...productCard({ ...row, document: row.companyDocument }, apps),
          // Left out (not nulled) where the person does not see money, as on the web.
          ...(canSeeMoney(actor, row.companyId)
            ? { money: { amountCents: row.amountCents, interval: row.interval, nextDueDate: row.nextDueDate } }
            : {}),
        })),
        page: list.paging.page,
        pageCount: pageCountOf(list.total, list.paging.pageSize),
        showCompany: list.showCompany,
        showStatusFilter: actor.admin || (list.inactive ?? 0) > 0,
        suspended: suspensionNotice(list.suspended),
        // "Só desta empresa" after a search, and the company the list is narrowed to (display names).
        shortcuts: list.shortcuts,
        companyFilter: list.companyFilter,
      };
    }),
  get: api.products.get
    .use(guard({ area: "overview", company: engagementCompany }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      // A Membro's selection too: outside it the item does not exist.
      const row = await findProduct(actor, input.id);
      if (!row || row.engagement.kind === "project") throw missing();
      const e = row.engagement;
      const suspended = await productSuspension(actor, e);
      return {
        ...productCard({ ...e, company: row.company, document: row.companyDocument, icon: row.item?.icon ?? null }),
        companyId: e.companyId,
        showCompany: showsCompany(actor),
        sections: {
          whatWeDo: row.item?.whatWeDo ?? null,
          whatWeNeed: row.item?.whatWeNeed ?? null,
          expectedResults: row.item?.expectedResults ?? null,
          deadlines: row.item?.deadlines ?? null,
        },
        ...(row.billing ? { billing: row.billing } : {}),
        suspension: suspended ? suspensionNotice([suspended]) : null,
      };
    }),
};
