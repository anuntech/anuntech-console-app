"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  return (
    <button
      className="button"
      type="button"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      {pending ? "Atualizando…" : "Atualizar situação"}
    </button>
  );
}
