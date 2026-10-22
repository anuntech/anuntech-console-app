"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";

/** Announces bank-side changes that arrive through the automatic refresh. */
export function PaymentStatusAnnouncer({
  status,
  closure = null,
  ready,
}: {
  status: string;
  closure?: "expired" | "replaced" | null;
  ready: boolean;
}) {
  const [initial] = useState({ status, ready });
  const message =
    status !== initial.status
      ? status === "paid"
        ? "Pagamento confirmado. Esta fatura já foi paga."
        : status === "cancelled"
          ? closure === "expired"
            ? "O boleto e o Pix venceram sem pagamento. O valor continua em aberto."
            : closure === "replaced"
              ? "Esta cobrança foi substituída por uma nova."
              : "Fatura cancelada. Não é necessário pagar esta fatura."
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

/** Re-reads the page every 15 s (and on focus) so payment shows up by itself. */
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

/**
 * Marks a situation that changed while the page was open (`data-live`), so
 * the payment confirmation can arrive with its one moment of motion. A page
 * opened already paid stays still. Wraps the payment section's content, so
 * it keeps the first situation across the automatic refreshes.
 */
export function PaymentArrival({ status, children }: { status: string; children: ReactNode }) {
  const [initial] = useState(status);
  return (
    <div data-live={status !== initial ? "" : undefined} className="group/arrival">
      {children}
    </div>
  );
}
