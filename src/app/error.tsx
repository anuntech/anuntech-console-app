"use client";
import { Notification } from "@/components/notifications";
import { Brand } from "@/components/brand";
import { CircleAlert, RotateCcw } from "lucide-react";
import styles from "@/components/public-layout.module.css";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Brand />
      </header>
      <Notification
        kind="error"
        id="page-error"
        message="Não foi possível carregar esta página. Tente novamente."
      />
      <section className={styles.stateCard}>
        <div className={styles.stateIcon}>
          <CircleAlert size={26} aria-hidden="true" />
        </div>
        <h1>Página indisponível</h1>
        <p>
          Não foi possível carregar esta página. Tente novamente em instantes.
        </p>
        <div className={styles.stateActions}>
          <button className="button primary" onClick={reset}>
            <RotateCcw size={16} aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      </section>
    </main>
  );
}
