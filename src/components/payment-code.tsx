"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import styles from "./payment-code.module.css";
export function PaymentCode({
  value,
  label,
  buttonLabel,
}: {
  value: string;
  label: string;
  buttonLabel: string;
}) {
  const [message, setMessage] = useState("");
  const id = useId();
  const copied = message === `${label} copiado.`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copiado.`);
    } catch {
      setMessage("Selecione o código acima para copiar.");
    }
  }
  return (
    <div className={styles.code}>
      <label className={styles.field} htmlFor={`${id}-code`}>
        <span>{label}</span>
        <textarea
          id={`${id}-code`}
          readOnly
          value={value}
          rows={value.length > 100 ? 3 : 2}
          onFocus={(event) => event.currentTarget.select()}
          aria-describedby={`${id}-hint${message ? ` ${id}-feedback` : ""}`}
        />
      </label>
      <span id={`${id}-hint`} className="sr-only">
        Código completo. Você também pode selecionar o texto e copiar com o
        teclado.
      </span>
      <button
        className={`button primary ${styles.button}`}
        type="button"
        onClick={copy}
      >
        {copied ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <Copy size={16} aria-hidden="true" />
        )}
        {buttonLabel}
      </button>
      <p
        id={`${id}-feedback`}
        className={styles.feedback}
        role="status"
        aria-atomic="true"
      >
        {message}
      </p>
    </div>
  );
}
export function PaymentStatusAnnouncer({
  status,
  ready,
}: {
  status: string;
  ready: boolean;
}) {
  const [initial] = useState({ status, ready });
  const message =
    status !== initial.status
      ? status === "paid"
        ? "Pagamento confirmado. Esta fatura já foi paga."
        : status === "cancelled"
          ? "Fatura cancelada. Não é necessário pagar esta fatura."
          : "Situação da fatura atualizada."
      : ready && !initial.ready
        ? "Dados de pagamento disponíveis. Você já pode pagar esta fatura."
        : "";
  return (
    <span
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </span>
  );
}
export function PaymentRefresh() {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    if (pending) return;
    let refreshing = false;
    function refresh() {
      if (refreshing || document.hidden || !navigator.onLine) return;
      refreshing = true;
      start(() => router.refresh());
    }
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [pending, router, start]);
  return null;
}
