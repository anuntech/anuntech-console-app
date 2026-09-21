import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { Building2 } from "lucide-react";
import { accountEmails, companies, memberships, user } from "@/db/schema";
import { managedCompanyIds, requireMemberManager } from "@/lib/member-access";
import { db } from "@/lib/db";
import { roleLabels } from "@/lib/format";
import { revokeCompanyMember, saveCompanyMember } from "@/lib/members-actions";
import { ActionForm } from "@/components/action-form";
import { FormModal } from "@/components/form-modal";
import { Badge, Empty, Field } from "@/components/ui";
import { StaffMembersContent } from "./staff-members-content";
import preferences from "./preferences-content.module.css";
import styles from "./members-content.module.css";

function RoleField({ defaultValue = "support" }: { defaultValue?: string }) {
  return (
    <Field
      label="Permissão"
      hint="Atendimento acessa chamados. Financeiro acessa faturas e contratos. Administrador do cliente acessa ambas as áreas e gerencia os membros da empresa."
    >
      <select name="role" defaultValue={defaultValue} required>
        <option value="" disabled>
          Selecione uma permissão
        </option>
        <option value="support">Atendimento</option>
        <option value="finance">Financeiro</option>
        <option value="manager">Administrador do cliente</option>
      </select>
    </Field>
  );
}

