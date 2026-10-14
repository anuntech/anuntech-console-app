import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { catalogItems, companies, engagements, subscriptions } from "@/db/schema";
import { productNextDueDate } from "@/lib/billing/product-due";
import { canSeeEngagement, canSeeMoney, getActor } from "@/lib/access/access";
import { catalogIconSrc } from "@/lib/catalog/catalog-icons";
import { engagementLinks } from "@/lib/record-links";
import { ServiceDetail } from "@/components/produtos/service-detail";
export const metadata: Metadata = { title: "Serviço" };

/** Services open here; products open their link; projects live in /projetos. */
export default async function Engagement({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  const [row] = await db
    .select({
      engagement: engagements,
      company: companies.name,
      item: catalogItems,
      nextDueDate: productNextDueDate(),
      subscriptionInterval: subscriptions.interval,
      subscriptionAmount: subscriptions.amountCents,
    })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
    .leftJoin(subscriptions, eq(subscriptions.id, engagements.subscriptionId))
    .where(eq(engagements.id, id));
  // Access first, so a redirect never tells someone what a hidden id is.
  if (!row || !canSeeEngagement(actor, row.engagement)) notFound();
  if (row.engagement.kind === "project") redirect(`/projetos/${id}`);
  if (row.engagement.kind === "product") redirect("/produtos");
  const money = canSeeMoney(actor, row.engagement.companyId);
  // Staff see "Excluir" only when nothing billed or signed points at it.
  const links = actor.admin ? (await engagementLinks([id])).get(id) : undefined;
  return (
    <ServiceDetail
      data={{
        service: {
          id: row.engagement.id,
          name: row.engagement.name,
          status: row.engagement.status,
          description: row.engagement.description,
          companyId: row.engagement.companyId,
          company: row.company,
          icon: catalogIconSrc(row.item?.id, row.item?.icon),
          // Only where the viewer sees money; a Membro gets no billing at all.
          billing: money
            ? {
                amountCents: row.subscriptionAmount ?? row.engagement.amountCents,
                interval: row.subscriptionInterval ?? row.item?.interval ?? null,
                nextDueDate: row.nextDueDate,
              }
            : undefined,
          links,
        },
        sections: {
          whatWeDo: row.item?.whatWeDo ?? null,
          whatWeNeed: row.item?.whatWeNeed ?? null,
          expectedResults: row.item?.expectedResults ?? null,
          deadlines: row.item?.deadlines ?? null,
        },
        viewer: { admin: actor.admin },
      }}
    />
  );
}
