import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { allowedIds, getActor } from "@/lib/access/access";
import { findProduct } from "@/lib/products/product-view";
import { companyDisplayName } from "@/lib/companies/display-name";
import { catalogIconSrc } from "@/lib/catalog/catalog-icons";
import { engagementLinks } from "@/lib/record-links";
import { ServiceDetail } from "@/components/produtos/service-detail";
export const metadata: Metadata = { title: "Serviço" };

/** Services open here; products open their link; projects live in /projetos. */
export default async function Engagement({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  const row = await findProduct(actor, id);
  // Access first, so a redirect never tells someone what a hidden id is.
  if (!row) notFound();
  if (row.engagement.kind === "project") redirect(`/projetos/${id}`);
  if (row.engagement.kind === "product") redirect("/produtos");
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
          company: companyDisplayName(row.company, row.companyDocument),
          icon: catalogIconSrc(row.item?.id, row.item?.icon),
          // Only where the viewer sees money; a Membro gets no billing at all.
          billing: row.billing,
          links,
        },
        sections: {
          whatWeDo: row.item?.whatWeDo ?? null,
          whatWeNeed: row.item?.whatWeNeed ?? null,
          expectedResults: row.item?.expectedResults ?? null,
          deadlines: row.item?.deadlines ?? null,
        },
        // A client names the company only when they see more than one: otherwise it is their own.
        viewer: { admin: actor.admin, showCompany: actor.admin || new Set(allowedIds(actor, "overview")).size > 1 },
      }}
    />
  );
}
