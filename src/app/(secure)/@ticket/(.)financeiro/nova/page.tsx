import { NewInvoiceSheet } from "@/components/financeiro/invoice-sheet";
import {
  newInvoiceContext,
  type NewInvoiceSearchParams,
} from "@/components/financeiro/new-invoice-context";
export const metadata = { title: "Nova cobrança" };
export default async function Page({
  searchParams,
}: {
  searchParams: NewInvoiceSearchParams;
}) {
  const context = await newInvoiceContext(searchParams);
  return <NewInvoiceSheet {...context} />;
}
