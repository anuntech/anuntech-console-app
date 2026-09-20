import "server-only";
import { and, asc, desc, eq, isNotNull, or } from "drizzle-orm";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import {
  accountEmails,
  companies,
  consoleStaffMembers,
  memberships,
  user,
} from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { resolveAccountIdentity } from "@/lib/account-identity";
import { getConsoleStaffAccess } from "@/lib/console-members";
import { db } from "@/lib/db";
import { roleLabels } from "@/lib/format";
import {
  revokeCompanyMember,
  revokeConsoleStaffMember,
  saveCompanyMember,
  saveConsoleStaffMember,
} from "@/lib/members-actions";
import { ActionForm } from "@/components/action-form";
import { FormModal } from "@/components/form-modal";
import { Badge, Empty, Field } from "@/components/ui";
import { MemberLoginLink } from "./member-login-link";
import preferences from "./preferences-content.module.css";
import styles from "./members-content.module.css";

function RoleField({ defaultValue = "support" }: { defaultValue?: string }) {
  return (
    <Field
      label="Permissão"
      hint="Atendimento acessa chamados. Financeiro acessa faturas e contratos. Administrador do cliente acessa ambas as áreas."
    >
      <select name="role" defaultValue={defaultValue} required>
        <option value="support">Atendimento</option>
        <option value="finance">Financeiro</option>
        <option value="manager">Administrador do cliente</option>
      </select>
    </Field>
  );
}

