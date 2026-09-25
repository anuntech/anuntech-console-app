import Link from "next/link";
import { Brand } from "@/components/brand";
import { ArrowLeftIcon, FileQuestionIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/components/public-layout.module.css";
export const metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};
export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <header className={styles.header}>
        <Brand />
      </header>
      <section className={styles.stateCard}>
        <div className={styles.stateIcon}>
          <FileQuestionIcon size={26} aria-hidden="true" />
        </div>
        <p className={styles.eyebrow}>ERRO 404</p>
        <h1>Página não encontrada</h1>
        <p>
          O endereço não está disponível para o seu acesso. Confira o link
          recebido ou volte ao Console.
        </p>
        <div className={styles.stateActions}>
          <Button size="lg" asChild>
            <Link href="/painel">
              <ArrowLeftIcon />
              Voltar ao Console
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
