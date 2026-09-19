"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel padded">
      <h1>Não foi possível carregar esta página.</h1>
      <p>
        Tente novamente. Se o problema continuar, entre em contato com a equipe.
      </p>
      <button className="button primary" onClick={reset}>
        Tentar novamente
      </button>
    </section>
  );
}
