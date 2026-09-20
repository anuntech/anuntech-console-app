"use client";
import { useId, useState } from "react";
import { Repeat2 } from "lucide-react";
import { Field } from "./ui";
import styles from "./invoice-inputs.module.css";
export function BillingTypeInput() {
  const [type, setType] = useState("one_time");
  const hintId = useId();
  return (
    <>
      <Field
        label="Tipo de cobrança"
        hint={
          type === "one_time"
            ? "Uma cobrança emitida após a publicação do rascunho."
            : undefined
        }
      >
        <select
          name="billingType"
          aria-describedby={type === "recurring" ? hintId : undefined}
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
          <div id={hintId} className={styles.typeHint} role="status">
            <Repeat2 size={17} aria-hidden="true" />
            <p>
              A primeira publicação ativa a recorrência. As próximas cobranças
              serão emitidas e enviadas por e-mail e WhatsApp 5 dias antes do
              vencimento. Em meses sem esse dia, usamos o último dia do mês.
            </p>
          </div>
        </>
      )}
    </>
  );
}
