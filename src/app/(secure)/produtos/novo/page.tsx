import { requireAdmin, accessibleCompanies } from "@/lib/access";
import { createEngagement } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { Heading, Field, Back, Empty } from "@/components/ui";
export default async function NewProduct() {
  const actor = await requireAdmin();
  const companies = await accessibleCompanies(actor);
  return (
    <>
      <Back href="/produtos" label="Produtos e projetos" />
      <Heading title="Adicionar produto ou projeto" />
      <section className="panel form-panel">
        {companies.length ? (
          <ActionForm action={createEngagement} label="Adicionar">
            <Field label="Empresa">
              <select name="companyId" required>
                {companies.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo">
              <select name="kind">
                <option value="product">Produto</option>
                <option value="project">Projeto</option>
              </select>
            </Field>
            <Field label="Nome">
              <input name="name" required maxLength={160} />
            </Field>
            <Field label="Descrição (opcional)">
              <textarea name="description" maxLength={3000} rows={4} />
            </Field>
          </ActionForm>
        ) : (
          <Empty
            title="Cadastre uma empresa primeiro"
            description="Cada produto ou projeto precisa de um cliente vinculado."
          />
        )}
      </section>
    </>
  );
}
