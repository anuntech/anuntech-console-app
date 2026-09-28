"use client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { saveContractTemplate } from "@/lib/contracts/contract-actions";
import { CONTRACT_VARIABLES } from "@/lib/contracts/contract-templates";

export type ContractTemplateValues = {
  id?: string;
  name: string;
  description: string | null;
  body: string;
};

/** The text of a model contract, with the placeholders it may use. */
export function ContractTemplateSheet({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ContractTemplateValues | null;
}) {
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="3xl"
      title={template ? "Editar modelo" : "Novo modelo de contrato"}
      description="Cole o texto do contrato e use os campos entre chaves onde os dados do cliente entram."
      action={saveContractTemplate}
      formKey={template?.id ?? "new"}
      submitLabel={template ? "Salvar" : "Criar modelo"}
      pendingLabel={template ? "Salvando…" : "Criando…"}
    >
      {template?.id && <input type="hidden" name="id" value={template.id} />}
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <FormField label="Nome" htmlFor="template-name">
          <Input
            id="template-name"
            name="name"
            required
            maxLength={160}
            autoFocus
            defaultValue={template?.name ?? ""}
            placeholder="Ex.: Prestação de serviços"
          />
        </FormField>
        <FormField label="Quando usar" htmlFor="template-description">
          <Input
            id="template-description"
            name="description"
            maxLength={500}
            defaultValue={template?.description ?? ""}
            placeholder="Ex.: Serviços recorrentes com mensalidade"
          />
        </FormField>
      </div>
      <FormField label="Texto do contrato" htmlFor="template-body">
        <Textarea
          id="template-body"
          name="body"
          required
          rows={24}
          maxLength={100000}
          defaultValue={template?.body ?? ""}
          placeholder={"CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nCONTRATANTE: {{empresa}}, CNPJ {{cnpj}}, com sede em {{endereco}}.\nCONTRATADA: {{anuntech}}, CNPJ {{anuntech_cnpj}}.\n\nCLÁUSULA 1 — OBJETO\n…"}
          className="min-h-[28rem] font-serif text-[15px] leading-7"
        />
      </FormField>
      <div className="rounded-lg border bg-field/60 px-4 py-3">
        <p className="text-xs font-medium text-foreground">Campos disponíveis</p>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
          {CONTRACT_VARIABLES.map((variable) => (
            <li key={variable.key} className="flex items-baseline gap-2">
              <code className="shrink-0 rounded bg-card px-1 py-px text-[11px] text-foreground">
                {`{{${variable.key}}}`}
              </code>
              <span>{variable.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </FormSheet>
  );
}
