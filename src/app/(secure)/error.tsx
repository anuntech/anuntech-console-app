"use client";
import { CircleAlertIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/components/public-layout.module.css";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className={`${styles.stateCard} ${styles.inlineState}`}>
      <div className={styles.stateIcon}>
        <CircleAlertIcon size={26} aria-hidden="true" />
      </div>
      <h1>Não foi possível carregar esta página</h1>
      <p>
        Tente novamente. Se o problema continuar, entre em contato com a equipe.
      </p>
      <div className={styles.stateActions}>
        <Button type="button" size="lg" onClick={reset}>
          <RotateCcwIcon />
          Tentar novamente
        </Button>
      </div>
    </section>
  );
}
