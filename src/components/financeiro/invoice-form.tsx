"use client";
import Link from "next/link";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DateField } from "@/components/console/date-field";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import { FormField } from "@/components/console/form-field";
import { MoneyField } from "@/components/console/money-field";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createInvoice } from "@/lib/actions";
import { ChargeTermsFields } from "./charge-terms-fields";
import { BankDueDateField } from "./bank-due-date-field";

export type InvoiceCompanyOption = CompanyOption;
export type InvoiceEngagementOption = {
  id: string;
  name: string;
  companyId: string;
};

const TYPES = [
  {
    value: "one_time",
    label: "Cobrança única",
    hint: "Uma emissão, quando você publicar.",
  },
  {
    value: "recurring",
    label: "Recorrente",
    hint: "Mensal: a próxima sai assim que a anterior é paga. O aviso vai 5 dias antes de cada vencimento.",
  },
] as const;

/**
 * Fields to draft a charge. Names match createInvoice. Rendered as siblings
 * so the sheet and the card space them with their own `gap-5`.
 */
export function InvoiceFields({
  companies,
  engagements,
  companyId,
  autoFocus = false,
}: {
  companies: InvoiceCompanyOption[];
  engagements: InvoiceEngagementOption[];
  companyId?: string;
  autoFocus?: boolean;
}) {
  // One company: nothing to choose, so it travels as a hidden value.
  const only = companies.length === 1 ? companies[0].id : null;
  const [company, setCompany] = useState(only ?? companyId ?? "");
  const [type, setType] = useState<"one_time" | "recurring">("one_time");
  const [dueDate, setDueDate] = useState("");
  const [bankDueDate, setBankDueDate] = useState("");
  const items = engagements.filter((e) => e.companyId === company);
  return (
    <>
      {only && <input type="hidden" name="companyId" value={only} />}
      <div className={cn("grid gap-5", !only && "sm:grid-cols-2")}>
        {!only && (
          <FormField label="Empresa" htmlFor="invoice-company">
            <CompanyField
              id="invoice-company"
              name="companyId"
              required
              companies={companies}
              value={company}
              onChange={setCompany}
              autoFocus={autoFocus}
            />
          </FormField>
        )}
        <FormField label="Produto ou projeto" htmlFor="invoice-engagement">
          <NativeSelect
            id="invoice-engagement"
            name="engagementId"
            key={company}
            defaultValue=""
            disabled={!company}
          >
            <NativeSelectOption value="">
              {company && !items.length ? "Nenhum cadastrado" : "Sem vínculo"}
            </NativeSelectOption>
            {items.map((e) => (
              <NativeSelectOption key={e.id} value={e.id}>
                {e.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <FormField label="Descrição" htmlFor="invoice-description">
        <Textarea
          id="invoice-description"
          name="description"
          required
          maxLength={1000}
          rows={2}
          autoFocus={autoFocus && !!only}
          placeholder="Nome do produto ou serviço"
          className="min-h-16"
        />
      </FormField>
      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-sm font-medium text-foreground">
          Tipo de cobrança
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TYPES.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded-lg border bg-field px-3 py-2.5 text-sm transition-colors hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
              )}
            >
              <input
                type="radio"
                name="billingType"
                value={option.value}
                className="sr-only"
                checked={type === option.value}
                onChange={() => setType(option.value)}
              />
              <span className="font-medium text-foreground">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        {type === "recurring" && (
          <FormField label="Frequência" htmlFor="invoice-interval">
            <NativeSelect id="invoice-interval" name="interval" defaultValue="monthly">
              <NativeSelectOption value="monthly">Mensal</NativeSelectOption>
              <NativeSelectOption value="yearly">Anual</NativeSelectOption>
            </NativeSelect>
          </FormField>
        )}
        <FormField label="Valor" htmlFor="invoice-amount">
          <MoneyField id="invoice-amount" />
        </FormField>
        <FormField label={type === "recurring" ? "Primeiro vencimento" : "Vencimento"} htmlFor="invoice-due">
          <DateField id="invoice-due" name="dueDate" required value={dueDate} onChange={setDueDate} />
        </FormField>
      </div>
      {type === "one_time" && (
        <BankDueDateField dueDate={dueDate} value={bankDueDate} onChange={setBankDueDate} idPrefix="invoice" />
      )}
      <ChargeTermsFields idPrefix="invoice-terms" />
      {type === "recurring" && (
        <p className="text-xs text-muted-foreground">
          As condições valem para todas as faturas desta recorrência.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Nasce como rascunho. Nada é emitido nem enviado até você publicar.
      </p>
    </>
  );
}

/** The full page at /financeiro/nova (direct loads); the sheet covers the rest. */
export function NewInvoiceForm({
  companies,
  engagements,
  companyId,
}: {
  companies: InvoiceCompanyOption[];
  engagements: InvoiceEngagementOption[];
  companyId?: string;
}) {
  return (
    <Card className="max-w-2xl">
      <ServerForm action={createInvoice} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <InvoiceFields
            companies={companies}
            engagements={engagements}
            companyId={companyId}
            autoFocus
          />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/financeiro">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Criando…">Criar rascunho</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
