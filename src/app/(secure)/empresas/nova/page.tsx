import { requireAdmin } from "@/lib/access";
import { createCompany } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { Heading, Back } from "@/components/ui";
import { CompanyBillingFields } from "@/components/company-billing-fields";
export default async function NewCompany() {
  await requireAdmin();
  return (
    <>
      <Back href="/empresas" label="Empresas" />
      <Heading
        title="Cadastrar empresa"
        description="Identificação, contato e dados para cobranças e notas fiscais."
      />
      <section className="panel form-panel">
        <ActionForm action={createCompany} label="Cadastrar empresa">
          <CompanyBillingFields />
        </ActionForm>
      </section>
    </>
  );
}