export async function MembersContent() {
  const actor = await requireMemberManager();
  if (actor.admin) return <StaffMembersContent actor={actor} />;
  const companyIds = managedCompanyIds(actor);
  const [grants, companyOptions] = await Promise.all([
    db
      .select({
        member: memberships,
        company: companies.name,
        archived: companies.archived,
        userId: user.id,
        name: user.name,
        currentEmail: user.email,
      })
      .from(memberships)
      .innerJoin(companies, eq(companies.id, memberships.companyId))
      .leftJoin(
        accountEmails,
        and(
          eq(accountEmails.email, memberships.email),
          isNotNull(accountEmails.verifiedAt),
        ),
      )
      .leftJoin(
        user,
        or(
          eq(user.email, memberships.email),
          eq(user.id, accountEmails.userId),
        ),
      )
      .where(inArray(memberships.companyId, companyIds))
      .orderBy(
        desc(memberships.active),
        asc(memberships.email),
        asc(companies.name),
      ),
    db
      .select({
        id: companies.id,
        name: companies.name,
        archived: companies.archived,
      })
      .from(companies)
      .where(inArray(companies.id, companyIds))
      .orderBy(asc(companies.name)),
  ]);
  const grantsByPerson = new Map<
    string,
    (typeof grants)[number] & { roles: string[] }
  >();
  for (const entry of grants) {
    const key = `${entry.userId || entry.member.email}:${entry.member.companyId}`;
    const existing = grantsByPerson.get(key);
    if (!existing)
      grantsByPerson.set(key, { ...entry, roles: [entry.member.role] });
    else if (entry.member.active && !existing.roles.includes(entry.member.role))
      existing.roles.push(entry.member.role);
  }
  const clientRows = [...grantsByPerson.values()];
  return (
    <div className={preferences.content}>
      <section className={preferences.section}>
        <div className={preferences.sectionHeading}>
          <h2>Membros da empresa</h2>
          <span>
            {clientRows.filter((row) => row.member.active).length} vínculos
            ativos
          </span>
        </div>
        {clientRows.length ? (
          <ul className={`${preferences.card} ${styles.memberList}`}>
            {clientRows.map(
              ({
                member,
                company,
                archived,
                name,
                currentEmail,
                roles,
                userId,
              }) => (
                <li className={styles.memberRow} key={member.id}>
                  <div className={styles.identity}>
                    <span className={styles.icon}>
                      <Building2 size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{name || currentEmail || member.email}</h3>
                      {name && <p>{currentEmail || member.email}</p>}
                      <p>
                        {company}
                        {archived ? " · Empresa arquivada" : ""}
                      </p>
                      <p className={styles.detail}>
                        {roles.map((role) => roleLabels[role]).join(" + ")}
                        {roles.length > 1 ? " · E-mails vinculados" : ""}
                      </p>
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <Badge status={member.active ? "active" : "paused"}>
                      {member.active ? "Ativo" : "Revogado"}
                    </Badge>
                    {!actor.admin && userId === actor.user.id ? (
                      <p className={styles.protectedAccess}>
                        Seu acesso de administrador
                      </p>
                    ) : (
                      <>
                        <FormModal
                          trigger={
                            member.active
                              ? "Editar permissão"
                              : "Reativar acesso"
                          }
                          triggerAriaLabel={`${member.active ? "Editar permissão" : "Reativar acesso"} de ${currentEmail || member.email} em ${company}`}
                          title={
                            member.active
                              ? "Editar permissão"
                              : "Reativar acesso"
                          }
                          description={`${currentEmail || member.email} — ${company}. A alteração vale somente para esta empresa.`}
                          action={saveCompanyMember}
                          label="Salvar permissão"
                          submitAriaLabel={`Salvar permissão de ${currentEmail || member.email} em ${company}`}
                          triggerClassName={`button ${styles.editButton}`}
                        >
                          <input
                            type="hidden"
                            name="companyId"
                            value={member.companyId}
                          />
                          <input
                            type="hidden"
                            name="email"
                            value={currentEmail || member.email}
                          />
                          <RoleField
                            defaultValue={
                              roles.includes("manager")
                                ? "manager"
                                : roles.length > 1
                                  ? ""
                                  : member.role
                            }
                          />
                        </FormModal>
                        {member.active && (
                          <ActionForm
                            action={revokeCompanyMember}
                            label="Revogar acesso"
                            submitAriaLabel={`Revogar acesso de ${currentEmail || member.email} a ${company}`}
                            danger
                            className={styles.action}
                            confirm={{
                              title: "Revogar acesso à empresa?",
                              description: `${currentEmail || member.email} perderá as permissões de ${company}. Outros vínculos e registros serão preservados.`,
                            }}
                          >
                            <input type="hidden" name="id" value={member.id} />
                          </ActionForm>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
        ) : (
          <div className={preferences.card}>
            <Empty
              headingLevel={3}
              title="Nenhum membro"
              description="Escolha uma empresa e a permissão para liberar o acesso de uma pessoa."
            />
          </div>
        )}
        <p className={preferences.groupNote}>
          Cada permissão vale apenas para a empresa escolhida. Uma pessoa pode
          ter acessos diferentes em várias empresas. Mantenha pelo menos um
          administrador em cada empresa.
          {!actor.admin &&
            " Você não pode revogar ou reduzir seu próprio acesso."}
        </p>
        {companyOptions.length ? (
          <div className={styles.sectionAction}>
            <FormModal
              trigger="Adicionar membro"
              title="Adicionar membro"
              description="Escolha o e-mail, a empresa e a permissão. Um vínculo existente para essa pessoa e empresa será atualizado."
              action={saveCompanyMember}
              label="Liberar acesso"
              reset
            >
              <Field label="E-mail de acesso">
                <input
                  type="email"
                  name="email"
                  autoComplete="off"
                  required
                  maxLength={254}
                  placeholder="nome@empresa.com.br"
                />
              </Field>
              <Field label="Empresa">
                <select name="companyId" required defaultValue="">
                  <option value="" disabled>
                    Selecione a empresa
                  </option>
                  {companyOptions.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                      {company.archived ? " (arquivada)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <RoleField />
              <p className="form-footnote">
                O cadastro libera o acesso. Nenhum convite ou mensagem será
                enviado.
              </p>
            </FormModal>
          </div>
        ) : (
          <p className={preferences.groupNote}>
            Cadastre uma empresa antes de liberar acessos de clientes.
          </p>
        )}
      </section>
    </div>
  );
}
