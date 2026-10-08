"use client";
import { SparklesIcon } from "lucide-react";
import { ServerForm, SubmitButton } from "@/components/console/server-form";
import { updateTicket } from "@/lib/actions";
import { dismissTriage } from "@/lib/tickets/ticket-follow-actions";
import { priorityLabels } from "@/lib/format";
import { ticketImpactLabels, ticketKindLabels } from "@/lib/tickets/ticket-intake";
import type { TicketTriage } from "@/lib/tickets/ticket-triage";

/** Staff: the ticket's text sounds worse than what was ticked; one click applies the priority. */
export function TicketTriageNotice({ ticketId, triage }: { ticketId: string; triage: TicketTriage }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-warning-edge bg-warning-soft px-4 py-3 text-sm text-warning">
      <SparklesIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        O texto parece mais grave do que o marcado: {ticketKindLabels[triage.kind].toLowerCase()}
        {triage.kind === "problem" ? `, ${ticketImpactLabels[triage.impact].toLowerCase()}` : ""}. Sugestão do Jev: prioridade {priorityLabels[triage.priority]}.
      </span>
      <span className="flex gap-2">
        <ServerForm action={dismissTriage}>
          <input type="hidden" name="ticketId" value={ticketId} />
          <SubmitButton size="sm" variant="ghost" pendingLabel="Salvando…">
            Manter a prioridade
          </SubmitButton>
        </ServerForm>
        <ServerForm action={updateTicket}>
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="priority" value={triage.priority} />
          <SubmitButton size="sm" variant="outline" pendingLabel="Aplicando…">
            Aplicar {priorityLabels[triage.priority]}
          </SubmitButton>
        </ServerForm>
      </span>
    </div>
  );
}
