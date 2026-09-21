import "server-only";
import { getActor } from "@/lib/access";
import { WhatsappAccount } from "@/components/whatsapp-account";
import { SecuritySettings } from "@/components/security-settings";
import { AccountEmails } from "./account-emails";
import { ProfileAvatar } from "./profile-avatar";
import { AccountName } from "./account-name";
import styles from "./preferences-content.module.css";

export async function AccountContent() {
  const actor = await getActor();
  const enabled = actor.user.twoFactorEnabled === true;
  const phone = actor.user.phoneNumberVerified
    ? actor.user.phoneNumber || null
    : null;
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
        <div className={styles.card}>
          <AccountName name={actor.user.name} />
          <AccountEmails
            primaryEmail={actor.user.email}
            securityEnabled={enabled}

          />
          <WhatsappAccount phone={phone} securityEnabled={enabled} />
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
