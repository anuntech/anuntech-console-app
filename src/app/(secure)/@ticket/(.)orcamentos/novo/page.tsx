import { NewQuoteSheet } from "@/components/orcamentos/quote-sheet";
import { newQuoteContext, type NewQuoteSearchParams } from "@/components/orcamentos/new-quote-context";
export const metadata = { title: "Novo orçamento" };
export default async function Page({ searchParams }: { searchParams: NewQuoteSearchParams }) {
  const context = await newQuoteContext(searchParams);
  return <NewQuoteSheet {...context} />;
}
