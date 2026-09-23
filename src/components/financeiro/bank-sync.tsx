"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { ServerForm, SubmitButton } from "@/components/console/server-form";
import { refreshCharge, syncCharge } from "@/lib/billing-actions";
import { relativeLabel } from "@/lib/format";

/**
 * Keeps the bank's view current without anyone asking: one check when the
 * page opens with stale data, and a check every 15 s while the bank is still
 * processing the emission (boleto and Pix land on their own).
 */
export function BankSync({
  id,
  mode,
}: {
  id: string;
  mode: "poll" | "once" | "off";
}) {
  const router = useRouter();
  useEffect(() => {
    if (mode === "off") return;
    let cancelled = false;
    async function run() {
      if (document.hidden || !navigator.onLine) return;
      const result = await refreshCharge(id).catch(() => ({ ok: false }));
      if (!cancelled && result.ok) router.refresh();
    }
    void run();
    const timer = mode === "poll" ? window.setInterval(run, 15000) : undefined;
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [id, mode, router]);
  return null;
}

/** "Consultado há 3 min" with a quiet way to ask the bank again right now. */
export function SyncControl({
  id,
  checkedAt,
  now,
}: {
  id: string;
  checkedAt: string | null;
  now: string;
}) {
  return (
    <ServerForm
      action={syncCharge}
      className="flex items-center gap-1 text-xs text-muted-foreground"
    >
      <input type="hidden" name="id" value={id} />
      <span>
        {checkedAt
          ? `Consultado ${relativeLabel(checkedAt, now)}`
          : "Ainda não consultado"}
      </span>
      <SubmitButton
        variant="ghost"
        size="icon-xs"
        pendingLabel=""
        aria-label="Consultar cobrança no Inter"
        title="Consultar agora"
      >
        <RefreshCwIcon />
        <span className="sr-only">Consultar cobrança no Inter</span>
      </SubmitButton>
    </ServerForm>
  );
}
