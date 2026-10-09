import type { Metadata } from "next";
import { requireAdmin } from "@/lib/access/access";
import { PageHeader } from "@/components/console/page-header";
import { NewCompanyForm } from "@/components/empresas/company-sheet";
export const metadata: Metadata = { title: "Nova empresa" };

/** Direct loads only; in-app navigation shows the sheet from @ticket instead. */
export default async function NewCompany({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { jornada } = await searchParams;
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Empresas", href: "/empresas" }, { label: "Nova" }]}
        title="Nova empresa"
        description="Informe os dados do cliente. O CNPJ preenche o restante."
      />
      <NewCompanyForm journeyId={typeof jornada === "string" && /^[0-9a-f-]{36}$/.test(jornada) ? jornada : ""} />
    </>
  );
}
