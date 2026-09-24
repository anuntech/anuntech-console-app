"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createContract } from "@/lib/contract-actions";

export type NewContractData = {
  companies: { id: string; name: string }[];
  templates: { id: string; name: string; description: string | null }[];
  engagements: { id: string; name: string; kind: string; companyId: string }[];
  companyId?: string;
  engagementId?: string;
};

const kindLabel: Record<string, string> = { product: "produto", service: "serviço", project: "projeto" };

/** Company, template and the item it covers; the text is filled from the template. */
export function NewContractFields({ companies, templates, engagements, companyId, engagementId }: NewContractData) {
  const [company, setCompany] = useState(companyId ?? companies[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const template = templates.find((t) => t.id === templateId);
  const items = engagements.filter((e) => e.companyId === company);
  return (
    <div className="grid gap-5">
      <div>
        <Label htmlFor="contract-company" className="mb-1.5">
          Empresa
        </Label>
        <NativeSelect
          id="contract-company"
          name="companyId"
          required
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          className="bg-field"
        >
          {companies.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {option.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor="contract-template" className="mb-1.5">
          Modelo
        </Label>
        <NativeSelect
          id="contract-template"
          name="templateId"
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
          className="bg-field"
        >
          <NativeSelectOption value="">Em branco</NativeSelectOption>
          {templates.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {option.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {template?.description ??
            (templates.length
              ? "Os campos do modelo são preenchidos com os dados da empresa."
              : "Nenhum modelo ainda; cadastre em Configurações › Contratos.")}
        </p>
      </div>
      <div>
        <Label htmlFor="contract-engagement" className="mb-1.5">
          Vinculado a
        </Label>
        <NativeSelect
          id="contract-engagement"
          name="engagementId"
          key={company}
          defaultValue={items.some((e) => e.id === engagementId) ? engagementId : ""}
          className="bg-field"
        >
          <NativeSelectOption value="">Nenhum item</NativeSelectOption>
          {items.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.name} · {kindLabel[item.kind] ?? item.kind}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Preenche produto, valor e ciclo no texto, quando o modelo usa esses campos.
        </p>
      </div>
      <div>
        <Label htmlFor="contract-title" className="mb-1.5">
          Título
        </Label>
        <Input
          id="contract-title"
          name="title"
          maxLength={160}
          placeholder={template ? `${template.name} — nome da empresa` : "Ex.: Contrato de prestação de serviços"}
        />
      </div>
    </div>
  );
}

/** /contratos/novo reached by navigation. */
export function NewContractSheet(data: NewContractData) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setOpen(false);
        setTimeout(() => router.back(), 300);
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <ServerForm action={createContract} className="flex h-full min-h-0 flex-col">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Novo contrato</SheetTitle>
            <SheetDescription>Nasce como rascunho; você revisa o texto antes de enviar.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <FormError className="mb-5" />
            <NewContractFields {...data} />
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4 sm:justify-end">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Criando…">Criar rascunho</SubmitButton>
          </SheetFooter>
        </ServerForm>
      </SheetContent>
    </Sheet>
  );
}

/** /contratos/novo on a direct load. */
export function NewContractForm(data: NewContractData) {
  return (
    <Card className="max-w-2xl">
      <ServerForm action={createContract} className="contents">
        <CardContent className="flex flex-col gap-5">
          <FormError />
          <NewContractFields {...data} />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/contratos">Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Criando…">Criar rascunho</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
