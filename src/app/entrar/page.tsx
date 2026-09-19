import { Notification } from "@/components/notifications";
import { OtpLogin } from "@/components/otp-login";
import { Brand } from "@/components/brand";
import { FileText, Headphones, Layers3, LockKeyhole } from "lucide-react";
import styles from "@/components/auth.module.css";
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className={styles.page}>
      <section className={styles.brandPanel} aria-label="Anuntech Console">
        <Brand />
        <div className={styles.intro}>
          <p className={styles.eyebrow}>SEU ESPAÇO NA ANUNTECH</p>
          <h2>
            Tudo que conecta sua empresa à <span>Anuntech.</span>
          </h2>
          <p>
            Acompanhe seus serviços, converse com a equipe e organize seus
            pagamentos em um só lugar.
          </p>
          <ul className={styles.features}>
            <li>
              <Layers3 size={18} aria-hidden="true" /> Produtos e serviços da
              sua empresa
            </li>
            <li>
              <Headphones size={18} aria-hidden="true" /> Atendimento perto de
              você
            </li>
            <li>
              <FileText size={18} aria-hidden="true" /> Faturas e contratos
              organizados
            </li>
          </ul>
        </div>
        <span className={styles.caption}>Anuntech · Portal do cliente</span>
      </section>
      <section className={styles.formPanel} aria-labelledby="login-title">
        <div className={styles.formCard}>
          <p className={styles.eyebrow}>BEM-VINDO</p>
          <h1 id="login-title">Entre no Console</h1>
          <p className={styles.subtitle}>
            Use o e-mail que recebeu acesso à sua empresa.
          </p>
          {(query.erro || query.error) && (
            <Notification
              kind="error"
              id="login-error"
              message="Não foi possível concluir o acesso. Confira se está usando o e-mail autorizado e tente novamente."
            />
          )}
          <OtpLogin />
          <p className={styles.help}>
            Ainda não tem acesso? Solicite a liberação à equipe da Anuntech.
          </p>
        </div>
        <span className={styles.caption}>
          <LockKeyhole size={13} aria-hidden="true" /> Seu acesso é pessoal e
          protegido.
        </span>
      </section>
    </main>
  );
}
