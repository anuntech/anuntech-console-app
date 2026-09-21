import "server-only";
import { IllustratedAvatar } from "./illustrated-avatar";
import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import { UserRound } from "lucide-react";
import { accountEmails, consoleStaffMembers, user } from "@/db/schema";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/access";
import { resolveAccountIdentity } from "@/lib/account-identity";
import { isCatalogAvatar } from "@/lib/avatar-catalog";
import {
  revokeConsoleStaffMember,
  saveConsoleStaffMember,
} from "@/lib/members-actions";
import { ActionForm } from "@/components/action-form";
import { FormModal } from "@/components/form-modal";
import { Badge, Empty, Field } from "@/components/ui";
import { MemberTabs } from "./member-tabs";
import preferences from "./preferences-content.module.css";
import styles from "./members-content.module.css";

export async function StaffMembersContent({ actor }: { actor: Actor }) {
  const configuredOwner = process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase();
  const ownerIdentity = configuredOwner
    ? await resolveAccountIdentity(configuredOwner)
    : null;
  const [ownerUser] = ownerIdentity?.userId
    ? await db
        .select({ name: user.name, image: user.image })
        .from(user)
        .where(eq(user.id, ownerIdentity.userId))
    : [];
  const entries = await db
    .select({
      member: consoleStaffMembers,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      verified: user.emailVerified,
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
    .where(eq(consoleStaffMembers.active, true))
    .orderBy(asc(consoleStaffMembers.email));
  const unique = new Map<string, (typeof entries)[number]>();
  for (const entry of entries) {
    if (
      entry.member.email === configuredOwner ||
      (ownerIdentity?.userId && entry.userId === ownerIdentity.userId)
    )
      continue;
    const key = entry.userId || entry.member.email;
    if (!unique.has(key)) unique.set(key, entry);
  }
  const rows = [...unique.values()];
  const members = rows.filter((row) => row.userId && row.verified);
  const invited = rows.filter((row) => !row.userId || !row.verified);
  const portrait = (image: string | null | undefined) => (
    <span className={styles.personAvatar}>
      {isCatalogAvatar(image) && image ? (
        <IllustratedAvatar image={image} size={40} />
      ) : (
        <UserRound size={20} aria-hidden="true" />
      )}
    </span>
  );
  function list(items: typeof rows, pending = false) {
    return (
      <ul className={`${preferences.card} ${styles.memberList}`}>
        {!pending && configuredOwner && (
          <li className={styles.memberRow}>
            <div className={styles.identity}>
              {portrait(ownerUser?.image)}
              <div>
                <h3>
                  {ownerUser?.name ||
                    ownerIdentity?.primaryEmail ||
                    configuredOwner}
                  {actor.owner ? " (você)" : ""}
                </h3>
                <p>{ownerIdentity?.primaryEmail || configuredOwner}</p>
              </div>
            </div>
            <Badge status="active">Proprietário</Badge>
          </li>
        )}
        {items.map(({ member, name, email, image }) => (
          <li key={member.id} className={styles.memberRow}>
            <div className={styles.identity}>
              {portrait(image)}
              <div>
                <h3>{name || email || member.email}</h3>
                {name && <p>{email || member.email}</p>}
                <p className={styles.detail}>
                  {pending ? "Aguardando primeiro acesso" : "Administrador"}
                </p>
              </div>
            </div>
            {actor.owner && (
              <ActionForm
                action={revokeConsoleStaffMember}
                label={pending ? "Cancelar convite" : "Expulsar"}
                submitAriaLabel={`${pending ? "Cancelar convite" : "Expulsar"} de ${email || member.email}`}
                danger
                className={styles.action}
                confirm={{
                  title: pending ? "Cancelar convite?" : "Expulsar membro?",
                  description: `${email || member.email} perderá o acesso ao ambiente Anuntech.`,
                  confirmLabel: pending ? "Cancelar convite" : "Expulsar",
                }}
              >
                <input type="hidden" name="id" value={member.id} />
              </ActionForm>
            )}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className={preferences.content}>
      <MemberTabs
        action={
          actor.owner && (
            <FormModal
              trigger="Convidar pessoa"
              triggerClassName="button primary"
              title="Convidar pessoa"
              description="A pessoa terá acesso de administrador ao ambiente Anuntech."
              action={saveConsoleStaffMember}
              label="Adicionar"
              reset
            >
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
              <p className="form-footnote">
                Acesso liberado por e-mail, sem envio automático de convite.
              </p>
            </FormModal>
          )
        }
        memberCount={members.length + (configuredOwner ? 1 : 0)}
        invitedCount={invited.length}
        members={list(members)}
        invited={
          invited.length ? (
            list(invited, true)
          ) : (
            <div className={preferences.card}>
              <Empty
                headingLevel={3}
                title="Nenhum convite pendente"
                description="As pessoas convidadas aparecerão aqui até o primeiro acesso."
              />
            </div>
          )
        }
      />
    </div>
  );
}
