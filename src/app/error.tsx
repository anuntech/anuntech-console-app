"use client";
import { Notification } from "@/components/notifications";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="registration-page">
      <Notification
        kind="error"
        id="page-error"
        message="Não foi possível carregar esta página. Tente novamente."
      />
      <section className="panel form-panel">
        <h1>Página indisponível</h1>
        <button className="button primary" onClick={reset}>
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
