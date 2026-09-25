"use client";
import { DateField } from "@/components/console/date-field";
import { FormField } from "@/components/console/form-field";
import { saoPauloDate } from "@/lib/dates";
import { dateLabel } from "@/lib/format";

/**
 * Appears only when the due date is not in the future: the obligation is
 * registered as overdue from that date, and the bank still needs a future
 * date to put on the boleto and the Pix.
 */
export function BankDueDateField({
  dueDate,
  value,
  onChange,
  idPrefix,
}: {
  dueDate: string;
  value: string;
  onChange: (value: string) => void;
  idPrefix: string;
}) {
  const today = saoPauloDate();
  if (!dueDate || dueDate > today) return null;
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  return (
    <FormField
      label="Pagar até"
      htmlFor={`${idPrefix}-bank-due`}
      className="rounded-lg border border-warning-edge bg-warning-soft/50 px-4 py-3"
    >
      <DateField
        id={`${idPrefix}-bank-due`}
        name="bankDueDate"
        required
        value={value}
        onChange={onChange}
        min={tomorrow}
        placeholder="Data do boleto e do Pix"
      />
      <p className="mt-1.5 text-xs text-warning">
        Vencimento no passado: a fatura fica registrada como vencida desde {dateLabel(dueDate)}, e o boleto e o Pix
        valem até a data acima.
      </p>
    </FormField>
  );
}
