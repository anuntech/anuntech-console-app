import { CreationModal } from "./creation-modal";
import { requireAdmin } from "@/lib/access";
import { createCompany } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { CompanyBillingFields } from "@/components/company-billing-fields";

export async function NewCompany({
  intercepted = false,
}: {
  intercepted?: boolean;
}) {
  await requireAdmin();
  return (
    <CreationModal
      title="Cadastrar empresa"
      description="Informe os dados da empresa."
      path="/empresas/nova"
      fallback="/empresas"
      intercepted={intercepted}
      plain
    >
      <ActionForm action={createCompany} label="Cadastrar empresa">
        <CompanyBillingFields />
      </ActionForm>
    </CreationModal>
  );
}