export async function MembersContent() {
  const actor = await requireAdmin();
  const { owner } = await getConsoleStaffAccess(actor.user.email);
  const configuredOwner = process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase();
  const [team, grants, companyOptions, ownerIdentity] = await Promise.all([
    db
      .select({
        member: consoleStaffMembers,
        userId: user.id,
        name: user.name,
        currentEmail: user.email,
      })
      .from(consoleStaffMembers)
      .leftJoin(
        accountEmails,
        and(
          eq(accountEmails.email, consoleStaffMembers.email),
          isNotNull(accountEmails.verifiedAt),
        ),
      )
      .leftJoin(
        user,
        or(
          eq(user.email, consoleStaffMembers.email),
          eq(user.id, accountEmails.userId),
        ),
      )
      .orderBy(
        desc(consoleStaffMembers.active),
        asc(consoleStaffMembers.email),
      ),
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
      .orderBy(asc(companies.name)),
    configuredOwner ? resolveAccountIdentity(configuredOwner) : null,
  ]);
  // Older verified addresses belong to the same person, not separate members.
  const teamByPerson = new Map<string, (typeof team)[number]>();
  for (const entry of team) {
    if (
      entry.member.email === configuredOwner ||
      (ownerIdentity?.userId && ownerIdentity.userId === entry.userId)
    )
      continue;
    const key = entry.userId || entry.member.email;
    if (!teamByPerson.has(key)) teamByPerson.set(key, entry);
  }
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
  const staffRows = [...teamByPerson.values()];
  const clientRows = [...grantsByPerson.values()];
  const base = process.env.BETTER_AUTH_URL;
  const loginUrl = base ? new URL("/entrar", base).toString() : null;

  return (
    <div className={preferences.content}>
      <section className={preferences.section}>
        <div className={preferences.sectionHeading}>
          <h2>Equipe Anuntech</h2>
          <span>
            {staffRows.filter((row) => row.member.active).length +
              (configuredOwner ? 1 : 0)}{" "}
            com acesso
          </span>
        </div>
        <ul className={`${preferences.card} ${styles.memberList}`}>
          {configuredOwner && (
            <li className={styles.memberRow}>
              <div className={styles.identity}>
                <span className={styles.icon}>
                  <ShieldCheck size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3>
                    {actor.owner
                      ? actor.user.name
                      : ownerIdentity?.primaryEmail || configuredOwner}
                  </h3>
                  {actor.owner && <p>{actor.user.email}</p>}
                  <p>Proprietário do Console</p>
                  <p className={styles.detail}>
                    Acesso protegido. Somente o proprietário gerencia
                    administradores.
                  </p>
                </div>
              </div>
              <Badge status="active">Proprietário</Badge>
            </li>
          )}
          {staffRows.map(({ member, name, currentEmail }) => (
            <li className={styles.memberRow} key={member.id}>
              <div className={styles.identity}>
                <span className={styles.icon}>
                  <UserRound size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3>{name || currentEmail || member.email}</h3>
                  {name && <p>{currentEmail || member.email}</p>}
                  <p>Administrador do Console</p>
                </div>
              </div>
              <div className={styles.rowActions}>
                <Badge status={member.active ? "active" : "paused"}>
                  {member.active ? "Ativo" : "Revogado"}
                </Badge>
                {owner &&
                  (member.active ? (
                    <ActionForm
                      action={revokeConsoleStaffMember}
                      label="Revogar administração"
                      submitAriaLabel={`Revogar administração de ${currentEmail || member.email}`}
                      danger
                      className={styles.action}
                      confirm={{
                        title: "Revogar administração?",
                        description: `${currentEmail || member.email} perderá o acesso administrativo ao Console. Vínculos específicos com empresas serão preservados.`,
                      }}
                    >
                      <input type="hidden" name="id" value={member.id} />
                    </ActionForm>
                  ) : (
                    <ActionForm
                      action={saveConsoleStaffMember}
                      label="Reativar administração"
                      submitAriaLabel={`Reativar administração de ${currentEmail || member.email}`}
                      className={styles.action}
                      confirm={{
                        title: "Reativar administração?",
                        description: `${currentEmail || member.email} poderá gerenciar clientes, chamados, contratos, cobranças e integrações do Console.`,
                      }}
                    >
                      <input
                        type="hidden"
                        name="email"
                        value={currentEmail || member.email}
                      />
                    </ActionForm>
                  ))}
              </div>
            </li>
          ))}
        </ul>
        <p className={preferences.groupNote}>
          Administradores gerenciam a operação de todas as empresas. Eles não
          podem conceder administração do Console a outras pessoas.
        </p>
        {owner && (
          <div className={styles.sectionAction}>
            <FormModal
              trigger="Adicionar administrador"
              title="Adicionar administrador"
              description="A pessoa terá acesso administrativo a todas as empresas, incluindo cobranças e integrações. Somente você poderá gerenciar esse acesso."
              action={saveConsoleStaffMember}
              label="Liberar administração"
              reset
            >
              <Field label="E-mail de acesso">
                <input
                  type="email"
                  name="email"
                  autoComplete="off"
                  required
                  maxLength={254}
                  placeholder="nome@anuntech.com"
                />
              </Field>
              <p className="form-footnote">
                O cadastro libera o acesso. Nenhum convite ou mensagem será
                enviado.
              </p>
            </FormModal>
          </div>
        )}
      </section>
      <section className={preferences.section}>
        <div className={preferences.sectionHeading}>
          <h2>Acessos de clientes</h2>
          <span>
            {clientRows.filter((row) => row.member.active).length} vínculos
            ativos
          </span>
        </div>
        {clientRows.length ? (
          <ul className={`${preferences.card} ${styles.memberList}`}>
            {clientRows.map(
              ({ member, company, archived, name, currentEmail, roles }) => (
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
                    <FormModal
                      trigger={
                        member.active ? "Editar permissão" : "Reativar acesso"
                      }
                      triggerAriaLabel={`${member.active ? "Editar permissão" : "Reativar acesso"} de ${currentEmail || member.email} em ${company}`}
                      title={
                        member.active ? "Editar permissão" : "Reativar acesso"
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
                          roles.length > 1 ? "manager" : member.role
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
                  </div>
                </li>
              ),
            )}
          </ul>
        ) : (
          <div className={preferences.card}>
            <Empty
              headingLevel={3}
              title="Nenhum acesso de cliente"
              description="Escolha uma empresa e a permissão para liberar o acesso de uma pessoa."
            />
          </div>
        )}
        <p className={preferences.groupNote}>
          Cada permissão vale apenas para a empresa escolhida. Uma pessoa pode
          ter acessos diferentes em várias empresas.
        </p>
        {companyOptions.length ? (
          <div className={styles.sectionAction}>
            <FormModal
              trigger="Adicionar acesso de cliente"
              title="Adicionar acesso de cliente"
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
      {loginUrl && (
        <section className={preferences.section}>
          <div className={preferences.sectionHeading}>
            <h2>Compartilhar acesso</h2>
          </div>
          <div className={`${preferences.card} ${styles.shareCard}`}>
            <p>
              A pessoa deve entrar com o e-mail autorizado e solicitar um código
              de acesso ou usar o Google. O link, sozinho, não concede
              permissões.
            </p>
            <MemberLoginLink url={loginUrl} />
          </div>
        </section>
      )}
    </div>
  );
}
