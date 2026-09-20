import "server-only";
import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { getActor } from "@/lib/access";
import { WhatsappAccount } from "@/components/whatsapp-account";
import styles from "./preferences-content.module.css";

export async function AccountContent() {
  const actor = await getActor();
  const initials = actor.user.name
    .trim()
    .split(/\s+/)
    .filter((_, index, names) => index === 0 || index === names.length - 1)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
  return (
    <div className={styles.content}>
      <section className={styles.profile}>
        <span className={styles.profileAvatar} aria-hidden="true">
          {initials || "?"}
        </span>
        <h2>{actor.user.name}</h2>
        <p>{actor.user.email}</p>
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
            <dd>{actor.user.name}</dd>
          </div>
          <div className={styles.settingRow}>
            <dt>
              <Mail size={17} aria-hidden="true" /> E-mail de acesso
            </dt>
            <dd>{actor.user.email}</dd>
          </div>
          <div className={styles.settingRow}>
            <dt>
              <ShieldCheck size={17} aria-hidden="true" /> Perfil
            </dt>
            <dd>{actor.admin ? "Equipe Anuntech" : "Portal do cliente"}</dd>
          </div>
        </dl>
        <p className={styles.note}>
          <ShieldCheck size={16} aria-hidden="true" />
          As permissões de cada empresa são gerenciadas pela Anuntech.
        </p>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Acesso e segurança</h2>
        </div>
        <div className={styles.card}>
          <dl className={styles.settingsList}>
            <div className={styles.settingRow}>
              <dt>
                <Mail size={17} aria-hidden="true" /> E-mail
              </dt>
              <dd>Código de acesso</dd>
            </div>
          </dl>
          <WhatsappAccount
            className={styles.whatsapp}
            headingLevel={3}
            phone={
              actor.user.phoneNumberVerified
                ? actor.user.phoneNumber || null
                : null
            }
          />
        </div>
      </section>
    </div>
  );
}
