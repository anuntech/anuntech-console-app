"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import { FormField } from "@/components/console/form-field";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createTicket } from "@/lib/actions";
import { AttachmentField } from "@/components/console/attachment-field";
import { useTicketUploads } from "./ticket-uploads";

export type TicketCompanyOption = CompanyOption;

/**
 * The fields to open a ticket. Names match createTicket. The company is a
 * hidden value when there is only one choice. Rendered as siblings so the
 * sheet and the card space them with their own `gap-5`.
 */
export function TicketFields({
  companies,
  companyId,
  autoFocus = false,
}: {
  companies: TicketCompanyOption[];
  companyId?: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      {companies.length === 1 ? (
        <input type="hidden" name="companyId" value={companies[0].id} />
      ) : (
        <FormField label="Empresa" htmlFor="ticket-company">
          <CompanyField
            id="ticket-company"
            name="companyId"
            required
            companies={companies}
            defaultValue={companyId}
          />
        </FormField>
      )}
      <FormField label="Assunto" htmlFor="ticket-subject">
        <Input
          id="ticket-subject"
          name="subject"
          required
          maxLength={160}
          autoFocus={autoFocus}
          placeholder="Um resumo da sua solicitação"
        />
      </FormField>
      <FormField label="Descrição" htmlFor="ticket-body">
        <Textarea
          id="ticket-body"
          name="body"
          required
          maxLength={10000}
          rows={7}
          placeholder="Descreva o que precisa."
          className="min-h-40"
        />
      </FormField>
      <FormField label="Anexos" htmlFor="ticket-files">
        <AttachmentField id="ticket-files" />
      </FormField>
    </>
  );
}

/** The full page at /chamados/novo (direct loads); the sheet covers the rest. */
export function NewTicketForm({
  companies,
  companyId,
}: {
  companies: TicketCompanyOption[];
  companyId?: string;
}) {
  const uploads = useTicketUploads();
  return (
    <Card className="max-w-2xl">
      <ServerForm action={createTicket} prepare={uploads} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <TicketFields companies={companies} companyId={companyId} autoFocus />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/chamados">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Abrindo…">Abrir chamado</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
