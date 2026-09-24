import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { accessibleCompanies, getActor } from "@/lib/access";
import { PageHeader } from "@/components/console/page-header";
import { QuoteEditor } from "@/components/orcamentos/quote-editor";
export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ companyId?: string }> }) {
  const actor = await getActor();
  if (!actor.admin) notFound();
  const { companyId } = await searchParams;
  // Archived clients stay out of the picker unless asked for by id.
  const companies = (await accessibleCompanies(actor))
    .filter((c) => !c.archived || c.id === companyId)
    .map((c) => ({ id: c.id, name: c.name, document: c.document }));
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Orçamentos", href: "/orcamentos" }, { label: "Novo" }]}
        title="Novo orçamento"
        description="Nasce como rascunho; você revisa fases, horas e valores antes de enviar."
      />
      <QuoteEditor companies={companies} companyId={companies.some((c) => c.id === companyId) ? companyId : undefined} />
    </>
  );
}
