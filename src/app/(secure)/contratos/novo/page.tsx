import type { Metadata } from "next";
import { PageHeader } from "@/components/console/page-header";
import { NewContractForm } from "@/components/contratos/contract-sheet";
import { newContractContext, type NewContractSearchParams } from "@/components/contratos/new-contract-context";
export const metadata: Metadata = { title: "Novo contrato" };

/** Direct loads only; in-app navigation shows the sheet from @ticket instead. */
export default async function NewContract({ searchParams }: { searchParams: NewContractSearchParams }) {
  const context = await newContractContext(searchParams);
  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Contratos", href: "/contratos" },
          ...(context.parent ? [{ label: context.parent.title, href: `/contratos/${context.parent.id}` }] : []),
        ]}
        title={context.parent ? "Novo aditivo" : "Novo contrato"}
        description="Nasce como rascunho; você revisa o texto antes de enviar."
      />
      <NewContractForm {...context} />
    </>
  );
}
