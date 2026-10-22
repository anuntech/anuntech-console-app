"use client";
import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ClockIcon,
  KeyRoundIcon,
  MessageCircleQuestionIcon,
  PencilRulerIcon,
  RocketIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import { FormField } from "@/components/console/form-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { AttachmentField } from "@/components/console/attachment-field";
import { DictationButton } from "@/components/console/dictation-button";
import { HelpSuggestions } from "@/components/help/help-suggestions";
import { createTicket } from "@/lib/actions";
import { calendar } from "@/lib/service-terms/business-calendar";
import { changeGuidance, expectation, outOfHoursLine } from "@/lib/service-terms/terms-text";
import {
  ticketChannelLabels,
  ticketChannels,
  ticketDescriptionHints,
  ticketImpactLabels,
  ticketImpacts,
  ticketKindHints,
  ticketKindLabels,
  ticketKinds,
  type TicketImpact,
  type TicketKind,
} from "@/lib/tickets/ticket-intake";
import type { TicketFormContext } from "./new-ticket-context";
import { useTicketUploads } from "./ticket-uploads";

export type TicketCompanyOption = CompanyOption;

const kindIcons: Record<TicketKind, ReactNode> = {
  problem: <TriangleAlertIcon />,
  question: <MessageCircleQuestionIcon />,
  change: <PencilRulerIcon />,
  access: <KeyRoundIcon />,
  new_project: <RocketIcon />,
};

