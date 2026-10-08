"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import { DateField } from "@/components/console/date-field";
import { FormField } from "@/components/console/form-field";
import { FormSheet, useRouteSheet } from "@/components/console/form-sheet";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { createQuote } from "@/lib/quotes/quote-actions";
import { emptyQuoteContent } from "@/lib/quotes/quote-model";

export type NewQuoteData = {
  companies: CompanyOption[];
  /** Preselected when the flow starts from a company. */
  companyId?: string;
  /** Prefilled when the flow starts from a client's request. */
  title?: string;
  /** The client's request (a ticket) the proposal answers; it stays linked. */
  ticket?: { id: string; subject: string };
  /** The request's description, as the proposal's starting summary. */
  summary?: string;
};

const DESCRIPTION = "Nasce como rascunho; em seguida você monta fases, horas e valores.";
/**
 * Who the proposal is for, its title and validity. Phases, rate and the rest
 * are edited on the draft itself, so the content starts empty.
 */
export function NewQuoteFields({ companies, companyId, title, ticket, summary }: NewQuoteData) {
  const decided = companies.length === 1 || !!companyId;
  return (
    <>
      <input type="hidden" name="content" value={JSON.stringify({ ...emptyQuoteContent(), summary: summary ?? "" })} />
      {ticket && (
        <>
          <input type="hidden" name="ticketId" value={ticket.id} />
          <div className="rounded-lg border bg-field/60 px-4 py-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Pedido do chamado</p>
            <p className="mt-0.5 font-medium text-foreground">{ticket.subject}</p>
            <p className="text-xs text-muted-foreground">
              {summary ? "A descrição do pedido entra como resumo; ajuste no rascunho." : "O orçamento fica ligado ao chamado."}
            </p>
          </div>
        </>
      )}
      {companies.length === 1 ? (
        <input type="hidden" name="companyId" value={companies[0].id} />
      ) : (
        <FormField label="Empresa" htmlFor="quote-company">
          <CompanyField
            id="quote-company"
            name="companyId"
            required
            companies={companies}
            defaultValue={companyId}
            autoFocus={!decided}
          />
        </FormField>
      )}
      <FormField label="Título" htmlFor="quote-title">
        <Input
          id="quote-title"
          name="title"
          required
          maxLength={160}
          placeholder="Ex.: Sistema de controle de OS/OR"
          defaultValue={title}
          autoFocus={decided}
        />
      </FormField>
      <FormField label="Validade" htmlFor="quote-valid">
        <DateField id="quote-valid" name="validUntil" placeholder="Sem prazo" />
      </FormField>
    </>
  );
}

/** /orcamentos/novo reached by navigation. */
export function NewQuoteSheet(data: NewQuoteData) {
  const sheet = useRouteSheet();
  return (
    <FormSheet
      {...sheet}
      size="md"
      title="Novo orçamento"
      description={DESCRIPTION}
      action={createQuote}
      submitLabel="Criar rascunho"
      pendingLabel="Criando…"
    >
      <NewQuoteFields {...data} />
    </FormSheet>
  );
}

/** /orcamentos/novo on a direct load. */
export function NewQuoteForm(data: NewQuoteData) {
  return (
    <Card className="max-w-2xl">
      <ServerForm action={createQuote} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <NewQuoteFields {...data} />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/orcamentos">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Criando…">Criar rascunho</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
