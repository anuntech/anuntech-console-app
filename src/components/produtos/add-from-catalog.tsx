"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import { DateField } from "@/components/console/date-field";
import { FormField } from "@/components/console/form-field";
import { FormSheet, useRouteSheet } from "@/components/console/form-sheet";
import { MoneyField } from "@/components/console/money-field";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { addCatalogEngagement } from "@/lib/catalog-actions";
import { currency } from "@/lib/format";

export type CatalogOption = {
  id: string;
  kind: "product" | "service";
  name: string;
  defaultAmountCents: number | null;
  interval: "monthly" | "yearly" | null;
};
export type SubscriptionOption = {
  id: string;
  companyId: string;
  description: string;
  amountCents: number;
  interval: "monthly" | "yearly";
  nextDueDate: string;
};
export type AddFromCatalogData = {
  companies: CompanyOption[];
  items: CatalogOption[];
  subscriptions: SubscriptionOption[];
  companyId?: string;
};

const intervalLabel = { monthly: "mensal", yearly: "anual" } as const;

/**
 * Company, catalog item, this company's price and how it gets billed.
 * Rendered as siblings so the sheet and the card space them with their own
 * `gap-5`.
 */
export function AddFromCatalogFields({ companies, items, subscriptions, companyId }: AddFromCatalogData) {
  const [company, setCompany] = useState(companyId ?? companies[0]?.id ?? "");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [billing, setBilling] = useState<"draft" | "existing" | "none">("draft");
  const item = items.find((option) => option.id === itemId);
  const existing = subscriptions.filter((sub) => sub.companyId === company);
  return (
    <>
      {companies.length === 1 ? (
        <input type="hidden" name="companyId" value={companies[0].id} />
      ) : (
        <FormField label="Empresa" htmlFor="link-company">
          <CompanyField
            id="link-company"
            name="companyId"
            required
            companies={companies}
            value={company}
            onChange={setCompany}
          />
        </FormField>
      )}
      <FormField label="Item do catálogo" htmlFor="link-item">
        <NativeSelect
          id="link-item"
          name="catalogItemId"
          required
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
        >
          {items.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {option.name} · {option.kind === "product" ? "produto" : "serviço"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Valor para esta empresa" htmlFor="link-amount">
          <MoneyField
            key={itemId}
            id="link-amount"
            required={billing === "draft"}
            defaultCents={item?.defaultAmountCents ?? undefined}
          />
        </FormField>
        <FormField label="Ciclo" htmlFor="link-interval">
          <NativeSelect
            key={itemId}
            id="link-interval"
            name="interval"
            defaultValue={item?.interval ?? "monthly"}
          >
            <NativeSelectOption value="monthly">Mensal</NativeSelectOption>
            <NativeSelectOption value="yearly">Anual</NativeSelectOption>
          </NativeSelect>
        </FormField>
      </div>
      <FormField
        label="Cobrança"
        htmlFor="link-billing"
        hint={
          billing === "draft"
            ? "Nada é emitido nem enviado: a recorrência fica em rascunho no Financeiro para você publicar."
            : billing === "existing"
              ? "Para clientes que já pagam este item, como as cobranças migradas."
              : "Você pode gerar a cobrança depois, pelo Financeiro."
        }
      >
        <NativeSelect
          id="link-billing"
          name="billing"
          value={billing}
          onChange={(event) => setBilling(event.target.value as typeof billing)}
        >
          <NativeSelectOption value="draft">Criar recorrência em rascunho</NativeSelectOption>
          <NativeSelectOption value="existing" disabled={!existing.length}>
            Usar recorrência existente{existing.length ? "" : " (nenhuma livre nesta empresa)"}
          </NativeSelectOption>
          <NativeSelectOption value="none">Sem cobrança por enquanto</NativeSelectOption>
        </NativeSelect>
      </FormField>
      {billing === "draft" && (
        <FormField label="Primeiro vencimento" htmlFor="link-due">
          <DateField id="link-due" name="dueDate" required />
        </FormField>
      )}
      {billing === "existing" && (
        <FormField label="Recorrência" htmlFor="link-subscription">
          <NativeSelect id="link-subscription" name="subscriptionId" required>
            {existing.map((sub) => (
              <NativeSelectOption key={sub.id} value={sub.id}>
                {sub.description} · {currency(sub.amountCents)} {intervalLabel[sub.interval]} · próximo{" "}
                {sub.nextDueDate.split("-").reverse().join("/")}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
      )}
    </>
  );
}

function EmptyCatalog() {
  return (
    <p className="text-sm text-muted-foreground">
      O catálogo está vazio. Cadastre produtos e serviços em{" "}
      <Link href="/configuracoes/catalogo" className="text-primary underline-offset-2 hover:underline">
        Configurações › Catálogo
      </Link>
      .
    </p>
  );
}

/** /produtos/novo reached by navigation. */
export function AddFromCatalogSheet(data: AddFromCatalogData) {
  const sheet = useRouteSheet();
  return (
    <FormSheet
      {...sheet}
      title="Novo produto ou serviço"
      description="Escolha do catálogo e defina o preço desta empresa."
      action={addCatalogEngagement}
      submitDisabled={!data.items.length}
      submitLabel="Vincular"
      pendingLabel="Vinculando…"
    >
      {data.items.length ? <AddFromCatalogFields {...data} /> : <EmptyCatalog />}
    </FormSheet>
  );
}

/** /produtos/novo on a direct load. */
export function AddFromCatalogForm(data: AddFromCatalogData) {
  return (
    <Card className="max-w-2xl">
      <ServerForm action={addCatalogEngagement} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          {data.items.length ? <AddFromCatalogFields {...data} /> : <EmptyCatalog />}
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/produtos">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Vinculando…" disabled={!data.items.length}>
            Vincular
          </SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
