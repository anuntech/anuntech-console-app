import type { Metadata } from "next";
import { PageHeader } from "@/components/console/page-header";
import { NewQuoteForm } from "@/components/orcamentos/quote-sheet";
import { newQuoteContext, type NewQuoteSearchParams } from "@/components/orcamentos/new-quote-context";
export const metadata: Metadata = { title: "Novo orçamento" };

/** Direct loads only; in-app navigation shows the sheet from @ticket instead. */
export default async function NewQuote({ searchParams }: { searchParams: NewQuoteSearchParams }) {
  const context = await newQuoteContext(searchParams);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Orçamentos", href: "/orcamentos" }]}
        title="Novo orçamento"
        description="Nasce como rascunho; em seguida você monta fases, horas e valores."
      />
      <NewQuoteForm {...context} />
    </>
  );
}
