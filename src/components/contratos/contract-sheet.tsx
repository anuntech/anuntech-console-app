"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import { DateField } from "@/components/console/date-field";
import { FormField } from "@/components/console/form-field";
import { FormSheet, useRouteSheet } from "@/components/console/form-sheet";
import {
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createContract } from "@/lib/contracts/contract-actions";
import { dateLabel } from "@/lib/format";

export type NewContractData = {
  companies: CompanyOption[];
  templates: { id: string; name: string; description: string | null }[];
  engagements: { id: string; name: string; kind: string; companyId: string }[];
  companyId?: string;
  engagementId?: string;
  /** The accepted proposal this contract formalizes; its scope, values and timeline fill the text. */
  quote?: { id: string; label: string; company: string; companyId: string };
  /** The template to start with. */
  templateId?: string;
  /** An amendment that extends the term: its new dates. */
  renewal?: { startsAt: string; endsAt: string };
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

/**
 * Company, template, the item it covers and the validity; the text is filled
 * from the template. Rendered as siblings so the sheet and the card space
 * them with their own `gap-5`.
 */
export function NewContractFields({ companies, templates, engagements, companyId, engagementId, parent, quote, templateId: preferred, renewal }: NewContractData) {
  // One company: nothing to choose, so it travels as a hidden value.
  const only = companies.length === 1 ? companies[0].id : null;
  const [company, setCompany] = useState(parent?.companyId ?? quote?.companyId ?? only ?? companyId ?? companies[0]?.id ?? "");
  const [templateId, setTemplateId] = useState(parent ? "" : (preferred ?? templates[0]?.id ?? ""));
  const [startsAt, setStartsAt] = useState(renewal?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(renewal?.endsAt ?? "");
  const template = templates.find((t) => t.id === templateId);
  const items = engagements.filter((e) => e.companyId === company);
  const preselected = parent?.engagementId ?? engagementId;
  return (
    <>
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
      ) : quote ? (
        <>
          <input type="hidden" name="companyId" value={quote.companyId} />
          <input type="hidden" name="quoteId" value={quote.id} />
          <div className="rounded-lg border bg-field/60 px-4 py-3 text-sm">
            <p className="text-xs font-medium text-muted-foreground">A partir do orçamento aceito</p>
            <p className="mt-0.5 font-medium text-foreground">{quote.label}</p>
            <p className="text-xs text-muted-foreground">
              {quote.company} · escopo, entregáveis, valores e prazo entram nos campos do modelo
            </p>
          </div>
        </>
      ) : only ? (
        <input type="hidden" name="companyId" value={only} />
      ) : (
        <FormField label="Empresa" htmlFor="contract-company">
          <CompanyField
            id="contract-company"
            name="companyId"
            required
            companies={companies}
            value={company}
            onChange={setCompany}
          />
        </FormField>
      )}
      <FormField
        label="Modelo"
        htmlFor="contract-template"
        hint={
          template?.description ??
          (parent
            ? "Um texto curto que cita o contrato original; você escreve o que muda."
            : templates.length
              ? "Os campos do modelo são preenchidos com os dados da empresa."
              : "Nenhum modelo ainda; cadastre em Configurações › Contratos.")
        }
      >
        <NativeSelect
          id="contract-template"
          name="templateId"
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
        >
          <NativeSelectOption value="">{parent ? "Aditivo simples (objeto e ratificação)" : "Em branco"}</NativeSelectOption>
          {templates.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {option.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        label="Vinculado a"
        htmlFor="contract-engagement"
        hint="Preenche produto, valor e ciclo no texto, quando o modelo usa esses campos."
      >
        <NativeSelect
          id="contract-engagement"
          name="engagementId"
          key={company}
          defaultValue={items.some((e) => e.id === preselected) ? preselected : ""}
        >
          <NativeSelectOption value="">Nenhum item</NativeSelectOption>
          {items.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.name} · {kindLabel[item.kind] ?? item.kind}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FormField>
      <div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label={parent ? "Nova vigência: início" : "Início da vigência"} htmlFor="contract-starts">
            <DateField id="contract-starts" name="startsAt" value={startsAt} onChange={setStartsAt} placeholder="Sem data" />
          </FormField>
          <FormField label={parent ? "Nova vigência: fim" : "Fim da vigência"} htmlFor="contract-ends">
            <DateField id="contract-ends" name="endsAt" value={endsAt} onChange={setEndsAt} min={startsAt || undefined} placeholder="Sem data" />
          </FormField>
        </div>
        {renewal && <input type="hidden" name="renewal" value="yes" />}
        <p className="mt-1.5 text-xs text-muted-foreground">
          {renewal
            ? "A prorrogação começa no dia seguinte ao fim do contrato e dura o mesmo tempo. Assinado, o aditivo passa a valer para o original."
            : parent
            ? "Só se o aditivo prorrogar ou encurtar o contrato. Assinado, passa a valer para o original."
            : "Preenche {{inicio}} e {{fim}} no modelo e dispara o alerta 30 dias antes do fim. Dá para ajustar depois."}
        </p>
      </div>
      <FormField label="Título" htmlFor="contract-title">
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
      </FormField>
    </>
  );
}

/** /contratos/novo reached by navigation. */
export function NewContractSheet(data: NewContractData) {
  const sheet = useRouteSheet();
  return (
    <FormSheet
      {...sheet}
      title={data.parent ? "Novo aditivo" : "Novo contrato"}
      description="Nasce como rascunho; você revisa o texto antes de enviar."
      action={createContract}
      submitLabel="Criar rascunho"
      pendingLabel="Criando…"
    >
      <NewContractFields {...data} />
    </FormSheet>
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
