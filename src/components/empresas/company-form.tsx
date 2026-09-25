"use client";
import { useEffect, useId, useRef, useState } from "react";
import { NumberFormatBase } from "react-number-format";
import { Loader2Icon } from "lucide-react";
import { toast } from "@/components/notifications";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { FormField, FormSection } from "@/components/console/form-field";
import {
  formatDocument,
  formatPhone,
  onlyDigits,
  phoneDigits,
} from "@/lib/company-input";
import {
  digits,
  lookupFields,
  mergeLookupFields,
  type LookupKind,
} from "@/lib/company-lookup";
import { payerAddress } from "@/lib/billing-rules";
import type { CompanyAddress } from "@/lib/company-billing";

export type CompanyFormValues = {
  name: string;
  document: string;
  billingEmail: string;
  phone: string | null;
  billingAddress: CompanyAddress | null;
  autoIssueNfse: boolean;
};

const UF = payerAddress.shape.uf.options;

/**
 * The company form used to create and edit a client. Field names match the
 * server actions (companyIdentity + companyBillingInput). Completing a CNPJ or
 * CEP fills the rest quietly; only failures interrupt, as a toast.
 */
export function CompanyFields({
  company,
  lookupEnabled = true,
  fiscalSettings = true,
  lockDocument = false,
}: {
  company?: CompanyFormValues | null;
  lookupEnabled?: boolean;
  fiscalSettings?: boolean;
  lockDocument?: boolean;
}) {
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>(() => ({
    name: company?.name || "",
    document: company?.document || "",
    billingEmail: company?.billingEmail || "",
    phone: company?.phone || "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    cep: "",
    codigoMunicipio: "",
    ...company?.billingAddress,
  }));
  const [looking, setLooking] = useState<LookupKind | null>(null);
  const current = useRef(values);
  const edits = useRef<Record<string, number>>({});
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    active.current?.abort();
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(
    () => () => {
      active.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function lookup(kind: LookupKind, before = { ...edits.current }) {
    if (!lookupEnabled) return;
    cancel();
    const value = digits(current.current[kind === "cnpj" ? "document" : "cep"]);
    if (value.length !== (kind === "cnpj" ? 14 : 8)) return;
    const sequence = generation.current;
    const controller = new AbortController();
    active.current = controller;
    setLooking(kind);
    try {
      const res = await fetch(
        `/api/cadastro/consulta?tipo=${kind}&valor=${value}`,
        { signal: controller.signal },
      );
      const data = await res.json();
      if (sequence !== generation.current) return;
      if (!res.ok) {
        toast.error(
          data.error || "Não foi possível consultar. Preencha manualmente.",
        );
        return;
      }
      const merged = mergeLookupFields(
        current.current,
        lookupFields.parse(data.fields),
        before,
        edits.current,
      );
      current.current = merged;
      setValues(merged);
    } catch {
      if (!controller.signal.aborted)
        toast.error(
          "Não foi possível consultar. Você pode preencher os dados manualmente.",
        );
    } finally {
      if (sequence === generation.current) setLooking(null);
    }
  }
  function change(key: string, value: string) {
    edits.current[key] = (edits.current[key] || 0) + 1;
    const next = { ...current.current, [key]: value };
    current.current = next;
    setValues(next);
    if (key === "document" || key === "cep") {
      cancel();
      setLooking(null);
      const kind = key === "document" ? "cnpj" : "cep";
      if (digits(value).length === (kind === "cnpj" ? 14 : 8)) {
        const before = { ...edits.current };
        timer.current = setTimeout(() => void lookup(kind, before), 650);
      }
    }
  }
  const spinner = (kind: LookupKind) =>
    looking === kind ? (
      <Loader2Icon
        aria-label={`Consultando ${kind === "cnpj" ? "CNPJ" : "CEP"}`}
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
      />
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      <FormSection title="Identificação" className="sm:grid-cols-2">
        <FormField label="CNPJ" htmlFor={`${id}-document`}>
          <div className="relative">
            <NumberFormatBase
              customInput={Input}
              id={`${id}-document`}
              name="document"
              format={formatDocument}
              removeFormatting={onlyDigits}
              valueIsNumericString
              value={values.document}
              onValueChange={(v, info) => {
                if (info.source === "event") change("document", v.value);
              }}
              inputMode="numeric"
              autoComplete="off"
              required
              readOnly={lockDocument}
              maxLength={18}
              className={looking === "cnpj" ? "pr-9" : undefined}
            />
            {spinner("cnpj")}
          </div>
        </FormField>
        <FormField label="Razão social" htmlFor={`${id}-name`}>
          <Input
            id={`${id}-name`}
            name="name"
            value={values.name}
            onChange={(e) => change("name", e.target.value)}
            autoComplete="organization"
            required
            maxLength={160}
          />
        </FormField>
      </FormSection>

      <Separator />

      <FormSection title="Contato financeiro" className="sm:grid-cols-2">
        <FormField label="E-mail" htmlFor={`${id}-billingEmail`}>
          <Input
            id={`${id}-billingEmail`}
            name="billingEmail"
            value={values.billingEmail}
            onChange={(e) =>
              change("billingEmail", e.target.value.trim().toLowerCase())
            }
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
          />
        </FormField>
        <FormField label="Telefone" htmlFor={`${id}-phone`}>
          <NumberFormatBase
            customInput={Input}
            id={`${id}-phone`}
            name="phone"
            type="tel"
            format={formatPhone}
            removeFormatting={phoneDigits}
            valueIsNumericString
            value={values.phone}
            onValueChange={(v, info) => {
              if (info.source === "event") change("phone", v.value);
            }}
            autoComplete="tel-national"
            required
            maxLength={30}
          />
        </FormField>
      </FormSection>

      <Separator />

      <FormSection
        title="Endereço de cobrança e nota fiscal"
        className="sm:grid-cols-6"
      >
        <FormField label="CEP" htmlFor={`${id}-cep`} className="sm:col-span-2">
          <div className="relative">
            <Input
              id={`${id}-cep`}
              name="cep"
              value={values.cep}
              onChange={(e) => change("cep", e.target.value)}
              inputMode="numeric"
              maxLength={9}
              autoComplete="postal-code"
              className={looking === "cep" ? "pr-9" : undefined}
            />
            {spinner("cep")}
          </div>
        </FormField>
        <FormField
          label="Endereço"
          htmlFor={`${id}-endereco`}
          className="sm:col-span-4"
        >
          <Input
            id={`${id}-endereco`}
            name="endereco"
            value={values.endereco}
            onChange={(e) => change("endereco", e.target.value)}
            maxLength={100}
            autoComplete="address-line1"
          />
        </FormField>
        <FormField
          label="Número"
          htmlFor={`${id}-numero`}
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-numero`}
            name="numero"
            value={values.numero}
            onChange={(e) => change("numero", e.target.value)}
            maxLength={10}
          />
        </FormField>
        <FormField
          label="Complemento"
          htmlFor={`${id}-complemento`}
          className="sm:col-span-4"
        >
          <Input
            id={`${id}-complemento`}
            name="complemento"
            value={values.complemento}
            onChange={(e) => change("complemento", e.target.value)}
            maxLength={30}
            autoComplete="address-line2"
          />
        </FormField>
        <FormField
          label="Bairro"
          htmlFor={`${id}-bairro`}
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-bairro`}
            name="bairro"
            value={values.bairro}
            onChange={(e) => change("bairro", e.target.value)}
            maxLength={60}
            autoComplete="address-level3"
          />
        </FormField>
        <FormField
          label="Cidade"
          htmlFor={`${id}-cidade`}
          className="sm:col-span-3"
        >
          <Input
            id={`${id}-cidade`}
            name="cidade"
            value={values.cidade}
            onChange={(e) => change("cidade", e.target.value)}
            maxLength={60}
            autoComplete="address-level2"
          />
        </FormField>
        <FormField label="UF" htmlFor={`${id}-uf`} className="sm:col-span-1">
          {/* The empty option keeps "no address" possible: the server takes
                the address all or nothing. */}
          <NativeSelect
            id={`${id}-uf`}
            name="uf"
            value={values.uf}
            onChange={(e) => change("uf", e.target.value)}
            autoComplete="address-level1"
          >
            <NativeSelectOption value="">—</NativeSelectOption>
            {UF.map((uf) => (
              <NativeSelectOption key={uf} value={uf}>
                {uf}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        <input
          type="hidden"
          name="codigoMunicipio"
          value={values.codigoMunicipio}
        />
      </FormSection>

      {fiscalSettings && (
        <>
          <Separator />
          <FormSection title="Nota fiscal">
            <label
              htmlFor={`${id}-nfse`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-field/60 p-3.5 text-sm"
            >
              <Checkbox
                id={`${id}-nfse`}
                name="autoIssueNfse"
                value="yes"
                defaultChecked={company?.autoIssueNfse || false}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">
                  Emitir nota fiscal automaticamente
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Para cada cobrança paga deste cliente.
                </span>
              </span>
            </label>
          </FormSection>
        </>
      )}
    </div>
  );
}
