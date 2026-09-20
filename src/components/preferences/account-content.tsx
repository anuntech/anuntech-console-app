import "server-only";
import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { getActor } from "@/lib/access";
import { WhatsappAccount } from "@/components/whatsapp-account";
import styles from "./preferences-content.module.css";

export async function AccountContent() {
  const actor = await getActor();
  return (
    <div className={styles.content}>
      <section className={styles.section}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {actor.user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h2>{actor.user.name}</h2>
            <p>Seus dados de acesso ao Console.</p>
          </div>
        </div>
        <dl className={styles.settingsList}>
          <div className={styles.settingRow}>
            <dt>
              <Mail size={16} aria-hidden="true" /> E-mail de acesso
            </dt>
            <dd>{actor.user.email}</dd>
          </div>
          <div className={styles.settingRow}>
            <dt>
              <UserRound size={16} aria-hidden="true" /> Perfil
            </dt>
            <dd>{actor.admin ? "Equipe Anuntech" : "Portal do cliente"}</dd>
          </div>
        </dl>
        <p className={styles.note}>
          <ShieldCheck size={16} aria-hidden="true" />
          As permissões de cada empresa são gerenciadas pela Anuntech.
        </p>
      </section>
      <WhatsappAccount
        className={styles.whatsapp}
        phone={
          actor.user.phoneNumberVerified ? actor.user.phoneNumber || null : null
        }
      />
    </div>
  );
}
