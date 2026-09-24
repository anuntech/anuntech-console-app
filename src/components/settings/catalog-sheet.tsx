"use client";
import { useState } from "react";
import { PackageIcon, WrenchIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { MoneyInput } from "@/components/financeiro/invoice-money";
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
  const [kind, setKind] = useState<"product" | "service">(item?.kind ?? "product");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <ServerForm
          key={open ? (item?.id ?? "new") : "closed"}
          action={saveCatalogItem}
          onSuccess={() => onOpenChange(false)}
          className="flex h-full min-h-0 flex-col"
        >
          {item?.id && <input type="hidden" name="id" value={item.id} />}
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{item ? "Editar item" : "Novo item do catálogo"}</SheetTitle>
            <SheetDescription>
              {item ? "As mudanças valem para os próximos vínculos." : "Cadastre uma vez e vincule a cada cliente com o preço dele."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            <div className="grid gap-5">
              <fieldset>
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
              <div>
                <Label htmlFor="catalog-name" className="mb-1.5">
                  Nome
                </Label>
                <Input
                  id="catalog-name"
                  name="name"
                  required
                  maxLength={160}
                  autoFocus
                  defaultValue={item?.name ?? ""}
                  placeholder={kind === "product" ? "Ex.: Synova" : "Ex.: Gestão de tráfego"}
                />
              </div>
              <div>
                <Label htmlFor="catalog-description" className="mb-1.5">
                  Descrição curta
                </Label>
                <Textarea
                  id="catalog-description"
                  name="description"
                  maxLength={3000}
                  rows={3}
                  defaultValue={item?.description ?? ""}
                  placeholder="Uma ou duas frases, como aparece no card."
                  className="min-h-20"
                />
              </div>
              {kind === "product" && (
                <div>
                  <Label htmlFor="catalog-url" className="mb-1.5">
                    Link do produto
                  </Label>
                  <Input
                    id="catalog-url"
                    name="url"
                    type="url"
                    inputMode="url"
                    maxLength={2048}
                    defaultValue={item?.url ?? ""}
                    placeholder="https://"
                  />
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="catalog-amount" className="mb-1.5">
                    Valor padrão
                  </Label>
                  <MoneyInput
                    id="catalog-amount"
                    name="defaultAmount"
                    required={false}
                    defaultCents={item?.defaultAmountCents ?? undefined}
                  />
                </div>
                <div>
                  <Label htmlFor="catalog-interval" className="mb-1.5">
                    Ciclo
                  </Label>
                  <NativeSelect
                    id="catalog-interval"
                    name="interval"
                    defaultValue={item?.interval ?? ""}
                    className="bg-field"
                  >
                    <NativeSelectOption value="">Sem recorrência</NativeSelectOption>
                    <NativeSelectOption value="monthly">Mensal</NativeSelectOption>
                    <NativeSelectOption value="yearly">Anual</NativeSelectOption>
                  </NativeSelect>
                </div>
              </div>
              {kind === "service" &&
                SERVICE_FIELDS.map((field) => (
                  <div key={field.name}>
                    <Label htmlFor={`catalog-${field.name}`} className="mb-1.5">
                      {field.label}
                    </Label>
                    <Textarea
                      id={`catalog-${field.name}`}
                      name={field.name}
                      maxLength={5000}
                      rows={4}
                      defaultValue={item?.[field.name] ?? ""}
                      placeholder={field.placeholder}
                      className="min-h-24"
                    />
                  </div>
                ))}
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Salvando…">{item ? "Salvar" : "Adicionar ao catálogo"}</SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}
