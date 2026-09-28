import { getActor } from "@/lib/access/access";
import { SignOutButton } from "@/components/auth/auth-buttons";
import { Brand } from "@/components/shell/brand";
import Link from "next/link";
import { ArrowRightIcon, UserRoundCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/components/shell/public-layout.module.css";
export const metadata = {
  title: "Acesso pendente",
  robots: { index: false, follow: false },
};
export default async function Pending() {
  const actor = await getActor();
  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <header className={styles.header}>
        <Brand />
      </header>
      <section className={styles.stateCard}>
        <div className={styles.stateIcon}>
          <UserRoundCheckIcon size={26} aria-hidden="true" />
        </div>
        <h1>Falta só liberar seu acesso</h1>
        <p>
          Você entrou como <strong>{actor.user.email}</strong>. A equipe da
          Anuntech precisa associar esse e-mail à sua empresa.
        </p>
        <div className={styles.stateActions}>
          <Button size="lg" asChild>
            <Link href="/painel">
              Verificar acesso
              <ArrowRightIcon />
            </Link>
          </Button>
          <SignOutButton />
        </div>
      </section>
      <footer className={styles.footer}>Anuntech · Portal do cliente</footer>
    </main>
  );
}
