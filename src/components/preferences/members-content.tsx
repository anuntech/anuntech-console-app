import "server-only";
import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import { UserRound } from "lucide-react";
import { accountEmails, memberships, user } from "@/db/schema";
import { settingsEnvironment } from "@/lib/environment";
import { db } from "@/lib/db";
import { isCatalogAvatar } from "@/lib/avatar-catalog";
import { revokeCompanyMember, saveCompanyMember } from "@/lib/members-actions";
import { ActionForm } from "@/components/action-form";
import { FormModal } from "@/components/form-modal";
import { Badge, Empty, Field } from "@/components/ui";
import { StaffMembersContent } from "./staff-members-content";
import { MemberTabs } from "./member-tabs";
import { IllustratedAvatar } from "./illustrated-avatar";
import preferences from "./preferences-content.module.css";
import styles from "./members-content.module.css";
const labels: Record<string, string> = {
  manager: "Administrador",
  support: "Atendimento",
  finance: "Financeiro",
};
function RoleField({ defaultValue = "manager" }: { defaultValue?: string }) {
  return (
    <Field label="Permissão">
      <select name="role" defaultValue={defaultValue} required>
        <option value="" disabled>
          Selecione uma permissão
        </option>
        <option value="manager">Administrador</option>
        <option value="support">Atendimento</option>
        <option value="finance">Financeiro</option>
      </select>
    </Field>
  );
}
export async function MembersContent() {
  const { actor, companyId } = await settingsEnvironment();
  if (actor.admin) return <StaffMembersContent actor={actor} />;
  const entries = await db
    .select({
      member: memberships,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      verified: user.emailVerified,
    })
    .from(memberships)
    .leftJoin(
      accountEmails,
      and(
        eq(accountEmails.email, memberships.email),
        isNotNull(accountEmails.verifiedAt),
      ),
    )
    .leftJoin(
      user,
      or(eq(user.email, memberships.email), eq(user.id, accountEmails.userId)),
    )
    .where(
      and(eq(memberships.companyId, companyId!), eq(memberships.active, true)),
    )
    .orderBy(asc(memberships.email));
  const unique = new Map<
    string,
    (typeof entries)[number] & { roles: string[] }
  >();
  for (const row of entries) {
    const key = row.userId || row.member.email;
    const current = unique.get(key);
    if (!current) unique.set(key, { ...row, roles: [row.member.role] });
    else if (!current.roles.includes(row.member.role))
      current.roles.push(row.member.role);
  }
  const rows = [...unique.values()],
    members = rows.filter((row) => row.userId && row.verified),
    invited = rows.filter((row) => !row.userId || !row.verified);
  const list = (items: typeof rows, pending = false) =>
    items.length ? (
      <ul className={`${preferences.card} ${styles.memberList}`}>
        {items.map(({ member, userId, name, email, image, roles }) => (
          <li key={member.id} className={styles.memberRow}>
            <div className={styles.identity}>
              <span className={styles.personAvatar}>
                {image && isCatalogAvatar(image) ? (
                  <IllustratedAvatar image={image} size={40} />
                ) : (
                  <UserRound size={20} />
                )}
              </span>
              <div>
                <h3>
                  {name || email || member.email}
                  {userId === actor.user.id ? " (você)" : ""}
                </h3>
                {name && <p>{email || member.email}</p>}
                <p className={styles.detail}>
                  {pending
                    ? "Aguardando primeiro acesso"
                    : roles.map((role) => labels[role]).join(" + ")}
                </p>
              </div>
            </div>
            <div className={styles.rowActions}>
              {userId === actor.user.id ? (
                <Badge status="active">Administrador</Badge>
              ) : (
                <>
                  {!pending && (
                    <FormModal
                      trigger="Editar permissão"
                      title="Editar permissão"
                      description={email || member.email}
                      action={saveCompanyMember}
                      label="Salvar permissão"
                      submitAriaLabel={`Salvar permissão de ${email || member.email} em ${actor.grants.find((grant) => grant.company.id === companyId)?.company.name}`}
                      triggerClassName={`button ${styles.editButton}`}
                    >
                      <input
                        type="hidden"
                        name="companyId"
                        value={companyId!}
                      />
                      <input
                        type="hidden"
                        name="email"
                        value={email || member.email}
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
                  )}
                  <ActionForm
                    action={revokeCompanyMember}
                    label={pending ? "Cancelar convite" : "Expulsar"}
                    submitAriaLabel={`${pending ? "Cancelar convite" : "Expulsar"} de ${email || member.email}`}
                    danger
                    className={styles.action}
                    confirm={{
                      title: pending ? "Cancelar convite?" : "Expulsar membro?",
                      description: `${email || member.email} perderá o acesso ao ambiente.`,
                      confirmLabel: pending ? "Cancelar convite" : "Expulsar",
                    }}
                  >
                    <input type="hidden" name="id" value={member.id} />
                  </ActionForm>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <div className={preferences.card}>
        <Empty
          headingLevel={3}
          title={pending ? "Nenhum convite pendente" : "Nenhum membro"}
          description={
            pending
              ? "As pessoas convidadas aparecerão aqui até o primeiro acesso."
              : "Convide uma pessoa para seu ambiente."
          }
        />
      </div>
    );
  return (
    <div className={preferences.content}>
      <MemberTabs
        memberCount={members.length}
        invitedCount={invited.length}
        members={list(members)}
        invited={list(invited, true)}
        action={
          <FormModal
            trigger="Convidar pessoa"
            title="Convidar pessoa"
            description="Adicione uma pessoa ao seu ambiente."
            action={saveCompanyMember}
            label="Adicionar"
            reset
          >
            <input type="hidden" name="companyId" value={companyId!} />
            <Field label="E-mail">
              <input
                type="email"
                name="email"
                required
                maxLength={254}
                autoComplete="off"
                placeholder="nome@empresa.com.br"
              />
            </Field>
            <RoleField />
            <p className="form-footnote">
              Um e-mail de convite é enviado automaticamente para essa pessoa
              entrar.
            </p>
          </FormModal>
        }
      />
    </div>
  );
}
