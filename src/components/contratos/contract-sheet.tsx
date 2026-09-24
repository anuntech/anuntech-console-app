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
import { createContract } from "@/lib/contract-actions";
import { dateLabel } from "@/lib/format";

export type NewContractData = {
  companies: CompanyOption[];
  templates: { id: string; name: string; description: string | null }[];
  engagements: { id: string; name: string; kind: string; companyId: string }[];
  companyId?: string;
  engagementId?: string;
  /** Set when the new document amends a signed contract. */
  parent?: {
    id: string;
    title: string;
    companyId: string;
    company: string;
    engagementId: string | null;
    endsAt: string | null;
    amendments: number;
  };
};

const kindLabel: Record<string, string> = { product: "produto", service: "serviço", project: "projeto" };

/** Company, template, the item it covers and the validity; the text is filled from the template. */
export function NewContractFields({ companies, templates, engagements, companyId, engagementId, parent }: NewContractData) {
  const [company, setCompany] = useState(parent?.companyId ?? companyId ?? companies[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(parent ? "" : (templates[0]?.id ?? ""));
  const [startsAt, setStartsAt] = useState("");
  const template = templates.find((t) => t.id === templateId);
  const items = engagements.filter((e) => e.companyId === company);
  const preselected = parent?.engagementId ?? engagementId;
  return (
    <div className="grid gap-5">
      {parent ? (
        <>
          <input type="hidden" name="parentId" value={parent.id} />
          <div className="rounded-lg border bg-field/60 px-4 py-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">Aditivo ao contrato</p>
            <p className="mt-0.5 font-medium text-foreground">{parent.title}</p>
            <p className="text-xs text-muted-foreground">
              {parent.company}
              {parent.endsAt && ` · vigência até ${dateLabel(parent.endsAt)}`}
            </p>
          </div>
        </>
      ) : (
        <div>
          <Label htmlFor="contract-company" className="mb-1.5">
            Empresa
          </Label>
          <CompanyField
            id="contract-company"
            name="companyId"
            required
            companies={companies}
            value={company}
            onChange={setCompany}
          />
        </div>
      )}
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
          <NativeSelectOption value="">{parent ? "Aditivo simples (objeto e ratificação)" : "Em branco"}</NativeSelectOption>
          {templates.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {option.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {template?.description ??
            (parent
              ? "Um texto curto que cita o contrato original; você escreve o que muda."
              : templates.length
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
          defaultValue={items.some((e) => e.id === preselected) ? preselected : ""}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="contract-starts" className="mb-1.5">
              {parent ? "Nova vigência: início" : "Início da vigência"}
            </Label>
            <DateField id="contract-starts" name="startsAt" value={startsAt} onChange={setStartsAt} placeholder="Sem data" />
          </div>
          <div>
            <Label htmlFor="contract-ends" className="mb-1.5">
              {parent ? "Nova vigência: fim" : "Fim da vigência"}
            </Label>
            <DateField id="contract-ends" name="endsAt" min={startsAt || undefined} placeholder="Sem data" />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {parent
            ? "Só se o aditivo prorrogar ou encurtar o contrato. Assinado, passa a valer para o original."
            : "Preenche {{inicio}} e {{fim}} no modelo e dispara o alerta 30 dias antes do fim. Dá para ajustar depois."}
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
          placeholder={
            parent
              ? `Aditivo ${parent.amendments + 1} — ${parent.title}`
              : template
                ? `${template.name} — nome da empresa`
                : "Ex.: Contrato de prestação de serviços"
          }
        />
      </div>
    </div>
  );
}

/** /contratos/novo reached by navigation. */
export function NewContractSheet(data: NewContractData) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const amendment = !!data.parent;
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
            <SheetTitle>{amendment ? "Novo aditivo" : "Novo contrato"}</SheetTitle>
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
            <Link href={data.parent ? `/contratos/${data.parent.id}` : "/contratos"}>Cancelar</Link>
          </Button>
          <SubmitButton pendingLabel="Criando…">Criar rascunho</SubmitButton>
        </CardFooter>
      </ServerForm>
    </Card>
  );
}
