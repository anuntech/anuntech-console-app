import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { catalogItems, companies, engagements, subscriptions } from "@/db/schema";
import { getActor, canAccess } from "@/lib/access";
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
      nextDueDate: subscriptions.nextDueDate,
      subscriptionInterval: subscriptions.interval,
    })
    .from(engagements)
    .innerJoin(companies, eq(companies.id, engagements.companyId))
    .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
    .leftJoin(subscriptions, eq(subscriptions.id, engagements.subscriptionId))
    .where(eq(engagements.id, id));
  if (!row) notFound();
  if (row.engagement.kind === "project") redirect(`/projetos/${id}`);
  if (row.engagement.kind === "product") redirect("/produtos");
  if (!canAccess(actor, row.engagement.companyId, "overview")) notFound();
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
          amountCents: row.engagement.amountCents,
          interval: row.subscriptionInterval ?? row.item?.interval ?? null,
          nextDueDate: row.nextDueDate,
          subscriptionId: row.engagement.subscriptionId,
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
