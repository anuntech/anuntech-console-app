import { CreationModal } from "./creation-modal";
import { requireAdmin, accessibleCompanies } from "@/lib/access";
import { createEngagement } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { Field, Empty } from "@/components/ui";

export async function NewProduct({
  intercepted = false,
}: {
  intercepted?: boolean;
}) {
  const actor = await requireAdmin();
  const companies = await accessibleCompanies(actor);
  return (
    <CreationModal
      title="Adicionar produto ou projeto"
      description="Vincule o trabalho à empresa."
      path="/produtos/novo"
      fallback="/produtos"
      intercepted={intercepted}
    >
      <div className="stack">
        <section className="stack">
          {companies.length ? (
            <ActionForm action={createEngagement} label="Adicionar">
              <section className="form-section">
                <div className="form-grid">
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
                </div>
              </section>
              <section className="form-section">
                <div className="section-heading">
                  <h2>Informações do produto ou projeto</h2>
                </div>
                <div className="stack">
                  <Field label="Nome">
                    <input
                      name="name"
                      required
                      maxLength={160}
                      placeholder="Nome do produto ou projeto"
                    />
                  </Field>
                  <Field
                    label="Descrição (opcional)"
                    hint="Inclua um resumo que ajude o cliente a identificar este trabalho."
                  >
                    <textarea name="description" maxLength={3000} rows={5} />
                  </Field>
                </div>
              </section>
            </ActionForm>
          ) : (
            <Empty
              title="Cadastre uma empresa primeiro"
              description="Cada produto ou projeto precisa de um cliente vinculado."
            />
          )}
        </section>
      </div>
    </CreationModal>
  );
}
