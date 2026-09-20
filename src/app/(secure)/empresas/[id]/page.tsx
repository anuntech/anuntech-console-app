import {
  Archive,
  Building2,
  History,
  Mail,
  MapPin,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Users,
} from "lucide-react";
import styles from "../management.module.css";
import { sendAccessNotice } from "@/lib/email-actions";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { companies, memberships, auditEvents } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import {
  saveMembership,
  revokeMembership,
  updateCompany,
  setCompanyArchived,
} from "@/lib/actions";
import { roleLabels, dateLabel, auditLabels } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { FormModal } from "@/components/form-modal";
export const metadata = {
  title: "Detalhes da empresa",
  description: "Consulte os dados da empresa, contatos e permissões de acesso.",
};
import { Heading, Field, Back, Badge, Empty } from "@/components/ui";
import { CompanyBillingFields } from "@/components/company-billing-fields";
import { addressLabel } from "@/lib/company-billing";
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
        eyebrow="CLIENTES"
        title={company.name}
        description={`${company.document} · ${company.billingEmail}`}
      />
      <div className={styles.stack}>
        {company.archived && (
          <div>
            <Badge status="paused">Cliente arquivado</Badge>
          </div>
        )}
        <section className="panel" aria-label="Resumo do cadastro">
          <dl className={styles.summaryGrid}>
            <div>
              <dt>
                <MapPin size={15} />
                Endereço de cobrança
              </dt>
              <dd>
                {company.billingAddress
                  ? addressLabel(company.billingAddress)
                  : "Endereço ainda não cadastrado."}
              </dd>
            </div>
            <div>
              <dt>
                <Mail size={15} />
                Contato financeiro
              </dt>
              <dd>
                {company.billingEmail}
                <br />
                <span className="muted">
                  {company.phone || "Telefone não informado"}
                </span>
              </dd>
            </div>
            <div>
              <dt>
                <ReceiptText size={15} />
                Nota fiscal automática
              </dt>
              <dd>
                {company.autoIssueNfse
                  ? "Selecionada — integração fiscal pendente"
                  : "Desativada"}
              </dd>
            </div>
          </dl>
        </section>
        <details id="cadastro" className={styles.details}>
          <summary>
            <Pencil size={16} />
            Editar dados da empresa
          </summary>
          <div className={styles.detailsContent}>
            <ActionForm action={updateCompany} label="Salvar dados">
              <input type="hidden" name="id" value={id} />
              <CompanyBillingFields company={company} />
            </ActionForm>
          </div>
        </details>
        <div className={styles.accessLayout}>
          <section className={`panel ${styles.formCard}`}>
            <div className={styles.sectionHeader}>
              <Users size={19} />
              <div>
                <h2>
                  Pessoas com acesso{" "}
                  <span className={styles.count}>
                    {people.filter((p) => p.active).length}
                  </span>
                </h2>
                <p>Permissões e contatos vinculados a esta empresa.</p>
              </div>
            </div>
            {people.length ? (
              people.map((p) => (
                <div key={p.id} className={styles.personRow}>
                  <div className={styles.entity}>
                    <span className={styles.avatar}>
                      <Building2 size={16} />
                    </span>
                    <div>
                      <strong>{p.email}</strong>
                      <small>{roleLabels[p.role]}</small>
                    </div>
                  </div>
                  {p.active ? (
                    <div className="member-actions">
                      <ActionForm
                        action={sendAccessNotice}
                        confirm={{
                          title: "Enviar aviso de acesso?",
                          description: `O aviso de acesso a ${company.name} será enviado para ${p.email}.`,
                        }}
                        label="Enviar aviso de acesso"
                        className="compact-form"
                      >
                        <input type="hidden" name="id" value={p.id} />
                      </ActionForm>
                      <ActionForm
                        action={revokeMembership}
                        confirm={{
                          title: "Revogar este acesso?",
                          description: `${p.email} perderá as permissões de acesso a ${company.name}. Os registros da empresa serão preservados.`,
                        }}
                        label="Revogar"
                        danger
                        className="compact-form"
                      >
                        <input type="hidden" name="id" value={p.id} />
                      </ActionForm>
                    </div>
                  ) : (
                    <div>
                      <Badge status="paused">Revogado</Badge>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <Empty
                headingLevel={3}
                title="Nenhum acesso liberado"
                description="Adicione o e-mail que o cliente usará no Google."
              />
            )}
          </section>
          <section className={`panel ${styles.formCard}`}>
            <div className={styles.sectionHeader}>
              <ShieldCheck size={19} />
              <div>
                <h2>Liberar ou atualizar acesso</h2>
                <p>A permissão se aplica somente a esta empresa.</p>
              </div>
            </div>
            <FormModal
              trigger="Liberar ou atualizar acesso"
              title="Liberar ou atualizar acesso"
              description={`Defina o e-mail e a permissão para ${company.name}. A alteração se aplica somente a esta empresa.`}
              action={saveMembership}
              label="Liberar acesso"
              reset
            >
              <input type="hidden" name="companyId" value={id} />
              <Field label="E-mail Google">
                <input
                  name="email"
                  type="email"
                  placeholder="nome@empresa.com.br"
                  required
                />
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
            </FormModal>
          </section>
        </div>
        <section className={`panel ${styles.formCard}`}>
          <div className={styles.sectionHeader}>
            <History size={19} />
            <div>
              <h2>Histórico administrativo</h2>
              <p>Últimas alterações registradas neste cadastro.</p>
            </div>
          </div>
          {events.length ? (
            <ul className={styles.timeline}>
              {events.map((e) => (
                <li key={e.id}>
                  <span>{auditLabels[e.action] || "Registro atualizado"}</span>
                  <time dateTime={e.createdAt.toISOString()}>
                    {dateLabel(e.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhuma alteração registrada.</p>
          )}
        </section>
        <section className={`panel ${styles.secondaryAction}`}>
          <div>
            <h2>
              <Archive size={16} />{" "}
              {company.archived ? "Restaurar cliente" : "Arquivar cliente"}
            </h2>
            <p>
              {company.archived
                ? "Restaure o cliente para que ele volte à lista principal de empresas."
                : "O cliente sairá da lista principal. O histórico e os acessos serão preservados, e você poderá restaurá-lo em Arquivados."}
            </p>
          </div>
          <ActionForm
            action={setCompanyArchived}
            confirm={{
              title: company.archived
                ? "Restaurar cliente?"
                : "Arquivar cliente?",
              description: company.archived
                ? `${company.name} voltará à lista principal de empresas.`
                : `${company.name} sairá da lista principal. Histórico, acessos e cobranças serão preservados; você poderá restaurar o cadastro depois.`,
            }}
            label={company.archived ? "Restaurar cliente" : "Arquivar cliente"}
          >
            <input type="hidden" name="id" value={id} />
            <input
              type="hidden"
              name="archived"
              value={company.archived ? "no" : "yes"}
            />
          </ActionForm>
        </section>
      </div>
    </>
  );
}
