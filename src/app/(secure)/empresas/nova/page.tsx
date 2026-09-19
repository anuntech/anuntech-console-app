import { requireAdmin } from "@/lib/access";
import { createCompany } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { Heading, Field, Back } from "@/components/ui";
export default async function NewCompany() {
  await requireAdmin();
  return (
    <>
      <Back href="/empresas" label="Empresas" />
      <Heading
        title="Cadastrar empresa"
        description="Comece com os dados de identificação e contato."
      />
      <section className="panel form-panel">
        <ActionForm action={createCompany} label="Cadastrar empresa">
          <Field label="Nome ou razão social">
            <input name="name" required maxLength={160} />
          </Field>
          <Field label="CPF ou CNPJ">
            <input
              name="document"
              required
              inputMode="numeric"
              maxLength={18}
            />
          </Field>
          <Field label="E-mail financeiro">
            <input name="billingEmail" type="email" required maxLength={254} />
          </Field>
          <Field label="Telefone (opcional)">
            <input name="phone" type="tel" maxLength={30} />
          </Field>
        </ActionForm>
      </section>
    </>
  );
}
