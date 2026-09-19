import Link from "next/link";
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
        <h2>Como deseja cadastrar?</h2>
        <p>
          Preencha abaixo ou envie um link para o cliente informar os dados.
        </p>
        <Link className="button" href="/empresas/convites">
          Enviar link para o cliente
        </Link>
      </section>
      <section className="panel form-panel">
        <h2>Preencher por aqui</h2>
        <ActionForm action={createCompany} label="Cadastrar empresa">
          <CompanyBillingFields />
        </ActionForm>
      </section>
    </>
  );
}
