"use client";
import { useCallback, useRef, useState } from "react";
import { useFillable } from "@/components/console/fillable";
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
  onCentsChange,
}: {
  id?: string;
  name?: string;
  defaultCents?: number;
  required?: boolean;
  /** Fires with the current value in cents (0 while empty). */
  onCentsChange?: (cents: number) => void;
}) {
  const [value, setValue] = useState(
    defaultCents === undefined ? "" : (defaultCents / 100).toFixed(2),
  );
  const hidden = useRef<HTMLInputElement>(null);
  // The assistant fills this field with "1.234,56", "1234,56" or "1234.56".
  useFillable(
    hidden,
    useCallback(
      (raw: string) => {
        const cleaned = raw.replace(/[^\d,.-]/g, "");
        const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
        const amount = Number(normalized);
        if (!Number.isFinite(amount) || amount < 0) return;
        setValue(amount ? amount.toFixed(2) : "");
        onCentsChange?.(Math.round(amount * 100));
      },
      [onCentsChange],
    ),
  );
  return (
    <>
      <NumericFormat
        id={id}
        customInput={Input}
        value={value}
        valueIsNumericString
        onValueChange={(values) => {
          setValue(values.value);
          onCentsChange?.(Math.round((values.floatValue ?? 0) * 100));
        }}
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
      <input ref={hidden} type="hidden" name={name} value={value} data-picker="money" />
    </>
  );
}
