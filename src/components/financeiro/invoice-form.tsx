"use client";
import Link from "next/link";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DateField } from "@/components/console/date-field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createInvoice } from "@/lib/actions";
import { MoneyInput } from "./invoice-money";
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
    hint: "Emitida e avisada 5 dias antes de cada vencimento.",
  },
] as const;

/** Fields to draft a charge. Names match createInvoice. */
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
  const [company, setCompany] = useState(
    companyId ?? (companies.length === 1 ? companies[0].id : ""),
  );
  const [type, setType] = useState<"one_time" | "recurring">("one_time");
  const [dueDate, setDueDate] = useState("");
  const [bankDueDate, setBankDueDate] = useState("");
  const items = engagements.filter((e) => e.companyId === company);
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="invoice-company" className="mb-1.5">
            Cliente
          </Label>
          <CompanyField
            id="invoice-company"
            name="companyId"
            required
            companies={companies}
            value={company}
            onChange={setCompany}
            autoFocus={autoFocus}
          />
        </div>
        <div>
          <Label htmlFor="invoice-engagement" className="mb-1.5">
            Produto ou projeto
          </Label>
          <NativeSelect
            id="invoice-engagement"
            name="engagementId"
            key={company}
            defaultValue=""
            disabled={!company}
            className="bg-field"
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
        </div>
      </div>
      <div>
        <Label htmlFor="invoice-description" className="mb-1.5">
          Descrição
        </Label>
        <Textarea
          id="invoice-description"
          name="description"
          required
          maxLength={1000}
          rows={2}
          placeholder="Nome do produto ou serviço"
          className="min-h-16"
        />
      </div>
      <fieldset>
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
          <div>
            <Label htmlFor="invoice-interval" className="mb-1.5">
              Frequência
            </Label>
            <NativeSelect
              id="invoice-interval"
              name="interval"
              defaultValue="monthly"
              className="bg-field"
            >
              <NativeSelectOption value="monthly">Mensal</NativeSelectOption>
              <NativeSelectOption value="yearly">Anual</NativeSelectOption>
            </NativeSelect>
          </div>
        )}
        <div>
          <Label htmlFor="invoice-amount" className="mb-1.5">
            Valor
          </Label>
          <MoneyInput id="invoice-amount" />
        </div>
        <div>
          <Label htmlFor="invoice-due" className="mb-1.5">
            {type === "recurring" ? "Primeiro vencimento" : "Vencimento"}
          </Label>
          <DateField id="invoice-due" name="dueDate" required value={dueDate} onChange={setDueDate} />
        </div>
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
        Salvar cria um rascunho. Nada é emitido nem enviado até você publicar.
      </p>
    </div>
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
          <SubmitButton pendingLabel="Salvando…">Salvar rascunho</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
