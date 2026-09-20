"use client";
import { useState } from "react";
import { Field } from "./ui";
export function CompanyPicker({
  companies,
  engagements = [],
}: {
  companies: { id: string; name: string }[];
  engagements?: { id: string; name: string; companyId: string }[];
}) {
  const [company, setCompany] = useState(
    companies.length === 1 ? companies[0].id : "",
  );
  return (
    <>
      <Field label="Empresa">
        <select
          name="companyId"
          required
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="" disabled>
            Selecione a empresa
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Produto ou projeto (opcional)"
        hint={
          company
            ? "Produtos e projetos da empresa selecionada."
            : "Selecione uma empresa para consultar os produtos e projetos disponíveis."
        }
      >
        <select name="engagementId" key={company} defaultValue="">
          <option value="">Sem vínculo específico</option>
          {engagements
            .filter((e) => e.companyId === company)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </Field>
    </>
  );
}
