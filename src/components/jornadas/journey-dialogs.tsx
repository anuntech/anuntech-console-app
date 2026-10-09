"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormSheet } from "@/components/console/form-sheet";
import { FormField } from "@/components/console/form-field";
import { CompanyField } from "@/components/console/company-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { addJourneyStep, linkJourneyRecord, setJourneyStatus, updateJourney } from "@/lib/journeys/journey-actions";
import { JOURNEY_STAGES } from "@/lib/journeys/journey-model";
import type { JourneyCandidates, JourneyDetailData, StaffOption } from "./journey-types";

/** Owner select shared by the new-journey and edit forms. */
export function OwnerField({ staff, defaultValue, id = "journey-owner" }: { staff: StaffOption[]; defaultValue: string; id?: string }) {
  return (
    <FormField label="Responsável" htmlFor={id} hint="Quem conduz a jornada do lado da Anuntech.">
      <NativeSelect id={id} name="ownerId" defaultValue={defaultValue}>
        <NativeSelectOption value="">Sem responsável</NativeSelectOption>
        {staff.map((person) => (
          <NativeSelectOption key={person.id} value={person.id}>
            {person.name || person.email}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </FormField>
  );
}

/** Name, phone and e-mail of someone who is not a client yet. */
export function LeadFields({ lead }: { lead?: JourneyDetailData["journey"]["lead"] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField label="Nome do contato ou da empresa" htmlFor="lead-name">
        <Input id="lead-name" name="leadName" defaultValue={lead?.name ?? ""} maxLength={120} />
      </FormField>
      <FormField label="Quem é" htmlFor="lead-contact" hint="Cargo ou como chegou até a Anuntech.">
        <Input id="lead-contact" name="leadContact" defaultValue={lead?.contact ?? ""} maxLength={120} />
      </FormField>
      <FormField label="E-mail" htmlFor="lead-email">
        <Input id="lead-email" name="leadEmail" type="email" defaultValue={lead?.email ?? ""} maxLength={200} />
      </FormField>
      <FormField label="Telefone" htmlFor="lead-phone">
        <Input id="lead-phone" name="leadPhone" type="tel" defaultValue={lead?.phone ?? ""} maxLength={40} />
      </FormField>
    </div>
  );
}

export function EditJourneySheet({ data, open, onOpenChange }: { data: JourneyDetailData; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { journey } = data;
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Editar jornada"
      description="O nome do projeto, quem conduz e o contato enquanto não há cadastro."
      action={updateJourney}
      submitLabel="Salvar"
      formKey={journey.updatedAt}
    >
      <input type="hidden" name="id" value={journey.id} />
      <FormField label="Projeto" htmlFor="journey-title">
        <Input id="journey-title" name="title" defaultValue={journey.title} required maxLength={160} />
      </FormField>
      <OwnerField staff={data.staff} defaultValue={journey.owner?.id ?? ""} />
      <LeadFields lead={journey.lead} />
    </FormSheet>
  );
}

export type LinkKind = "company" | "quote" | "project" | "hosting" | "ticket";
const linkCopy: Record<LinkKind, { title: string; description: string; empty: string }> = {
  company: { title: "Vincular a empresa", description: "A empresa cadastrada deste projeto.", empty: "" },
  quote: { title: "Vincular o orçamento", description: "O orçamento deste projeto. Contrato, cobranças e projeto se ligam a ele.", empty: "Esta empresa ainda não tem orçamento." },
  project: {
    title: "Vincular o projeto",
    description: "Use quando o projeto não foi criado a partir do orçamento da jornada.",
    empty: "Esta empresa ainda não tem projeto.",
  },
  hosting: {
    title: "Vincular a hospedagem",
    description: "O produto ou serviço de hospedagem desta empresa, do catálogo.",
    empty: "Esta empresa ainda não tem produto ou serviço vinculado.",
  },
  ticket: { title: "Vincular o pedido", description: "O chamado \"App ou projeto novo\" que deu origem ao trabalho.", empty: "Esta empresa não tem pedido de projeto novo." },
};

/** "Vincular": ties a record of the journey's company to it (or unties it). */
export function LinkRecordDialog({
  data,
  kind,
  open,
  onOpenChange,
}: {
  data: JourneyDetailData;
  kind: LinkKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { journey, facts } = data;
  const copy = linkCopy[kind];
  // What the journey links itself, and what it shows because the proposal brings it along.
  const own =
    kind === "company"
      ? (journey.company?.id ?? "")
      : kind === "quote"
        ? (journey.quoteId ?? "")
        : kind === "project"
          ? (journey.engagementId ?? "")
          : kind === "hosting"
            ? (journey.hostingEngagementId ?? "")
            : (journey.ticketId ?? "");
  const derived = !own ? (kind === "project" ? (facts.project?.id ?? "") : kind === "ticket" ? (facts.ticket?.id ?? "") : "") : "";
  const current = own || derived;
  const [value, setValue] = useState(current);
  const candidates: JourneyCandidates = data.candidates ?? { quotes: [], projects: [], hosting: [], tickets: [] };
  const options =
    kind === "quote"
      ? candidates.quotes.map((q) => ({ id: q.id, label: q.taken && q.id !== journey.quoteId ? `${q.label} (em outra jornada)` : q.label, disabled: q.taken && q.id !== journey.quoteId }))
      : (kind === "project" ? candidates.projects : kind === "hosting" ? candidates.hosting : candidates.tickets).map((o) => ({ ...o, disabled: false }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ServerForm action={linkJourneyRecord} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
          <input type="hidden" name="journeyId" value={journey.id} />
          <input type="hidden" name="kind" value={kind} />
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <FormError />
          {kind === "company" ? (
            <FormField label="Empresa" htmlFor="link-company">
              <CompanyField id="link-company" name="recordId" companies={data.companies} value={value} onChange={setValue} />
            </FormField>
          ) : options.length ? (
            <FormField label="Registro" htmlFor="link-record">
              <NativeSelect id="link-record" name="recordId" value={value} onChange={(event) => setValue(event.target.value)}>
                <NativeSelectOption value="">Nenhum</NativeSelectOption>
                {options.map((option) => (
                  <NativeSelectOption key={option.id} value={option.id} disabled={option.disabled}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              {copy.empty}
              {kind === "hosting" && journey.company && (
                <>
                  {" "}
                  <a href={`/produtos/novo?companyId=${journey.company.id}`} className="font-medium text-primary hover:underline">
                    Vincular produto ou serviço
                  </a>
                </>
              )}
            </p>
          )}
          {derived && value === derived && <p className="m-0 text-xs text-muted-foreground">Este vem do orçamento vinculado à jornada.</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <SubmitButton pendingLabel="Salvando…" disabled={value === current || (kind !== "company" && !options.length && !current)}>
              {value ? "Vincular" : "Desvincular"}
            </SubmitButton>
          </DialogFooter>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}

/** A step this journey needs and the standard does not have. */
export function AddStepDialog({ journeyId, open, onOpenChange }: { journeyId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ServerForm action={addJourneyStep} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
          <input type="hidden" name="journeyId" value={journeyId} />
          <DialogHeader>
            <DialogTitle>Acrescentar passo</DialogTitle>
            <DialogDescription>Algo que esta jornada precisa e o padrão não tem. Se valer para todos os projetos, avise para entrar no padrão.</DialogDescription>
          </DialogHeader>
          <FormError />
          <FormField label="Passo" htmlFor="extra-title">
            <Input id="extra-title" name="title" required minLength={2} maxLength={120} placeholder="Ex.: Integração com o ERP do cliente" />
          </FormField>
          <FormField label="Etapa" htmlFor="extra-stage">
            <NativeSelect id="extra-stage" name="stage" defaultValue="setup">
              {JOURNEY_STAGES.map((stage) => (
                <NativeSelectOption key={stage.key} value={stage.key}>
                  {stage.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Anotações" htmlFor="extra-note">
            <Textarea id="extra-note" name="note" rows={3} maxLength={4000} />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <SubmitButton pendingLabel="Acrescentando…">Acrescentar</SubmitButton>
          </DialogFooter>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}

/** "Marcar como perdida": the reason stays in the history. */
export function LostDialog({ journeyId, open, onOpenChange }: { journeyId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ServerForm action={setJourneyStatus} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={journeyId} />
          <input type="hidden" name="status" value="lost" />
          <DialogHeader>
            <DialogTitle>Marcar a jornada como perdida?</DialogTitle>
            <DialogDescription>Ela sai da lista em andamento. O orçamento, o contrato e o projeto não mudam.</DialogDescription>
          </DialogHeader>
          <FormError />
          <FormField label="Por quê" htmlFor="lost-reason">
            <Textarea id="lost-reason" name="reason" required minLength={3} rows={3} maxLength={1000} placeholder="Ex.: o cliente decidiu fazer internamente." />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <SubmitButton variant="destructive" pendingLabel="Salvando…">
              Marcar como perdida
            </SubmitButton>
          </DialogFooter>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}
