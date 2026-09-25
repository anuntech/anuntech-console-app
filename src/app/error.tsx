"use client";
import { Notification } from "@/components/notifications";
import { Brand } from "@/components/brand";
import { CircleAlertIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/components/public-layout.module.css";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
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
          <CircleAlertIcon size={26} aria-hidden="true" />
        </div>
        <h1>Página indisponível</h1>
        <p>
          Não foi possível carregar esta página. Tente novamente em instantes.
        </p>
        <div className={styles.stateActions}>
          <Button type="button" size="lg" onClick={reset}>
            <RotateCcwIcon />
            Tentar novamente
          </Button>
        </div>
      </section>
    </main>
  );
}
