import { FileText, LockKeyhole } from "lucide-react";
import { requireAdmin, accessibleCompanies } from "@/lib/access";
import { createContract } from "@/lib/contract-actions";
import { ActionForm } from "@/components/action-form";
import { Heading, Back, Field, Empty } from "@/components/ui";
import styles from "../../empresas/management.module.css";
export default async function NewContract() {
  const actor = await requireAdmin();
  const companies = await accessibleCompanies(actor);
  return (
    <>
      <Back href="/contratos" label="Contratos" />
      <Heading
        eyebrow="DOCUMENTOS"
        title="Criar contrato"
        description="Prepare o documento, salve o rascunho e publique depois da revisão."
      />
      <div className={styles.formShell}>
        <section className={`panel ${styles.formCard}`}>
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
        <aside className={styles.aside}>
          <section className={styles.helpCard}>
            <span className={styles.helpIcon}>
              <LockKeyhole size={19} />
            </span>
            <h2>Seu rascunho é privado</h2>
            <p>
              O rascunho fica visível somente para a administração. O cliente
              terá acesso depois que você revisar e publicar.
            </p>
          </section>
          <section className={styles.helpCard}>
            <span className={styles.helpIcon}>
              <FileText size={19} />
            </span>
            <h2>Documento pronto para consulta</h2>
            <p>
              Após a publicação, o cliente poderá ler o contrato no Console e
              baixar a versão em PDF.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
