"use client";
import { useState } from "react";
import { PackageIcon, WrenchIcon } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { FormField } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { MoneyField } from "@/components/console/money-field";
import { saveCatalogItem } from "@/lib/catalog-actions";

export type CatalogItemValues = {
  id?: string;
  kind: "product" | "service";
  name: string;
  description: string | null;
  url: string | null;
  defaultAmountCents: number | null;
  interval: "monthly" | "yearly" | null;
  whatWeDo: string | null;
  whatWeNeed: string | null;
  expectedResults: string | null;
  deadlines: string | null;
};

const KINDS = [
  { value: "product", label: "Produto", hint: "O cliente abre por um link.", icon: <PackageIcon /> },
  { value: "service", label: "Serviço", hint: "O cliente vê uma página de detalhes.", icon: <WrenchIcon /> },
] as const;

const SERVICE_FIELDS = [
  { name: "whatWeDo", label: "O que fazemos", placeholder: "O que a Anuntech entrega neste serviço." },
  { name: "whatWeNeed", label: "O que precisamos de você", placeholder: "Acessos, materiais e decisões que o cliente fornece." },
  { name: "expectedResults", label: "Resultados esperados", placeholder: "O que muda para o cliente quando o serviço roda." },
  { name: "deadlines", label: "Prazos", placeholder: "Cadência, entregas e datas combinadas." },
] as const;

/** Creates or edits one catalog item; service items carry the four fixed sections. */
export function CatalogSheet({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CatalogItemValues | null;
}) {
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Editar item" : "Novo item do catálogo"}
      description={
        item ? "As mudanças valem para os próximos vínculos." : "Cadastre uma vez e vincule a cada cliente com o preço dele."
      }
      action={saveCatalogItem}
      formKey={item?.id ?? "new"}
      submitLabel={item ? "Salvar" : "Adicionar ao catálogo"}
      pendingLabel={item ? "Salvando…" : "Adicionando…"}
    >
      {item?.id && <input type="hidden" name="id" value={item.id} />}
      <CatalogFields item={item} />
    </FormSheet>
  );
}

/* Lives inside the form so the chosen kind starts over with each item. */
function CatalogFields({ item }: { item: CatalogItemValues | null }) {
  const [kind, setKind] = useState<"product" | "service">(item?.kind ?? "product");
  return (
    <>
      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-sm font-medium text-foreground">Tipo</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border bg-field px-3 py-2.5 text-sm transition-colors hover:bg-accent/40 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
              )}
            >
              <input
                type="radio"
                name="kind"
                value={option.value}
                className="sr-only"
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
              />
              <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{option.icon}</span>
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormField label="Nome" htmlFor="catalog-name">
        <Input
          id="catalog-name"
          name="name"
          required
          maxLength={160}
          autoFocus
          defaultValue={item?.name ?? ""}
          placeholder={kind === "product" ? "Ex.: Synova" : "Ex.: Gestão de tráfego"}
        />
      </FormField>
      <FormField label="Descrição curta" htmlFor="catalog-description">
        <Textarea
          id="catalog-description"
          name="description"
          maxLength={3000}
          rows={3}
          defaultValue={item?.description ?? ""}
          placeholder="Uma ou duas frases, como aparece no card."
          className="min-h-20"
        />
      </FormField>
      {kind === "product" && (
        <FormField label="Link do produto" htmlFor="catalog-url">
          <Input
            id="catalog-url"
            name="url"
            type="url"
            inputMode="url"
            maxLength={2048}
            defaultValue={item?.url ?? ""}
            placeholder="https://"
          />
        </FormField>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Valor padrão" htmlFor="catalog-amount">
          <MoneyField
            id="catalog-amount"
            name="defaultAmount"
            required={false}
            defaultCents={item?.defaultAmountCents ?? undefined}
          />
        </FormField>
        <FormField label="Ciclo" htmlFor="catalog-interval">
          <NativeSelect id="catalog-interval" name="interval" defaultValue={item?.interval ?? ""}>
            <NativeSelectOption value="">Sem recorrência</NativeSelectOption>
            <NativeSelectOption value="monthly">Mensal</NativeSelectOption>
            <NativeSelectOption value="yearly">Anual</NativeSelectOption>
          </NativeSelect>
        </FormField>
      </div>
      {kind === "service" &&
        SERVICE_FIELDS.map((field) => (
          <FormField key={field.name} label={field.label} htmlFor={`catalog-${field.name}`}>
            <Textarea
              id={`catalog-${field.name}`}
              name={field.name}
              maxLength={5000}
              rows={4}
              defaultValue={item?.[field.name] ?? ""}
              placeholder={field.placeholder}
              className="min-h-24"
            />
          </FormField>
        ))}
    </>
  );
}
