import type { Metadata } from "next";
import { PageHeader } from "@/components/console/page-header";
import { NewInvoiceForm } from "@/components/financeiro/invoice-form";
import {
  newInvoiceContext,
  type NewInvoiceSearchParams,
} from "@/components/financeiro/new-invoice-context";
export const metadata: Metadata = { title: "Nova cobrança" };

/** Direct loads only; in-app navigation shows the sheet from @ticket instead. */
export default async function NewInvoice({
  searchParams,
}: {
  searchParams: NewInvoiceSearchParams;
}) {
  const context = await newInvoiceContext(searchParams);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Financeiro", href: "/financeiro" }, { label: "Nova cobrança" }]}
        title="Nova cobrança"
        description="Quem paga, o que está sendo cobrado e as condições."
      />
      <NewInvoiceForm {...context} />
    </>
  );
}
