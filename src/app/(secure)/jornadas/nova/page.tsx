import type { Metadata } from "next";
import { requireAdmin } from "@/lib/access/access";
import { PageHeader } from "@/components/console/page-header";
import { NewJourneyForm } from "@/components/jornadas/new-journey";
import { newJourneyContext } from "@/components/jornadas/new-journey-context";
export const metadata: Metadata = { title: "Nova jornada" };

/** Direct loads only; in-app navigation shows the sheet from @ticket instead. */
export default async function NewJourney({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireAdmin();
  const context = await newJourneyContext(await searchParams, actor.user.id);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jornadas", href: "/jornadas" }, { label: "Nova" }]}
        title="Nova jornada"
        description="Um projeto de cliente, do primeiro contato à hospedagem."
      />
      <NewJourneyForm context={context} />
    </>
  );
}
