import { requireAdmin, accessibleCompanies } from "@/lib/access";
import { createContract } from "@/lib/contract-actions";
import { ActionForm } from "@/components/action-form";
import { Heading, Back, Field, Empty } from "@/components/ui";
export default async function NewContract() {
  const actor = await requireAdmin();
  const companies = await accessibleCompanies(actor);
  return (
    <>
      <Back href="/contratos" label="Contratos" />
      <Heading
        title="Criar contrato"
        description="Escreva o contrato e salve um rascunho antes de publicar."
      />
      <section className="panel padded">
        {companies.length ? (
          <ActionForm action={createContract} label="Salvar rascunho">
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
            <p className="muted">
              O rascunho fica visível somente para a administração.
            </p>
          </ActionForm>
        ) : (
          <Empty
            title="Cadastre um cliente primeiro"
            description="O contrato precisa estar vinculado a uma empresa."
          />
        )}
      </section>
    </>
  );
}
