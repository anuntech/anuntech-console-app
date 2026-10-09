"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormSheet, useRouteSheet } from "@/components/console/form-sheet";
import { FormField } from "@/components/console/form-field";
import { CompanyField } from "@/components/console/company-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { startJourney } from "@/lib/journeys/journey-actions";
import { LeadFields, OwnerField } from "./journey-dialogs";
import type { StaffOption } from "./journey-types";

/** Where a new journey can start from: a company, a request or a proposal already in the Console. */
export type NewJourneyContext = {
  companies: { id: string; name: string; document: string | null }[];
  staff: StaffOption[];
  /** The person opening it, owner by default. */
  me: string;
  companyId: string;
  quote: { id: string; label: string } | null;
  ticket: { id: string; label: string } | null;
  title: string;
};

const DESCRIPTION = "Um projeto de cliente, do primeiro contato à hospedagem. Os passos que o Console já sabe se marcam sozinhos.";

function Fields({ context }: { context: NewJourneyContext }) {
  const [lead, setLead] = useState(!context.companyId && !context.quote);
  return (
    <>
      {context.quote && <input type="hidden" name="quoteId" value={context.quote.id} />}
      {context.ticket && <input type="hidden" name="ticketId" value={context.ticket.id} />}
      <FormField label="Projeto" htmlFor="journey-new-title" hint="Como a equipe chama o projeto. Ex.: App de visitas da Acme.">
        <Input id="journey-new-title" name="title" defaultValue={context.title} required maxLength={160} autoFocus />
      </FormField>
      {(context.quote || context.ticket) && (
        <p className="m-0 rounded-lg border bg-field/60 px-3 py-2 text-sm text-muted-foreground">
          Começa a partir {context.quote ? `do orçamento ${context.quote.label}` : `do pedido "${context.ticket!.label}"`}.
        </p>
      )}
      {!context.quote && (
        <div className="flex items-center gap-3">
          <Switch id="journey-new-lead" checked={lead} onCheckedChange={setLead} />
          <Label htmlFor="journey-new-lead" className="font-normal">
            Ainda não é cliente
          </Label>
        </div>
      )}
      {lead ? (
        <LeadFields />
      ) : (
        !context.quote && (
          <FormField label="Empresa" htmlFor="journey-new-company">
            <CompanyField id="journey-new-company" name="companyId" companies={context.companies} defaultValue={context.companyId} required />
          </FormField>
        )
      )}
      <OwnerField staff={context.staff} defaultValue={context.me} id="journey-new-owner" />
    </>
  );
}

/** "Nova jornada" over the current page (intercepted route). */
export function NewJourneySheet({ context }: { context: NewJourneyContext }) {
  const sheet = useRouteSheet();
  return (
    <FormSheet {...sheet} size="md" title="Nova jornada" description={DESCRIPTION} action={startJourney} submitLabel="Começar jornada" pendingLabel="Criando…">
      <Fields context={context} />
    </FormSheet>
  );
}

/** /jornadas/nova on a direct load. */
export function NewJourneyForm({ context }: { context: NewJourneyContext }) {
  return (
    <Card className="max-w-xl">
      <ServerForm action={startJourney} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <Fields context={context} />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/jornadas">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Criando…">Começar jornada</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
