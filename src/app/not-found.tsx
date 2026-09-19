import Link from "next/link";
import { Brand } from "@/components/brand";
import { ArrowLeft, FileQuestion } from "lucide-react";
import styles from "@/components/public-layout.module.css";
export default function NotFound() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Brand />
      </header>
      <section className={styles.stateCard}>
        <div className={styles.stateIcon}>
          <FileQuestion size={26} aria-hidden="true" />
        </div>
        <p className={styles.eyebrow}>ERRO 404</p>
        <h1>Página não encontrada</h1>
        <p>
          O endereço não está disponível para o seu acesso. Confira o link
          recebido ou volte ao Console.
        </p>
        <div className={styles.stateActions}>
          <Link href="/painel" className="button primary">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar ao Console
          </Link>
        </div>
      </section>
    </main>
  );
}
