"use client";
import { BellRingIcon, CheckCircle2Icon, TimerOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { ConfirmAction, ServerForm, SubmitButton } from "@/components/console/server-form";
import { closeForNoReply, markNoHours, remindClient } from "@/lib/tickets/ticket-follow-actions";

/** Staff: what to do with a ticket that waits on the client, or finished without hours. */
export type TicketFollowUp = { waiting: boolean; noHours: boolean };

export function TicketFollowCard({ ticketId, followUp }: { ticketId: string; followUp: TicketFollowUp }) {
  if (!followUp.waiting && !followUp.noHours) return null;
  return (
    <Card variant="quiet">
      <CardHeader>
        {/* The status says it waits on the client and the Horas card says none were logged: the buttons are enough. */}
        <SectionTitle title="Acompanhamento" />
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {followUp.waiting && (
          <>
            <ServerForm action={remindClient}>
              <input type="hidden" name="ticketId" value={ticketId} />
              <SubmitButton variant="outline" size="sm" pendingLabel="Lembrando…">
                <BellRingIcon />
                Lembrar o cliente
              </SubmitButton>
            </ServerForm>
            <ConfirmAction
              action={closeForNoReply}
              fields={{ ticketId }}
              title="Resolver por falta de resposta?"
              description="A equipe deixa uma mensagem padrão e o chamado fica como resolvido. Se o cliente responder, ele volta para a equipe."
              confirmLabel="Resolver"
            >
              <Button variant="outline" size="sm">
                <TimerOffIcon />
                Resolver por falta de resposta
              </Button>
            </ConfirmAction>
          </>
        )}
        {followUp.noHours && (
          <ServerForm action={markNoHours}>
            <input type="hidden" name="ticketId" value={ticketId} />
            <SubmitButton variant="outline" size="sm" pendingLabel="Salvando…">
              <CheckCircle2Icon />
              Não houve horas neste chamado
            </SubmitButton>
          </ServerForm>
        )}
      </CardContent>
    </Card>
  );
}
