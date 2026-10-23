"use client";
import { useEffect, useId, useRef, useState } from "react";
import { NumberFormatBase } from "react-number-format";
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/shell/notifications";
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
} from "@/lib/companies/company-input";
import {
  digits,
  lookupFields,
  mergeLookupFields,
  type LookupKind,
} from "@/lib/companies/company-lookup";
import { payerAddress } from "@/lib/billing/billing-rules";
import type { CompanyAddress } from "@/lib/companies/company-billing";

/** The other e-mails and phones that receive billing notices, beyond the main ones (the team's form only). */
export type FinanceExtras = { emails: string[]; phones: string[] };

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
  cnpjLookup = lookupEnabled,
  fiscalSettings = true,
  lockDocument = false,
  financeExtras,
}: {
  company?: CompanyFormValues | null;
  /** Shows "Adicionar outro e-mail/telefone"; the client edits the same list in Notificações instead. */
  financeExtras?: FinanceExtras;
  lookupEnabled?: boolean;
  /** The CNPJ lookup (Receita) is the team's; a client's Administrador only fills by CEP. */
  cnpjLookup?: boolean;
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
    if (!lookupEnabled || (kind === "cnpj" && !cnpjLookup)) return;
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
          "Não foi possível consultar. Preencha os dados manualmente.",
        );
    } finally {
      if (sequence === generation.current) setLooking(null);
    }
  }
  // A saved company without a full address: Receita's address fills only what is empty, for the person to check.
  const ADDRESS_KEYS = ["endereco", "numero", "complemento", "bairro", "cidade", "uf", "cep", "codigoMunicipio"] as const;
  const addressMissing = ["endereco", "numero", "bairro", "cidade", "uf", "cep"].some((key) => !values[key]?.trim());
  async function fillAddressFromReceita() {
    const cnpj = digits(current.current.document);
    if (cnpj.length !== 14) return;
    cancel();
    const controller = new AbortController();
    active.current = controller;
    setLooking("cnpj");
    try {
      const res = await fetch(`/api/cadastro/consulta?tipo=cnpj&valor=${cnpj}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Não foi possível consultar a Receita. Preencha o endereço manualmente.");
        return;
      }
      const fields = lookupFields.parse(data.fields);
      const next = { ...current.current };
      let filled = 0;
      for (const key of ADDRESS_KEYS)
        if (!next[key]?.trim() && fields[key]) {
          next[key] = fields[key]!;
          filled += 1;
        }
      current.current = next;
      setValues(next);
      if (filled) toast.success("Endereço da Receita preenchido. Confira se é o de cobrança antes de salvar.");
      else toast.error("A Receita não trouxe o que falta. Preencha o endereço manualmente.");
    } catch {
      if (!controller.signal.aborted) toast.error("Não foi possível consultar a Receita. Preencha o endereço manualmente.");
    } finally {
      setLooking(null);
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
        {financeExtras && <input type="hidden" name="financeContacts" value="1" />}
        <div className="flex flex-col gap-2">
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
          {financeExtras && <ExtraContacts kind="email" initial={financeExtras.emails} />}
        </div>
        <div className="flex flex-col gap-2">
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
          {financeExtras && <ExtraContacts kind="phone" initial={financeExtras.phones} />}
        </div>
      </FormSection>

      <Separator />

      <FormSection
        title="Endereço de cobrança e nota fiscal"
        className="sm:grid-cols-6"
      >
        {cnpjLookup && addressMissing && digits(values.document).length === 14 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning-edge bg-warning-soft px-3 py-2 text-xs text-warning sm:col-span-6">
            <span className="min-w-0 flex-1">Falta o endereço completo. Sem ele, a cobrança e a nota não saem.</span>
            <button
              type="button"
              onClick={() => void fillAddressFromReceita()}
              disabled={looking === "cnpj"}
              className="shrink-0 rounded-md border border-warning-edge bg-card px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              {looking === "cnpj" ? "Buscando…" : "Buscar na Receita"}
            </button>
          </div>
        )}
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

/** The extra e-mails or phones under the main one: each can be removed; up to nine more (ten in all). */
function ExtraContacts({ kind, initial }: { kind: "email" | "phone"; initial: string[] }) {
  const id = useId();
  const [items, setItems] = useState(initial);
  const label = kind === "email" ? "e-mail" : "telefone";
  return (
    <>
      {items.map((value, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <label htmlFor={`${id}-${index}`} className="sr-only">
            Outro {label} do financeiro {index + 1}
          </label>
          {kind === "email" ? (
            <Input
              id={`${id}-${index}`}
              name="financeEmails"
              type="email"
              value={value}
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              placeholder="nome@empresa.com.br"
              onChange={(e) => setItems((all) => all.map((item, i) => (i === index ? e.target.value.trim().toLowerCase() : item)))}
            />
          ) : (
            <NumberFormatBase
              customInput={Input}
              id={`${id}-${index}`}
              name="financePhones"
              type="tel"
              format={formatPhone}
              removeFormatting={phoneDigits}
              valueIsNumericString
              value={value}
              placeholder="(11) 99999-9999"
              maxLength={30}
              onValueChange={(v, info) => {
                if (info.source === "event") setItems((all) => all.map((item, i) => (i === index ? v.value : item)));
              }}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remover ${label} ${index + 2}`}
            onClick={() => setItems((all) => all.filter((_, i) => i !== index))}
          >
            <XIcon />
          </Button>
        </div>
      ))}
      {items.length < 9 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => setItems((all) => [...all, ""])}
        >
          <PlusIcon />
          {kind === "email" ? "Adicionar outro e-mail" : "Adicionar outro telefone"}
        </Button>
      )}
    </>
  );
}
