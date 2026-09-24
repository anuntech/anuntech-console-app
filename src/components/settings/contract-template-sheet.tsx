"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { saveContractTemplate } from "@/lib/contract-actions";
import { CONTRACT_VARIABLES } from "@/lib/contract-templates";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <ServerForm
          key={open ? (template?.id ?? "new") : "closed"}
          action={saveContractTemplate}
          onSuccess={() => onOpenChange(false)}
          className="flex h-full min-h-0 flex-col"
        >
          {template?.id && <input type="hidden" name="id" value={template.id} />}
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{template ? "Editar modelo" : "Novo modelo de contrato"}</SheetTitle>
            <SheetDescription>
              Cole o texto do contrato e use os campos entre chaves onde os dados do cliente entram.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            <div className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div>
                  <Label htmlFor="template-name" className="mb-1.5">
                    Nome
                  </Label>
                  <Input
                    id="template-name"
                    name="name"
                    required
                    maxLength={160}
                    autoFocus
                    defaultValue={template?.name ?? ""}
                    placeholder="Ex.: Prestação de serviços"
                  />
                </div>
                <div>
                  <Label htmlFor="template-description" className="mb-1.5">
                    Quando usar
                  </Label>
                  <Input
                    id="template-description"
                    name="description"
                    maxLength={500}
                    defaultValue={template?.description ?? ""}
                    placeholder="Ex.: Serviços recorrentes com mensalidade"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="template-body" className="mb-1.5">
                  Texto do contrato
                </Label>
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
              </div>
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
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Salvando…">{template ? "Salvar" : "Criar modelo"}</SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}
