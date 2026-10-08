"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ConfirmDialog, ServerForm } from "@/components/console/server-form";
import { updateEngagement } from "@/lib/actions";

export type EngagementStatus = "active" | "paused" | "completed";

/**
 * Pause, resume or finish a project or product from a menu. Resuming goes
 * straight through one hidden form; pausing or finishing asks first, because
 * a recurring charge linked to it would keep going out unless it is paused too.
 */
export function useEngagementStatus() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState({ id: "", status: "" });
  const [asking, setAsking] = useState<{ id: string; status: Exclude<EngagementStatus, "active">; name?: string } | null>(null);
  const change = (id: string, status: EngagementStatus, name?: string) =>
    setTimeout(() => {
      if (status !== "active") return setAsking({ id, status, name });
      flushSync(() => setPending({ id, status }));
      formRef.current?.requestSubmit();
    }, 0);
  const what = asking?.name ? `"${asking.name}"` : "este item";
  const form = (
    <>
      <ServerForm ref={formRef} action={updateEngagement}>
        <input type="hidden" name="id" value={pending.id} />
        <input type="hidden" name="status" value={pending.status} />
      </ServerForm>
      <ConfirmDialog
        open={!!asking}
        onOpenChange={(open) => !open && setAsking(null)}
        action={updateEngagement}
        fields={{ id: asking?.id ?? "", status: asking?.status ?? "" }}
        title={asking?.status === "completed" ? `Concluir ${what}?` : `Pausar ${what}?`}
        description="Uma cobrança recorrente ligada a ele continua saindo, a menos que você a pause aqui também."
        confirmLabel={asking?.status === "completed" ? "Concluir" : "Pausar"}
        extra={(formId) => (
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" form={formId} name="pauseBilling" value="yes" defaultChecked className="mt-1 size-4 min-h-0 shrink-0 accent-primary" />
            <span>Pausar também a cobrança recorrente, se houver. Dá para retomar depois na fatura.</span>
          </label>
        )}
      />
    </>
  );
  return { change, form };
}
