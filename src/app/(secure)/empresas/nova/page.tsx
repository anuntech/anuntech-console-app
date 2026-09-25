import type { Metadata } from "next";
import { requireAdmin } from "@/lib/access";
import { PageHeader } from "@/components/console/page-header";
import { NewCompanyForm } from "@/components/empresas/company-sheet";
export const metadata: Metadata = { title: "Nova empresa" };

/** Direct loads only; in-app navigation shows the sheet from @ticket instead. */
export default async function NewCompany() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Empresas", href: "/empresas" }, { label: "Nova" }]}
        title="Nova empresa"
        description="Informe os dados do cliente. O CNPJ preenche o restante."
      />
      <NewCompanyForm />
    </>
  );
}
