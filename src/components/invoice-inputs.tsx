"use client";
import { useId, useState } from "react";
import { NumericFormat } from "react-number-format";
import { Field } from "./ui";
import styles from "./invoice-inputs.module.css";

export function InvoiceAmount({ defaultCents }: { defaultCents?: number }) {
  const id = useId();
  const [value, setValue] = useState(
    defaultCents === undefined ? "" : (defaultCents / 100).toFixed(2),
  );
  return (
    <Field label="Valor (R$)">
      <NumericFormat
        id={id}
        className={styles.amount}
        value={value}
        valueIsNumericString
        onValueChange={(values) => setValue(values.value)}
        thousandSeparator="."
        decimalSeparator=","
        allowedDecimalSeparators={[","]}
        decimalScale={2}
        fixedDecimalScale
        prefix="R$ "
        allowNegative={false}
        isAllowed={({ floatValue }) =>
          floatValue === undefined || floatValue <= 9999999.99
        }
        inputMode="decimal"
        required
        placeholder="R$ 0,00"
        autoComplete="off"
      />
      <input type="hidden" name="amount" value={value} />
    </Field>
  );
}

export function InvoiceDueDate({
  defaultValue = "",
}: {
  defaultValue?: string;
}) {
  return (
    <Field label="Vencimento">
      <input
        type="date"
        name="dueDate"
        className={styles.date}
        defaultValue={defaultValue}
        required
      />
    </Field>
  );
}
