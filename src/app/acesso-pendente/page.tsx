import { getActor } from "@/lib/access";
import { SignOutButton } from "@/components/auth-buttons";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { ArrowRight, UserRoundCheck } from "lucide-react";
import styles from "@/components/public-layout.module.css";
export default async function Pending() {
  const actor = await getActor();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Brand />
      </header>
      <section className={styles.stateCard}>
        <div className={styles.stateIcon}>
          <UserRoundCheck size={26} aria-hidden="true" />
        </div>
        <h1>Falta só liberar seu acesso</h1>
        <p>
          Você entrou como <strong>{actor.user.email}</strong>. A equipe da
          Anuntech precisa associar esse e-mail à sua empresa.
        </p>
        <div className={styles.stateActions}>
          <Link href="/painel" className="button primary">
            Verificar acesso <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <SignOutButton />
        </div>
      </section>
      <footer className={styles.footer}>Anuntech · Portal do cliente</footer>
    </main>
  );
}
