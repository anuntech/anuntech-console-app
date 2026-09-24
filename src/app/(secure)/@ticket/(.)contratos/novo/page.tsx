import { NewContractSheet } from "@/components/contratos/contract-sheet";
import { newContractContext, type NewContractSearchParams } from "@/components/contratos/new-contract-context";
export const metadata = { title: "Novo contrato" };
export default async function Page({ searchParams }: { searchParams: NewContractSearchParams }) {
  const context = await newContractContext(searchParams);
  return <NewContractSheet {...context} />;
}
