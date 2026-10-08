"use client";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionTitle } from "@/components/console/page-header";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { saveAutomations } from "@/lib/automations/automation-actions";
import { AUTOMATIONS, automationKeys, type AutomationKey } from "@/lib/automations/automation-list";

/** One switch per automatic step, grouped by who it reaches; saved together. */
export function AutomationsForm({ state }: { state: Record<AutomationKey, boolean> }) {
  const groups = [...new Set(automationKeys.map((key) => AUTOMATIONS[key].group))];
  return (
    <ServerForm action={saveAutomations} className="flex flex-col gap-6">
      {groups.map((group) => (
        <Card key={group}>
          <CardHeader>
            <SectionTitle
              title={group === "Cliente" ? "Avisos ao cliente" : "Para a equipe"}
              description={
                group === "Cliente"
                  ? "E-mails que saem sozinhos para os Administradores de cada empresa, uma vez cada um."
                  : "Ajuda à equipe que usa serviços de fora do Console."
              }
            />
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {automationKeys
              .filter((key) => AUTOMATIONS[key].group === group)
              .map((key) => (
                <div key={key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <Label htmlFor={`automation-${key}`} className="flex min-w-0 flex-col items-start gap-0.5 font-normal">
                    <span className="text-sm font-medium text-foreground">{AUTOMATIONS[key].label}</span>
                    <span className="text-xs leading-5 text-muted-foreground">{AUTOMATIONS[key].description}</span>
                  </Label>
                  <Switch id={`automation-${key}`} name={key} defaultChecked={state[key]} className="mt-0.5" />
                </div>
              ))}
          </CardContent>
        </Card>
      ))}
      <Card className="py-4">
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <FormError />
          <p className="m-0 text-xs text-muted-foreground">Desligar vale a partir da próxima rotina. Nada do que já saiu é desfeito.</p>
          <SubmitButton pendingLabel="Salvando…">Salvar automações</SubmitButton>
        </CardFooter>
      </Card>
    </ServerForm>
  );
}
