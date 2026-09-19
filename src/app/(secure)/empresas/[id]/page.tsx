import { sendAccessNotice } from "@/lib/email-actions";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { companies, memberships, auditEvents } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { saveMembership, revokeMembership, updateCompany } from "@/lib/actions";
import { roleLabels, dateLabel, auditLabels } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { Heading, Field, Back, Badge, Empty } from "@/components/ui";
export default async function Company({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id));
  if (!company) notFound();
  const [people, events] = await Promise.all([
    db
      .select()
      .from(memberships)
      .where(eq(memberships.companyId, id))
      .orderBy(memberships.email),
    db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.companyId, id))
      .orderBy(desc(auditEvents.createdAt))
      .limit(15),
  ]);
  return (
    <>
      <Back href="/empresas" label="Empresas" />
      <Heading
        title={company.name}
        description={`${company.document} · ${company.billingEmail}`}
      />
      <details className="panel padded edit-details">
        <summary>Editar dados da empresa</summary>
        <ActionForm action={updateCompany} label="Salvar dados">
          <input type="hidden" name="id" value={id} />
          <Field label="Nome ou razão social">
            <input
              name="name"
              required
              maxLength={160}
              defaultValue={company.name}
            />
          </Field>
          <Field label="E-mail financeiro">
            <input
              name="billingEmail"
              type="email"
              required
              defaultValue={company.billingEmail}
            />
          </Field>
          <Field label="Telefone">
            <input
              name="phone"
              type="tel"
              maxLength={30}
              defaultValue={company.phone || ""}
            />
          </Field>
        </ActionForm>
      </details>
      <div className="two-columns">
        <section className="panel padded">
          <h2>Pessoas com acesso</h2>
          {people.length ? (
            people.map((p) => (
              <div key={p.id} className="person">
                <div>
                  <strong>{p.email}</strong>
                  <small>{roleLabels[p.role]}</small>
                </div>
                {p.active ? (
                  <div className="member-actions">
                    <ActionForm
                      action={sendAccessNotice}
                      label="Enviar aviso de acesso"
                      className="compact-form"
                    >
                      <input type="hidden" name="id" value={p.id} />
                    </ActionForm>
                    <ActionForm
                      action={revokeMembership}
                      label="Revogar"
                      danger
                      className="compact-form"
                    >
                      <input type="hidden" name="id" value={p.id} />
                    </ActionForm>
                  </div>
                ) : (
                  <Badge>Revogado</Badge>
                )}
              </div>
            ))
          ) : (
            <Empty
              title="Nenhum acesso liberado"
              description="Adicione o e-mail que o cliente usará no Google."
            />
          )}
        </section>
        <section className="panel padded">
          <h2>Liberar ou atualizar acesso</h2>
          <p className="muted">A permissão se aplica somente a esta empresa.</p>
          <ActionForm action={saveMembership} label="Liberar acesso" reset>
            <input type="hidden" name="companyId" value={id} />
            <Field label="E-mail Google">
              <input name="email" type="email" required />
            </Field>
            <Field label="Permissão">
              <select name="role" defaultValue="support">
                <option value="support">Atendimento</option>
                <option value="finance">Financeiro</option>
                <option value="manager">
                  Administrador do cliente (ambas as áreas)
                </option>
              </select>
            </Field>
          </ActionForm>
        </section>
      </div>
      <section className="panel padded section-gap">
        <h2>Histórico administrativo</h2>
        <ul className="audit-list">
          {events.map((e) => (
            <li key={e.id}>
              <span>{auditLabels[e.action] || "Registro atualizado"}</span>
              <time>{dateLabel(e.createdAt)}</time>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
