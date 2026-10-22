"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { MoneyField } from "@/components/console/money-field";
import { updateProject } from "@/lib/projects/task-actions";

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string | null;
  url: string | null;
  amountCents?: number | null;
  /** Linked recurrence: a new price also updates its next periods. */
  subscriptionId?: string | null;
};

/**
 * Edits a product already linked to a company; linking a new one starts
 * from the catalog (`/produtos/novo`). Field names match updateProject.
 */
export function ProductSheet({
  open,
  onOpenChange,
  values,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: ProductFormValues | null;
}) {
  // The list clears `values` as it closes; keep the last product on screen
  // while the sheet slides out.
  const [shown, setShown] = useState(values);
  if (values && values !== shown) setShown(values);
  if (!shown?.id) return null;
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar produto"
      action={updateProject}
      formKey={shown.id}
      submitLabel="Salvar"
    >
      <input type="hidden" name="id" value={shown.id} />
      <FormField label="Nome" htmlFor="product-name">
        <Input
          id="product-name"
          name="name"
          required
          maxLength={160}
          autoFocus
          defaultValue={shown.name}
          placeholder="Ex.: Synova"
        />
      </FormField>
      <FormField label="Link do produto" htmlFor="product-url">
        <Input
          id="product-url"
          name="url"
          type="url"
          inputMode="url"
          maxLength={2048}
          defaultValue={shown.url ?? ""}
          placeholder="https://"
        />
      </FormField>
      <FormField
        label="Valor para esta empresa"
        htmlFor="product-amount"
        hint={
          shown.subscriptionId
            ? "Atualiza a recorrência ligada para os próximos períodos; faturas já emitidas não mudam."
            : "Só informativo: este item não tem recorrência ligada."
        }
      >
        <MoneyField
          id="product-amount"
          required={false}
          defaultCents={shown.amountCents ?? undefined}
        />
      </FormField>
      <FormField label="Descrição" htmlFor="product-description">
        <Textarea
          id="product-description"
          name="description"
          maxLength={3000}
          rows={4}
          defaultValue={shown.description ?? ""}
          placeholder="O que o produto faz para a empresa."
          className="min-h-24"
        />
      </FormField>
    </FormSheet>
  );
}