/** A quiet box under a field: what happens next, never a promise the contract does not make. */
function Note({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-2.5 rounded-lg bg-secondary/60 px-3 py-2.5 text-xs leading-5 text-muted-foreground [&>svg]:mt-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0", className)}>
      {icon}
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

/**
 * The fields to open a ticket, names matching createTicket. The client says
 * what they need first (and, for a problem, how badly it hurts); the form
 * then tells them what happens next, with the first response date only when
 * their company has published conditions. Rendered as siblings so the
 * sheet and the card space them with their own `gap-5`.
 */
export function TicketFields({ context, autoFocus = false }: { context: TicketFormContext; autoFocus?: boolean }) {
  const { companies, engagements, terms, staff } = context;
  const [companyId, setCompanyId] = useState(context.companyId ?? (companies.length === 1 ? companies[0].id : ""));
  const [kind, setKind] = useState<TicketKind | "">(context.kind ?? "");
  const [impact, setImpact] = useState<TicketImpact>("other");
  const [engagementId, setEngagementId] = useState("");
  // What the client typed, for "Talvez isto responda" (the fields stay uncontrolled).
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const body = useRef<HTMLTextAreaElement>(null);
  const cal = useMemo(() => calendar(context.holidays), [context.holidays]);
  // Fixed when the form opens, so the preview does not tick while someone types.
  const [now] = useState(() => new Date());
  const products = engagements.filter((e) => e.companyId === companyId);
  // The same record the server snapshots: the product's own, else the company's (lib/service-terms/terms.ts).
  const product = engagementId || (products.length === 1 ? products[0].id : "");
  const governing = (product && product in terms ? terms[product] : terms[companyId]) ?? null;
  const expect = kind ? expectation(governing, kind, kind === "problem" ? impact : null, now, cal) : null;
  const afterHours = outOfHoursLine(now, cal, !!expect?.dated);

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
            value={companyId}
            onChange={(id) => {
              setCompanyId(id);
              setEngagementId("");
            }}
          />
        </FormField>
      )}

      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-sm font-medium text-foreground">O que você precisa?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ticketKinds.map((value) => (
            <label
              key={value}
              className={cn(
                "group press flex cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-primary/40 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                kind === value && "border-primary bg-accent/50",
                value === "new_project" && "sm:col-span-2",
              )}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                required
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground transition-colors [&_svg]:size-4",
                  kind === value && "bg-primary text-primary-foreground",
                )}
              >
                {kindIcons[value]}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{ticketKindLabels[value]}</span>
                <span className="block text-xs text-muted-foreground">{ticketKindHints[value]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {kind === "problem" && (
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-sm font-medium text-foreground">Qual o impacto?</legend>
          <div className="flex flex-col gap-1.5">
            {ticketImpacts.map((value) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors hover:border-primary/40 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                  impact === value ? "border-primary bg-accent/50 text-foreground" : "text-muted-foreground",
                )}
              >
                <input
                  type="radio"
                  name="impact"
                  value={value}
                  checked={impact === value}
                  onChange={() => setImpact(value)}
                  className="size-4 min-h-0 shrink-0 accent-primary"
                />
                {ticketImpactLabels[value]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {kind === "change" && <Note icon={<PencilRulerIcon />}>{changeGuidance(governing)}</Note>}

      {products.length > 1 && kind !== "new_project" ? (
        <FormField label="Sobre o quê" htmlFor="ticket-engagement" hint="O produto, serviço ou projeto deste pedido.">
          <NativeSelect id="ticket-engagement" name="engagementId" value={engagementId} onChange={(e) => setEngagementId(e.target.value)}>
            <NativeSelectOption value="">Não sei ou vale para todos</NativeSelectOption>
            {products.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
      ) : products.length === 1 && kind !== "new_project" ? (
        <input type="hidden" name="engagementId" value={products[0].id} />
      ) : null}

      <FormField label="Assunto" htmlFor="ticket-subject">
        <Input
          id="ticket-subject"
          name="subject"
          required
          maxLength={160}
          // With the kind already chosen (a "Pedir orçamento" link), typing starts here.
          autoFocus={autoFocus && !!context.kind}
          placeholder="Um resumo em uma linha"
          onChange={(event) => setSubject(event.target.value)}
        />
      </FormField>
      {!staff && kind && kind !== "new_project" && (
        <HelpSuggestions text={`${subject} ${description.slice(0, 200)}`} prefer={kind === "question"} />
      )}
      <FormField
        label="Descrição"
        htmlFor="ticket-body"
        hint={
          <span className="flex items-start gap-1.5">
            <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {`${context.voice ? "Não escreva nem fale" : "Não escreva"} senhas nem dados reais dos seus clientes. Se a equipe precisar de um acesso, ela combina com você um jeito seguro.`}
          </span>
        }
      >
        <Textarea
          ref={body}
          id="ticket-body"
          name="body"
          required
          maxLength={10000}
          rows={6}
          placeholder={kind ? ticketDescriptionHints[kind] : "Descreva o que precisa."}
          className="min-h-36"
          onInput={(event) => setDescription(event.currentTarget.value)}
        />
        {context.voice && <DictationButton target={body} maxLength={10000} />}
      </FormField>
      <FormField label="Anexos" htmlFor="ticket-files">
        <AttachmentField id="ticket-files" />
      </FormField>

      {staff && (
        <FormField label="Recebido por" htmlFor="ticket-channel" hint="Pedidos que chegam por fora do Console viram chamado aqui.">
          <NativeSelect id="ticket-channel" name="channel" defaultValue="console">
            {ticketChannels.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {ticketChannelLabels[c]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
      )}

      {expect && (
        <Note icon={<ClockIcon />} className={cn(expect.dated && "bg-accent/60 text-foreground")}>
          <p className="m-0 font-medium text-foreground">O que esperar</p>
          {expect.lines.map((line) => (
            <p key={line} className="m-0">
              {line}
            </p>
          ))}
          {afterHours && kind !== "new_project" && <p className="m-0">{afterHours}</p>}
        </Note>
      )}

      {/* The team records requests from outside the Console with "Recebido por"; these tips are the client's. */}
      {!staff && (
        <p className="m-0 text-xs leading-5 text-muted-foreground">
          Tarefa de projeto em andamento? Comente na própria tarefa.{" "}
          {/* A new tab: this form keeps no draft. */}
          <Link href="/ajuda/tipos-de-chamado" target="_blank" rel="noopener" className="font-medium text-primary hover:underline">
            Qual tipo escolher
            <span className="sr-only"> (abre em nova aba)</span>
          </Link>
        </p>
      )}
    </>
  );
}

/** The full page at /chamados/novo (direct loads); the sheet covers the rest. */
export function NewTicketForm({ context }: { context: TicketFormContext }) {
  const uploads = useTicketUploads();
  return (
    <Card className="reveal-fade max-w-2xl">
      <ServerForm action={createTicket} prepare={uploads} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <TicketFields context={context} autoFocus />
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
