"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createTicket } from "@/lib/actions";
import { AttachmentField } from "./attachment-field";
import { useTicketUploads } from "./ticket-uploads";

export type TicketCompanyOption = CompanyOption;

/**
 * The fields to open a ticket. Names match createTicket. The company is a
 * hidden value when there is only one choice; otherwise a native select, so
 * the form also works before hydration.
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
    <div className="grid gap-5">
      {companies.length === 1 ? (
        <input type="hidden" name="companyId" value={companies[0].id} />
      ) : (
        <div>
          <Label htmlFor="ticket-company" className="mb-1.5">
            Empresa
          </Label>
          <CompanyField
            id="ticket-company"
            name="companyId"
            required
            companies={companies}
            defaultValue={companyId}
          />
        </div>
      )}
      <div>
        <Label htmlFor="ticket-subject" className="mb-1.5">
          Assunto
        </Label>
        <Input
          id="ticket-subject"
          name="subject"
          required
          maxLength={160}
          autoFocus={autoFocus}
          placeholder="Um resumo da sua solicitação"
        />
      </div>
      <div>
        <Label htmlFor="ticket-body" className="mb-1.5">
          Descrição
        </Label>
        <Textarea
          id="ticket-body"
          name="body"
          required
          maxLength={10000}
          rows={7}
          placeholder="Descreva o que precisa."
          className="min-h-40"
        />
      </div>
      <div>
        <Label className="mb-1.5">Anexos</Label>
        <AttachmentField />
      </div>
    </div>
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
