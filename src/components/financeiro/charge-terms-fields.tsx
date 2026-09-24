"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { MoneyInput } from "./invoice-money";

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
      <div>
        <Label htmlFor={`${idPrefix}-discount`} className="mb-1.5">
          Desconto até o vencimento
        </Label>
        <MoneyInput
          id={`${idPrefix}-discount`}
          name="discount"
          required={false}
          defaultCents={defaultValue.discountCents ?? undefined}
          onCentsChange={(cents) => update({ discountCents: cents || null })}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Vale só até a data de vencimento. Depois, a fatura volta ao valor cheio.
        </p>
      </div>
      <div className="rounded-lg border bg-field/60 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
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
        </div>
        {lateFees && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${idPrefix}-fine`} className="mb-1.5 text-xs">
                Multa (%)
              </Label>
              <Input
                id={`${idPrefix}-fine`}
                name="finePercent"
                inputMode="decimal"
                maxLength={6}
                defaultValue={bpsToText(defaultValue.fineBps ?? state.fineBps ?? 200)}
                onChange={(event) => update({ fineBps: percent(event.target.value) })}
                className="bg-card"
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-interest`} className="mb-1.5 text-xs">
                Juros ao mês (%)
              </Label>
              <Input
                id={`${idPrefix}-interest`}
                name="interestPercent"
                inputMode="decimal"
                maxLength={6}
                defaultValue={bpsToText(defaultValue.interestMonthlyBps ?? state.interestMonthlyBps ?? 100)}
                onChange={(event) => update({ interestMonthlyBps: percent(event.target.value) })}
                className="bg-card"
              />
            </div>
          </div>
        )}
      </div>
      {scope?.recurring && (
        <div>
          <Label htmlFor={`${idPrefix}-scope`} className="mb-1.5">
            Aplicar estas condições em
          </Label>
          <NativeSelect
            id={`${idPrefix}-scope`}
            name="termsScope"
            defaultValue={scope.defaultValue ?? "this"}
            className="bg-field"
          >
            <NativeSelectOption value="this">Só nesta fatura</NativeSelectOption>
            <NativeSelectOption value="all">Nesta e em todas as próximas</NativeSelectOption>
          </NativeSelect>
        </div>
      )}
    </div>
  );
}
