"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { FormField } from "@/components/console/form-field";
import { MoneyField } from "@/components/console/money-field";

export type ChargeTermsValues = {
  discountCents: number | null;
  fineBps: number | null;
  interestMonthlyBps: number | null;
};
export const noTerms: ChargeTermsValues = {
  discountCents: null,
  fineBps: null,
  interestMonthlyBps: null,
};
const bpsToText = (bps: number) => String(bps / 100).replace(".", ",");

/**
 * The conditions of a charge: a discount that only lasts until the due date,
 * and fine plus monthly interest once it is late. Field names match the
 * actions (`discount`, `lateFees`, `finePercent`, `interestPercent`,
 * `termsScope`). `onChange` lets the sheet notice edits that reissue.
 */
export function ChargeTermsFields({
  idPrefix = "terms",
  defaultValue = noTerms,
  scope,
  onChange,
}: {
  idPrefix?: string;
  defaultValue?: ChargeTermsValues;
  /** For invoices of a recurrence: apply to this one or to every next one. */
  scope?: { recurring: boolean; defaultValue?: "this" | "all" };
  onChange?: (value: ChargeTermsValues) => void;
}) {
  const [lateFees, setLateFees] = useState(
    defaultValue.fineBps != null || defaultValue.interestMonthlyBps != null,
  );
  const [state, setState] = useState<ChargeTermsValues>(defaultValue);
  const update = (patch: Partial<ChargeTermsValues>) => {
    const next = { ...state, ...patch };
    setState(next);
    onChange?.(next);
  };
  const percent = (value: string) => {
    const n = Number(value.replace(",", "."));
    return value.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  };
  return (
    <div className="grid gap-5">
      <FormField
        label="Desconto até o vencimento"
        htmlFor={`${idPrefix}-discount`}
        hint="Vale só até a data de vencimento. Depois, a fatura volta ao valor cheio."
      >
        <MoneyField
          id={`${idPrefix}-discount`}
          name="discount"
          required={false}
          defaultCents={defaultValue.discountCents ?? undefined}
          onCentsChange={(cents) => update({ discountCents: cents || null })}
        />
      </FormField>
      <fieldset className="min-w-0">
        {/* The switch is the group's title: fine and interest only exist while it is on. */}
        <legend className="w-full">
          <span className="flex items-center justify-between gap-4">
            <Label htmlFor={`${idPrefix}-late`} className="cursor-pointer">
              Juros e multa após o vencimento
            </Label>
            <Switch
              id={`${idPrefix}-late`}
              name="lateFees"
              checked={lateFees}
              onCheckedChange={(checked) => {
                setLateFees(checked);
                update(
                  checked
                    ? {
                        fineBps: state.fineBps ?? 200,
                        interestMonthlyBps: state.interestMonthlyBps ?? 100,
                      }
                    : { fineBps: null, interestMonthlyBps: null },
                );
              }}
            />
          </span>
        </legend>
        {lateFees && (
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <FormField label="Multa (%)" htmlFor={`${idPrefix}-fine`}>
              <Input
                id={`${idPrefix}-fine`}
                name="finePercent"
                inputMode="decimal"
                maxLength={6}
                defaultValue={bpsToText(defaultValue.fineBps ?? state.fineBps ?? 200)}
                onChange={(event) => update({ fineBps: percent(event.target.value) })}
              />
            </FormField>
            <FormField label="Juros ao mês (%)" htmlFor={`${idPrefix}-interest`}>
              <Input
                id={`${idPrefix}-interest`}
                name="interestPercent"
                inputMode="decimal"
                maxLength={6}
                defaultValue={bpsToText(defaultValue.interestMonthlyBps ?? state.interestMonthlyBps ?? 100)}
                onChange={(event) => update({ interestMonthlyBps: percent(event.target.value) })}
              />
            </FormField>
          </div>
        )}
      </fieldset>
      {scope?.recurring && (
        <FormField label="Aplicar estas condições em" htmlFor={`${idPrefix}-scope`}>
          <NativeSelect
            id={`${idPrefix}-scope`}
            name="termsScope"
            defaultValue={scope.defaultValue ?? "this"}
          >
            <NativeSelectOption value="this">Só nesta fatura</NativeSelectOption>
            <NativeSelectOption value="all">Nesta e em todas as próximas</NativeSelectOption>
          </NativeSelect>
        </FormField>
      )}
    </div>
  );
}
