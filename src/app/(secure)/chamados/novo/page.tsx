import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { engagements } from "@/db/schema";
import { getActor, accessibleCompanies } from "@/lib/access";
import { createTicket } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { CompanyPicker } from "@/components/company-picker";
import { Heading, Field, Back, Empty } from "@/components/ui";
import { MessagesSquare, Paperclip } from "lucide-react";
export const metadata: Metadata = {
  title: "Abrir chamado",
  description: "Envie uma solicitação de atendimento vinculada à sua empresa.",
};

export default async function NewTicket() {
  const actor = await getActor();
  const companies = await accessibleCompanies(actor, "support");
  const items = companies.length
    ? await db
        .select()
        .from(engagements)
        .where(
          inArray(
            engagements.companyId,
            companies.map((c) => c.id),
          ),
        )
    : [];
  return (
    <>
      <Back href="/chamados" label="Chamados" />
      <Heading
        title="Abrir chamado"
        description="Conte o que aconteceu e como podemos ajudar."
      />
      <div className="guided-form-layout">
        <section className="panel form-panel">
          <div className="form-intro">
            <MessagesSquare size={20} aria-hidden="true" />
            <div>
              <h2>Detalhes da solicitação</h2>
              <p>Selecione a empresa e descreva o que precisa.</p>
            </div>
          </div>
          {companies.length ? (
            <ActionForm action={createTicket} label="Abrir chamado">
              <section className="form-section">
                <h3>Empresa e produto</h3>
                <CompanyPicker companies={companies} engagements={items} />
              </section>
              <section className="form-section">
                <h3>Como podemos ajudar?</h3>
                <Field label="Assunto">
                  <input
                    name="subject"
                    required
                    maxLength={160}
                    placeholder="Um resumo da sua solicitação"
                  />
                </Field>
                <Field label="Prioridade">
                  <select name="priority">
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                  </select>
                </Field>
                <Field label="Descrição">
                  <textarea
                    name="body"
                    required
                    maxLength={10000}
                    rows={7}
                    placeholder="Descreva o que aconteceu, em qual tela e o resultado que esperava."
                  />
                </Field>
              </section>
              <p className="form-footnote">
                Você poderá adicionar arquivos depois de abrir o chamado.
              </p>
            </ActionForm>
          ) : (
            <Empty
              headingLevel={3}
              title="Nenhuma empresa disponível"
              description="É necessário ter permissão de atendimento em uma empresa."
            />
          )}
        </section>
        <aside className="context-card">
          <Paperclip size={21} aria-hidden="true" />
          <h2>Para agilizar o atendimento</h2>
          <p>
            Inclua o contexto e os passos para encontrar o problema. Isso ajuda
            a equipe a entender a solicitação.
          </p>
          <p>
            Depois de abrir o chamado, você poderá adicionar imagens e
            documentos à conversa.
          </p>
        </aside>
      </div>
    </>
  );
}
