import { CreationModal } from "./creation-modal";
import { requireAdmin, accessibleCompanies } from "@/lib/access";
import { createContract } from "@/lib/contract-actions";
import { ActionForm } from "@/components/action-form";
import { Field, Empty } from "@/components/ui";

export async function NewContract({
  intercepted = false,
}: {
  intercepted?: boolean;
}) {
  const actor = await requireAdmin();
  const companies = await accessibleCompanies(actor);
  return (
    <CreationModal
      title="Criar contrato"
      description="Prepare o documento para revisão."
      path="/contratos/novo"
      fallback="/contratos"
      intercepted={intercepted}
    >
      <div className="stack">
        <section className="stack">
          {companies.length ? (
            <ActionForm action={createContract} label="Salvar rascunho">
              <section className="form-section">
                <div className="section-heading">
                  <h2>Identificação do contrato</h2>
                  <p className="muted">
                    Selecione o cliente e dê um título ao documento.
                  </p>
                </div>
                <div className="stack">
                  <Field label="Cliente">
                    <select name="companyId" required defaultValue="">
                      <option value="" disabled>
                        Selecione
                      </option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Título">
                    <input
                      name="title"
                      maxLength={160}
                      required
                      placeholder="Ex.: Contrato de prestação de serviços"
                    />
                  </Field>
                </div>
              </section>
              <section className="form-section">
                <Field
                  label="Texto do contrato"
                  hint="Texto simples, com as cláusulas e quebras de linha que você escrever. Até 100 mil caracteres."
                >
                  <textarea
                    name="body"
                    className="contract-editor"
                    rows={24}
                    maxLength={100000}
                    required
                  />
                </Field>
              </section>
            </ActionForm>
          ) : (
            <Empty
              title="Cadastre um cliente primeiro"
              description="O contrato precisa estar vinculado a uma empresa."
            />
          )}
        </section>
      </div>
    </CreationModal>
  );
}
