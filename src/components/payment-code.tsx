"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copiado!");
    } catch {
      setMessage("Selecione o código acima para copiar.");
    }
  }
  return (
    <div className={styles.code}>
      <label className={styles.field}>
        <span>{label}</span>
        <textarea
          readOnly
          value={value}
          rows={value.length > 100 ? 3 : 2}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <button
        className={`button primary ${styles.button}`}
        type="button"
        onClick={copy}
      >
        {message === "Copiado!" ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <Copy size={16} aria-hidden="true" />
        )}
        {message === "Copiado!" ? "Copiado!" : buttonLabel}
      </button>
      <p className={styles.feedback} role="status">
        {message}
      </p>
    </div>
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
