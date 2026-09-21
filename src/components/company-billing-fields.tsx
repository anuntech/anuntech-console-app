"use client";
import { NumberFormatBase } from "react-number-format";
import {
  formatDocument,
  formatPhone,
  onlyDigits,
  phoneDigits,
} from "@/lib/company-input";
import { useId, useRef, useState, useEffect } from "react";
import {
  digits,
  lookupFields,
  mergeLookupFields,
  type LookupKind,
} from "@/lib/company-lookup";
import { Field } from "./ui";
import { payerAddress } from "@/lib/billing-rules";
import type { CompanyAddress } from "@/lib/company-billing";

export function CompanyBillingFields({
  company,
  inviteToken,
  lockDocument = false,
  fiscalSettings = true,
  lookupEnabled = true,
  environmentSettings = false,
}: {
  inviteToken?: string;
  lockDocument?: boolean;
  fiscalSettings?: boolean;
  lookupEnabled?: boolean;
  environmentSettings?: boolean;
  company?: {
    name: string;
    document: string;
    billingEmail: string;
    phone: string | null;
    billingAddress: CompanyAddress | null;
    autoIssueNfse: boolean;
  };
}) {
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
  const feedbackId = useId();
  const [lookupFeedback, setLookupFeedback] = useState<{
    kind: LookupKind;
    message: string;
  } | null>(null);
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
    setLookupFeedback({
      kind,
      message: `Consultando ${kind === "cnpj" ? "CNPJ" : "CEP"}…`,
    });
    try {
      const res = await fetch(
        `/api/cadastro/consulta?tipo=${kind}&valor=${value}`,
        {
          signal: controller.signal,
          headers: inviteToken ? { "X-Company-Invite": inviteToken } : {},
        },
      );
      const data = await res.json();
      if (sequence !== generation.current) return;
      if (!res.ok) {
        setLookupFeedback({
          kind,
          message:
            data.error || "Não foi possível consultar. Preencha manualmente.",
        });
        return;
      }
      const fields = lookupFields.parse(data.fields);
      const merged = mergeLookupFields(
        current.current,
        fields,
        before,
        edits.current,
      );
      current.current = merged;
      setValues(merged);
      setLookupFeedback({
        kind,
        message:
          kind === "cnpj"
            ? "Dados encontrados. Revise o cadastro antes de salvar."
            : "Endereço encontrado. Confira número, complemento e os campos que faltarem antes de salvar.",
      });
    } catch {
      if (!controller.signal.aborted)
        setLookupFeedback({
          kind,
          message:
            "Não foi possível consultar. Você pode preencher os dados manualmente.",
        });
    }
  }
  function change(key: string, value: string) {
    edits.current[key] = (edits.current[key] || 0) + 1;
    const next = { ...current.current, [key]: value };
    current.current = next;
    setValues(next);
    if (key === "document" || key === "cep") {
      cancel();
      setLookupFeedback(null);

      const kind = key === "document" ? "cnpj" : "cep";
      if (digits(value).length === (kind === "cnpj" ? 14 : 8)) {
        const before = { ...edits.current };
        timer.current = setTimeout(() => void lookup(kind, before), 650);
      }
    }
  }
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    change(
      e.target.name,
      e.target.name === "billingEmail"
        ? e.target.value.trim().toLowerCase()
        : e.target.value,
    );
  }
  return (
    <>
      <section className="form-section">
        <div className="section-heading">
          <h2>Identificação e contato</h2>
          <p className="muted">
            {environmentSettings
              ? "Informações de identificação do seu ambiente."
              : "Dados da empresa e canais para comunicação financeira."}
          </p>
        </div>
        <div className="form-grid">
          <Field label="CPF ou CNPJ">
            <NumberFormatBase
              format={formatDocument}
              removeFormatting={onlyDigits}
              valueIsNumericString
              onValueChange={(v, info) => {
                if (info.source === "event") change("document", v.value);
              }}
              name="document"
              aria-describedby={`${feedbackId}-cnpj`}
              autoComplete="off"
              required
              inputMode="numeric"
              maxLength={18}
              readOnly={lockDocument}
              value={values.document}
            />
          </Field>
          <Field label="Nome ou razão social">
            <input
              name="name"
              autoComplete="organization"
              required
              maxLength={160}
              value={values.name}
              onChange={handleChange}
            />
          </Field>
          <Field
            label={
              environmentSettings ? "E-mail de contato" : "E-mail financeiro"
            }
          >
            <input
              name="billingEmail"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
              value={values.billingEmail}
              onChange={handleChange}
            />
          </Field>
          <Field label="Telefone">
            <NumberFormatBase
              format={formatPhone}
              removeFormatting={phoneDigits}
              valueIsNumericString
              required
              autoComplete="tel-national"
              onValueChange={(v, info) => {
                if (info.source === "event") change("phone", v.value);
              }}
              name="phone"
              type="tel"
              maxLength={30}
              value={values.phone}
            />
          </Field>
        </div>
        <p
          id={`${feedbackId}-cnpj`}
          role="status"
          aria-atomic="true"
          className={
            lookupFeedback?.kind === "cnpj" ? "form-footnote" : "sr-only"
          }
        >
          {lookupFeedback?.kind === "cnpj" ? lookupFeedback.message : ""}
        </p>
      </section>
      <section className="form-section">
        <div className="section-heading">
          <h2>
            {environmentSettings
              ? "Endereço"
              : "Endereço de cobrança e nota fiscal"}
          </h2>
          <p className="muted">
            {environmentSettings
              ? "Endereço cadastral da empresa."
              : inviteToken
                ? "Preencha o endereço completo para cobrança e nota fiscal."
                : "Salvo no cadastro para uso nas cobranças e notas fiscais. Você pode completar depois, antes de emitir uma cobrança."}
          </p>
        </div>
        <div className="form-grid">
          <Field label="CEP">
            <input
              name="cep"
              aria-describedby={`${feedbackId}-cep`}
              required={!!inviteToken}
              inputMode="numeric"
              maxLength={9}
              autoComplete="postal-code"
              value={values.cep}
              onChange={handleChange}
            />
          </Field>
          <Field label="Endereço">
            <input
              name="endereco"
              required={!!inviteToken}
              maxLength={100}
              value={values.endereco}
              onChange={handleChange}
              autoComplete="address-line1"
            />
          </Field>
          <Field label="Número">
            <input
              name="numero"
              required={!!inviteToken}
              maxLength={10}
              value={values.numero}
              onChange={handleChange}
            />
          </Field>
          <Field label="Complemento (opcional)">
            <input
              name="complemento"
              maxLength={30}
              value={values.complemento}
              onChange={handleChange}
              autoComplete="address-line2"
            />
          </Field>
          <Field label="Bairro">
            <input
              name="bairro"
              autoComplete="address-level3"
              required={!!inviteToken}
              maxLength={60}
              value={values.bairro}
              onChange={handleChange}
            />
          </Field>
          <Field label="Cidade">
            <input
              name="cidade"
              required={!!inviteToken}
              maxLength={60}
              value={values.cidade}
              onChange={handleChange}
              autoComplete="address-level2"
            />
          </Field>
          <Field label="UF">
            <select
              name="uf"
              required={!!inviteToken}
              value={values.uf}
              onChange={handleChange}
              autoComplete="address-level1"
            >
              <option value="">Selecione</option>
              {payerAddress.shape.uf.options.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </select>
          </Field>
          <input
            type="hidden"
            name="codigoMunicipio"
            value={values.codigoMunicipio}
          />
        </div>
        <p
          id={`${feedbackId}-cep`}
          role="status"
          aria-atomic="true"
          className={
            lookupFeedback?.kind === "cep" ? "form-footnote" : "sr-only"
          }
        >
          {lookupFeedback?.kind === "cep" ? lookupFeedback.message : ""}
        </p>
      </section>
      {!inviteToken && fiscalSettings && (
        <section className="form-section">
          <div className="section-heading">
            <h2>Nota fiscal</h2>
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              name="autoIssueNfse"
              aria-describedby={`${feedbackId}-nfse`}
              value="yes"
              defaultChecked={company?.autoIssueNfse || false}
            />{" "}
            Emitir nota fiscal automaticamente para este cliente
          </label>
          <p id={`${feedbackId}-nfse`} className="muted">
            Desmarcado: nenhuma emissão automática. A preferência fica salva; a
            emissão de NFS-e ainda depende da conclusão da integração fiscal e
            dos dados do serviço da Anuntech.
          </p>
        </section>
      )}
    </>
  );
}
