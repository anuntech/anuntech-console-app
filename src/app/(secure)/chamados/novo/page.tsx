import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { engagements } from "@/db/schema";
import { getActor, accessibleCompanies } from "@/lib/access";
import { createTicket } from "@/lib/actions";
import { ActionForm } from "@/components/action-form";
import { CompanyPicker } from "@/components/company-picker";
import { Heading, Field, Back, Empty } from "@/components/ui";
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
      <section className="panel form-panel">
        {companies.length ? (
          <ActionForm action={createTicket} label="Abrir chamado">
            <CompanyPicker companies={companies} engagements={items} />
            <Field label="Assunto">
              <input name="subject" required maxLength={160} />
            </Field>
            <Field label="Prioridade">
              <select name="priority">
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
              </select>
            </Field>
            <Field label="Descrição">
              <textarea name="body" required maxLength={10000} rows={7} />
            </Field>
            <p className="muted">
              Você poderá adicionar arquivos depois de abrir o chamado.
            </p>
          </ActionForm>
        ) : (
          <Empty
            title="Nenhuma empresa disponível"
            description="É necessário ter permissão de atendimento em uma empresa."
          />
        )}
      </section>
    </>
  );
}
