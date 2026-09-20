import { Brand } from "@/components/brand";
import { SecurityChallenge } from "@/components/security-challenge";
import styles from "@/components/auth.module.css";
export const metadata = {
  title: "Confirmar acesso",
  robots: { index: false, follow: false },
};
export default function VerifyAccessPage() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <section className={styles.brandPanel} aria-label="Anuntech Console">
        <Brand />
        <div className={styles.intro}>
          <h2>Uma confirmação a mais para proteger sua conta.</h2>
          <p>Use o código recebido no seu outro contato verificado.</p>
        </div>
        <span className={styles.caption}>Anuntech · Portal do cliente</span>
      </section>
      <section
        className={styles.formPanel}
        aria-labelledby="verification-title"
      >
        <div className={styles.formCard}>
          <p className={styles.eyebrow}>SEGURANÇA DA CONTA</p>
          <h1 id="verification-title">Confirme seu acesso</h1>
          <SecurityChallenge />
        </div>
      </section>
    </main>
  );
}
