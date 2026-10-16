"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SectionTitle } from "@/components/console/page-header";
import { FormField } from "@/components/console/form-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { dateLabel } from "@/lib/format";
import { decideEstimate, logTime, proposeEstimate } from "@/lib/service-terms/hours-actions";

export type TicketHoursData = {
  companyId: string;
  /** The company has an hours bank in its conditions. */
  bank: boolean;
  entries: { id: string; minutes: number; note: string; workedOn: string; kind: string }[];
  estimate: { minutes: number | null; status: "proposed" | "approved" | "declined" | null };
  /** Improvements up to this size come out of the bank (SUP 4.1). */
  improvementLimitMinutes: number | null;
  /** Client side: an Administrador answers for the company. */
  canApprove: boolean;
  today: string;
};

const hours = (minutes: number) => `${String(Math.round((minutes / 60) * 10) / 10).replace(".", ",")} h`;

/** The team's side: hours worked on this ticket, and the estimate of an improvement. */
export function TicketHoursCard({ ticketId, data }: { ticketId: string; data: TicketHoursData }) {
  const [logging, setLogging] = useState(false);
  const total = data.entries.reduce((sum, e) => sum + e.minutes, 0);
  return (
    <Card className="gap-4 py-5">
      <CardHeader>
        <SectionTitle title="Horas" description={data.entries.length ? `${hours(total)} registradas neste chamado` : "Nenhuma hora registrada."} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data.entries.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            {data.entries.map((e) => (
              <li key={e.id} className="flex gap-2">
                <span className="w-11 shrink-0 text-xs text-muted-foreground tabular-nums">{dateLabel(e.workedOn).slice(0, 5)}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{e.note}</span>
                <span className="shrink-0 text-xs tabular-nums">{hours(e.minutes)}</span>
              </li>
            ))}
          </ul>
        )}
        {data.bank &&
          (logging ? (
            <ServerForm action={logTime} onSuccess={() => setLogging(false)} reset className="flex flex-col gap-3">
              <input type="hidden" name="companyId" value={data.companyId} />
              <input type="hidden" name="ticketId" value={ticketId} />
              <FormError />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Horas" htmlFor="hours-value">
                  <Input id="hours-value" name="hours" inputMode="decimal" required placeholder="1,5" />
                </FormField>
                <FormField label="Dia" htmlFor="hours-day">
                  <Input id="hours-day" name="workedOn" type="date" required defaultValue={data.today} max={data.today} />
                </FormField>
              </div>
              <FormField label="O que foi feito" htmlFor="hours-note">
                <Input id="hours-note" name="note" required maxLength={500} />
              </FormField>
              <FormField label="Conta como" htmlFor="hours-kind">
                {/* An improvement uses the bank only with its estimate approved (SUP 4.1). */}
                <NativeSelect id="hours-kind" name="kind" required defaultValue={data.estimate.status === "proposed" || data.estimate.status === "declined" ? "" : "bank"}>
                  <NativeSelectOption value="" disabled>
                    Escolha
                  </NativeSelectOption>
                  <NativeSelectOption value="bank" disabled={data.estimate.status === "proposed" || data.estimate.status === "declined"}>
                    Banco de horas
                  </NativeSelectOption>
                  <NativeSelectOption value="critical">Defeito crítico (antes da aprovação)</NativeSelectOption>
                  <NativeSelectOption value="warranty">Garantia (fora do banco)</NativeSelectOption>
                </NativeSelect>
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogging(false)}>
                  Cancelar
                </Button>
                <SubmitButton size="sm" pendingLabel="Registrando…">
                  Registrar
                </SubmitButton>
              </div>
            </ServerForm>
          ) : (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setLogging(true)}>
              Registrar horas
            </Button>
          ))}
        {data.improvementLimitMinutes ? (
          <ServerForm data-assistant-ignore="" action={proposeEstimate} className="flex flex-col gap-2 border-t pt-4">
            <input type="hidden" name="ticketId" value={ticketId} />
            <FormError />
            <p className="m-0 text-xs text-muted-foreground">
              {data.estimate.status === "proposed"
                ? `Estimativa de ${hours(data.estimate.minutes ?? 0)} esperando o cliente.`
                : data.estimate.status === "approved"
                  ? `Estimativa de ${hours(data.estimate.minutes ?? 0)} aprovada.`
                  : data.estimate.status === "declined"
                    ? "O cliente recusou a estimativa."
                    : `Melhoria de até ${hours(data.improvementLimitMinutes)} sai do banco com a estimativa aprovada pelo cliente.`}
            </p>
            <div className="flex gap-2">
              <Input name="hours" inputMode="decimal" required placeholder="Horas" aria-label="Horas estimadas" />
              <SubmitButton variant="outline" size="sm" pendingLabel="Enviando…">
                Enviar estimativa
              </SubmitButton>
            </div>
          </ServerForm>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** The client's side: an improvement's estimate to approve before the work starts. */
export function EstimateCard({ ticketId, data }: { ticketId: string; data: TicketHoursData }) {
  if (!data.estimate.status || !data.estimate.minutes) return null;
  const amount = hours(data.estimate.minutes);
  return (
    <Card className="gap-4 border-primary/30 py-5">
      <CardHeader>
        <SectionTitle title="Estimativa da melhoria" description={`${amount} do seu banco de horas.`} />
      </CardHeader>
      <CardContent>
        {data.estimate.status === "proposed" ? (
          data.canApprove ? (
            <div className="flex flex-wrap gap-2">
              {(["approve", "decline"] as const).map((decision) => (
                <ServerForm key={decision} data-assistant-ignore="" action={decideEstimate}>
                  <input type="hidden" name="ticketId" value={ticketId} />
                  <input type="hidden" name="decision" value={decision} />
                  <input type="hidden" name="minutes" value={data.estimate.minutes ?? 0} />
                  <SubmitButton size="sm" variant={decision === "approve" ? "default" : "outline"} pendingLabel="Enviando…">
                    {decision === "approve" ? "Aprovar" : "Recusar"}
                  </SubmitButton>
                </ServerForm>
              ))}
            </div>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">Um Administrador da sua empresa aprova ou recusa a estimativa.</p>
          )
        ) : (
          <p className="m-0 text-sm text-muted-foreground">{data.estimate.status === "approved" ? "Aprovada. A equipe pode começar." : "Recusada."}</p>
        )}
      </CardContent>
    </Card>
  );
}
