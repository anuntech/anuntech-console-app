"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DateField } from "@/components/console/date-field";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { MoneyInput } from "@/components/financeiro/invoice-money";
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

/** Company, catalog item, this company's price and how it gets billed. */
export function AddFromCatalogFields({ companies, items, subscriptions, companyId }: AddFromCatalogData) {
  const [company, setCompany] = useState(companyId ?? companies[0]?.id ?? "");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [billing, setBilling] = useState<"draft" | "existing" | "none">("draft");
  const item = items.find((option) => option.id === itemId);
  const existing = subscriptions.filter((sub) => sub.companyId === company);
  return (
    <div className="grid gap-5">
      {companies.length === 1 ? (
        <input type="hidden" name="companyId" value={companies[0].id} />
      ) : (
        <div>
          <Label htmlFor="link-company" className="mb-1.5">
            Empresa
          </Label>
          <CompanyField
            id="link-company"
            name="companyId"
            required
            companies={companies}
            value={company}
            onChange={setCompany}
          />
        </div>
      )}
      <div>
        <Label htmlFor="link-item" className="mb-1.5">
          Item do catálogo
        </Label>
        <NativeSelect
          id="link-item"
          name="catalogItemId"
          required
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          className="bg-field"
        >
          {items.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {option.name} · {option.kind === "product" ? "produto" : "serviço"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="link-amount" className="mb-1.5">
            Valor para esta empresa
          </Label>
          <MoneyInput
            key={itemId}
            id="link-amount"
            required={billing === "draft"}
            defaultCents={item?.defaultAmountCents ?? undefined}
          />
        </div>
        <div>
          <Label htmlFor="link-interval" className="mb-1.5">
            Ciclo
          </Label>
          <NativeSelect
            key={itemId}
            id="link-interval"
            name="interval"
            defaultValue={item?.interval ?? "monthly"}
            className="bg-field"
          >
            <NativeSelectOption value="monthly">Mensal</NativeSelectOption>
            <NativeSelectOption value="yearly">Anual</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <div>
        <Label htmlFor="link-billing" className="mb-1.5">
          Cobrança
        </Label>
        <NativeSelect
          id="link-billing"
          name="billing"
          value={billing}
          onChange={(event) => setBilling(event.target.value as typeof billing)}
          className="bg-field"
        >
          <NativeSelectOption value="draft">Criar recorrência em rascunho</NativeSelectOption>
          <NativeSelectOption value="existing" disabled={!existing.length}>
            Usar recorrência existente{existing.length ? "" : " (nenhuma livre nesta empresa)"}
          </NativeSelectOption>
          <NativeSelectOption value="none">Sem cobrança por enquanto</NativeSelectOption>
        </NativeSelect>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {billing === "draft"
            ? "Nada é emitido nem enviado: a recorrência fica em rascunho no Financeiro para você publicar."
            : billing === "existing"
              ? "Para clientes que já pagam este item, como as cobranças migradas."
              : "Você pode gerar a cobrança depois, pelo Financeiro."}
        </p>
      </div>
      {billing === "draft" && (
        <div>
          <Label htmlFor="link-due" className="mb-1.5">
            Primeiro vencimento
          </Label>
          <DateField id="link-due" name="dueDate" required />
        </div>
      )}
      {billing === "existing" && (
        <div>
          <Label htmlFor="link-subscription" className="mb-1.5">
            Recorrência
          </Label>
          <NativeSelect id="link-subscription" name="subscriptionId" required className="bg-field">
            {existing.map((sub) => (
              <NativeSelectOption key={sub.id} value={sub.id}>
                {sub.description} · {currency(sub.amountCents)} {intervalLabel[sub.interval]} · próximo{" "}
                {sub.nextDueDate.split("-").reverse().join("/")}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
    </div>
  );
}

/** /produtos/novo reached by navigation. */
export function AddFromCatalogSheet(data: AddFromCatalogData) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    setTimeout(() => router.back(), 300);
  };
  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <ServerForm action={addCatalogEngagement} className="flex h-full min-h-0 flex-col">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Vincular produto ou serviço</SheetTitle>
            <SheetDescription>Escolha do catálogo e defina o preço desta empresa.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            {data.items.length ? (
              <AddFromCatalogFields {...data} />
            ) : (
              <p className="text-sm text-muted-foreground">
                O catálogo está vazio. Cadastre produtos e serviços em{" "}
                <Link href="/configuracoes/catalogo" className="text-primary underline-offset-2 hover:underline">
                  Configurações › Catálogo
                </Link>
                .
              </p>
            )}
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Vinculando…" disabled={!data.items.length}>
              Vincular
            </SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}

/** /produtos/novo on a direct load. */
export function AddFromCatalogForm(data: AddFromCatalogData) {
  return (
    <Card className="max-w-2xl">
      <ServerForm action={addCatalogEngagement} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          {data.items.length ? (
            <AddFromCatalogFields {...data} />
          ) : (
            <p className="text-sm text-muted-foreground">
              O catálogo está vazio. Cadastre produtos e serviços em{" "}
              <Link href="/configuracoes/catalogo" className="text-primary underline-offset-2 hover:underline">
                Configurações › Catálogo
              </Link>
              .
            </p>
          )}
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
