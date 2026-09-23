"use client";
import { useState } from "react";
import { NumericFormat } from "react-number-format";
import { Input } from "@/components/ui/input";

/**
 * Brazilian money field. The visible input is formatted; the hidden `amount`
 * carries the plain decimal string the actions parse with moneyToCents.
 */
export function MoneyInput({
  id,
  name = "amount",
  defaultCents,
  required = true,
}: {
  id?: string;
  name?: string;
  defaultCents?: number;
  required?: boolean;
}) {
  const [value, setValue] = useState(
    defaultCents === undefined ? "" : (defaultCents / 100).toFixed(2),
  );
  return (
    <>
      <NumericFormat
        id={id}
        customInput={Input}
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
        required={required}
        placeholder="R$ 0,00"
        autoComplete="off"
        className="tabular-nums"
      />
      <input type="hidden" name={name} value={value} />
    </>
  );
}
