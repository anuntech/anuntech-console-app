"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
    <div>
      <label className="field">
        <span>{label}</span>
        <textarea
          readOnly
          value={value}
          rows={3}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <button className="button" type="button" onClick={copy}>
        {buttonLabel}
      </button>
      <p role="status">{message}</p>
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
