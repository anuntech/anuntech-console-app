import "server-only";
import { getActor } from "@/lib/access";
import { WhatsappAccount } from "@/components/whatsapp-account";
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
      <section className={styles.section}>
        <div className={`${styles.card} ${styles.accountCard}`}>
          <div className={styles.accountPhoto}>
            <span className={styles.accountPhotoLabel}>Foto de perfil</span>
            <div className={styles.accountPhotoControl}>
              <ProfileAvatar
                name={actor.user.name}
                image={actor.user.image ?? null}
              />
            </div>
          </div>
          <div className={styles.accountFields}>
            <AccountName name={actor.user.name} />
            <AccountEmails
              primaryEmail={actor.user.email}
              securityEnabled={enabled}
            />
            <WhatsappAccount phone={phone} securityEnabled={enabled} />
          </div>
        </div>
      </section>
    </div>
  );
}
