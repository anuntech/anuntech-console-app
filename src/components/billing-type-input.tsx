"use client";
import { useState } from "react";
import { Field } from "./ui";
export function BillingTypeInput() {
  const [type, setType] = useState("one_time");
  return (
    <>
      <Field label="Tipo de cobrança">
        <select
          name="billingType"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="one_time">Cobrança única</option>
          <option value="recurring">Cobrança recorrente</option>
        </select>
      </Field>
      {type === "recurring" && (
        <>
          <Field label="Frequência">
            <select name="interval" defaultValue="monthly">
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual</option>
            </select>
          </Field>
          <p className="muted">
            A primeira publicação ativa a recorrência. As próximas cobranças
            serão emitidas e enviadas por e-mail e WhatsApp 5 dias antes do
            vencimento. Em meses sem esse dia, usamos o último dia do mês.
          </p>
        </>
      )}
    </>
  );
}
