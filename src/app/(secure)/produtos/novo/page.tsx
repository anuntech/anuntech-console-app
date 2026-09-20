import type { Metadata } from "next";
import { Boxes, Building2 } from "lucide-react";
import { requireAdmin, accessibleCompanies } from "@/lib/access";
import { createEngagement } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { Heading, Field, Back, Empty } from "@/components/ui";
import styles from "../../empresas/management.module.css";
export const metadata: Metadata = {
  title: "Adicionar produto ou projeto",
  description:
    "Vincule um produto ou projeto ao cliente e descreva o trabalho.",
};

export default async function NewProduct() {
  const actor = await requireAdmin();
  const companies = await accessibleCompanies(actor);
  return (
    <>
      <Back href="/produtos" label="Produtos e projetos" />
      <Heading
        eyebrow="RELACIONAMENTO"
        title="Adicionar produto ou projeto"
        description="Organize o trabalho da Anuntech e mantenha cada entrega vinculada ao cliente."
      />
      <div className={styles.formShell}>
        <section className={`panel ${styles.formCard}`}>
          {companies.length ? (
            <ActionForm action={createEngagement} label="Adicionar">
              <section className="form-section">
                <div className={styles.sectionHeader}>
                  <Building2 size={19} aria-hidden="true" />
                  <div>
                    <h2>Vínculo com o cliente</h2>
                    <p>Escolha a empresa e a categoria deste relacionamento.</p>
                  </div>
                </div>
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
        <aside className={styles.helpCard}>
          <span className={styles.helpIcon}>
            <Boxes size={19} aria-hidden="true" />
          </span>
          <h2>Um lugar para cada trabalho</h2>
          <p>
            Produtos e projetos ajudam a organizar o relacionamento e a
            identificar o contexto dos chamados.
          </p>
          <p>
            Você poderá atualizar a situação para ativo, pausado ou concluído na
            lista.
          </p>
        </aside>
      </div>
    </>
  );
}
