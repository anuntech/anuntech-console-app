"use client";
import { CircleAlert, RotateCcw } from "lucide-react";
import styles from "@/components/public-layout.module.css";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className={`${styles.stateCard} ${styles.inlineState}`}>
      <div className={styles.stateIcon}>
        <CircleAlert size={26} aria-hidden="true" />
      </div>
      <h1>Não foi possível carregar esta página</h1>
      <p>
        Tente novamente. Se o problema continuar, entre em contato com a equipe.
      </p>
      <div className={styles.stateActions}>
        <button className="button primary" onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" /> Tentar novamente
        </button>
      </div>
    </section>
  );
}
