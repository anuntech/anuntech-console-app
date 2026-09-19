"use client";
import { toast } from "./notifications";
import { NumberFormatBase } from "react-number-format";
import {
  formatDocument,
  formatPhone,
  onlyDigits,
  phoneDigits,
} from "@/lib/company-input";
import { useRef, useState, useEffect } from "react";
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
}: {
  inviteToken?: string;
  lockDocument?: boolean;
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
  const current = useRef(values);
  const edits = useRef<Record<string, number>>({});
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notice = useRef<string | number | undefined>(undefined);
  const cancel = () => {
    active.current?.abort();
    if (notice.current !== undefined) toast.dismiss(notice.current);
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(
    () => () => {
      active.current?.abort();
      if (notice.current !== undefined) toast.dismiss(notice.current);
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function lookup(kind: LookupKind, before = { ...edits.current }) {
    cancel();
    const value = digits(current.current[kind === "cnpj" ? "document" : "cep"]);
    if (value.length !== (kind === "cnpj" ? 14 : 8)) return;
    const sequence = generation.current;
    const controller = new AbortController();
    active.current = controller;
    const noticeId = toast.loading(
      `Consultando ${kind === "cnpj" ? "CNPJ" : "CEP"}…`,
    );
    notice.current = noticeId;
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
        toast.error(
          data.error || "Não foi possível consultar. Preencha manualmente.",
          { id: noticeId, duration: 10000 },
        );
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
      toast.success(
        kind === "cnpj"
          ? "Dados encontrados. Revise o cadastro antes de salvar."
          : "Endereço encontrado. Confira número, complemento e os campos que faltarem antes de salvar.",
        { id: noticeId, duration: 6000 },
      );
    } catch {
      if (!controller.signal.aborted)
        toast.error(
          "Não foi possível consultar. Você pode preencher os dados manualmente.",
          { id: noticeId, duration: 10000 },
        );
    }
  }
  function change(key: string, value: string) {
    edits.current[key] = (edits.current[key] || 0) + 1;
    const next = { ...current.current, [key]: value };
    current.current = next;
    setValues(next);
    if (key === "document" || key === "cep") {
      cancel();

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
            Dados da empresa e canais para comunicação financeira.
          </p>
        </div>
        <div className="form-grid">
          <Field
            label="CPF ou CNPJ"
            hint="Ao completar um CNPJ, a razão social e o endereço são consultados automaticamente. CPF é preenchido manualmente."
          >
            <NumberFormatBase
              format={formatDocument}
              removeFormatting={onlyDigits}
              valueIsNumericString
              onValueChange={(v, info) => {
                if (info.source === "event") change("document", v.value);
              }}
              name="document"
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
              required
              maxLength={160}
              value={values.name}
              onChange={handleChange}
            />
          </Field>
          <Field label="E-mail financeiro">
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
          <Field
            label="Telefone"
            hint="Informe o DDD e o número. Ex.: (11) 99999-9999."
          >
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
      </section>
      <section className="form-section">
        <div className="section-heading">
          <h2>Endereço de cobrança e nota fiscal</h2>
          <p className="muted">
            {inviteToken
              ? "Preencha o endereço completo para cobrança e nota fiscal."
              : "Salvo no cadastro para uso nas cobranças e notas fiscais. Você pode completar depois, antes de emitir uma cobrança."}
          </p>
        </div>
        <div className="form-grid">
          <Field
            label="CEP"
            hint="Ao completar os 8 dígitos, o endereço é consultado automaticamente."
          >
            <input
              name="cep"
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
          <Field label="Código IBGE do município (opcional)">
            <input
              name="codigoMunicipio"
              inputMode="numeric"
              maxLength={7}
              value={values.codigoMunicipio}
              onChange={handleChange}
            />
          </Field>
        </div>
      </section>
      {!inviteToken && (
        <section className="form-section">
          <div className="section-heading">
            <h2>Nota fiscal</h2>
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              name="autoIssueNfse"
              value="yes"
              defaultChecked={company?.autoIssueNfse || false}
            />{" "}
            Emitir nota fiscal automaticamente para este cliente
          </label>
          <p className="muted">
            Desmarcado: nenhuma emissão automática. A preferência fica salva; a
            emissão de NFS-e ainda depende da conclusão da integração fiscal e
            dos dados do serviço da Anuntech.
          </p>
        </section>
      )}
    </>
  );
}
