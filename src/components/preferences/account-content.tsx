import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { ShieldCheck, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { accountEmails } from "@/db/schema";
import { getActor } from "@/lib/access";
import { updateAccountName } from "@/lib/account-actions";
import { FormModal } from "@/components/form-modal";
import { Field } from "@/components/ui";
import { WhatsappAccount } from "@/components/whatsapp-account";
import { SecuritySettings } from "@/components/security-settings";
import { AccountEmails } from "./account-emails";
import { ProfileAvatar } from "./profile-avatar";
import styles from "./preferences-content.module.css";

export async function AccountContent() {
  const actor = await getActor();
  const contacts = await db
    .select()
    .from(accountEmails)
    .where(
      and(
        eq(accountEmails.userId, actor.user.id),
        isNotNull(accountEmails.verifiedAt),
      ),
    );
  const enabled = actor.user.twoFactorEnabled === true;
  const phone = actor.user.phoneNumberVerified
    ? actor.user.phoneNumber || null
    : null;
  const ownerEmail = process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase();
  return (
    <div className={styles.content}>
      <section className={styles.profile} aria-label="Seu perfil">
        <ProfileAvatar name={actor.user.name} image={actor.user.image ?? null}>
          <h2>{actor.user.name}</h2>
          <p>{actor.user.email}</p>
        </ProfileAvatar>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Informações pessoais</h2>
        </div>
        <dl className={`${styles.card} ${styles.settingsList}`}>
          <div className={styles.settingRow}>
            <dt>
              <UserRound size={17} aria-hidden="true" /> Nome
            </dt>
            <dd className={styles.nameEdit}>
              <span>{actor.user.name}</span>
              <FormModal
                trigger="Editar"
                triggerAriaLabel="Editar nome"
                title="Editar nome"
                description="Como você deseja aparecer no Console."
                action={updateAccountName}
                label="Salvar nome"
              >
                <Field label="Nome">
                  <input
                    name="name"
                    autoComplete="name"
                    defaultValue={actor.user.name}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </Field>
              </FormModal>
            </dd>
          </div>
          <div className={styles.settingRow}>
            <dt>
              <ShieldCheck size={17} aria-hidden="true" /> Perfil
            </dt>
            <dd>
              {actor.owner
                ? "Proprietário do Console"
                : actor.admin
                  ? "Equipe Anuntech"
                  : "Portal do cliente"}
            </dd>
          </div>
        </dl>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>E-mails e número de telefone</h2>
        </div>
        <div className={styles.card}>
          <AccountEmails
            primaryEmail={actor.user.email}
            securityEnabled={enabled}
            emails={contacts.map((contact) => ({
              id: contact.id,
              email: contact.email,
              protected: contact.email === ownerEmail,
            }))}
          />
          <WhatsappAccount
            className={styles.whatsapp}
            headingLevel={3}
            phone={phone}
            securityEnabled={enabled}
          />
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Acesso e segurança</h2>
        </div>
        <SecuritySettings
          enabled={enabled}
          channel={actor.user.twoStepChannel === "email" ? "email" : "whatsapp"}
          email={actor.user.email}
          phone={phone}
        />
      </section>
    </div>
  );
}
