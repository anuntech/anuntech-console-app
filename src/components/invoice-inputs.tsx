"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { NumericFormat, PatternFormat } from "react-number-format";
import { DateLib, DayPicker, TZDate } from "@daypicker/react";
import { ptBR } from "@daypicker/react/locale";
import { CalendarDays } from "lucide-react";
import {
  APP_TIME_ZONE,
  brazilDateToISO,
  isoToBrazilDate,
  saoPauloDate,
} from "@/lib/dates";
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
  const id = useId();
  const [text, setText] = useState(isoToBrazilDate(defaultValue));
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [validationError, setValidationError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const iso = brazilDateToISO(text);
  const invalid =
    Boolean(validationError) || (touched && Boolean(text) && !iso);
  const selected = iso
    ? new TZDate(`${iso}T12:00:00Z`, APP_TIME_ZONE)
    : undefined;
  useEffect(() => {
    input.current?.setCustomValidity(
      text && !iso ? "Informe uma data válida no formato dd/mm/aaaa." : "",
    );
  }, [text, iso]);
  function selectDate(date: Date) {
    setText(isoToBrazilDate(saoPauloDate(date)));
    setValidationError("");
    setOpen(false);
  }
  return (
    <div className="field" data-form-field="">
      <label className="field-label" htmlFor={id}>
        Vencimento{" "}
        <span className="field-required" aria-hidden="true">
          {" "}
          (obrigatório)
        </span>
      </label>
      <Popover.Root open={open} onOpenChange={setOpen} modal>
        <div className="date-input">
          <PatternFormat
            className={styles.date}
            id={id}
            getInputRef={input}
            value={text}
            format="##/##/####"
            mask="_"
            onValueChange={({ formattedValue }) => {
              setText(formattedValue);
              if (brazilDateToISO(formattedValue)) setValidationError("");
            }}
            onInvalid={(event) => {
              event.preventDefault();
              setValidationError(
                event.currentTarget.validity.valueMissing
                  ? "Informe o vencimento."
                  : "Informe uma data válida no formato dd/mm/aaaa.",
              );
            }}
            onBlur={() => setTouched(true)}
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            required
            autoComplete="off"
            aria-describedby={`${id}-hint${invalid ? ` ${id}-date-error` : ""}`}
            aria-invalid={invalid || undefined}
            minLength={10}
            pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
          />
          <input type="hidden" name="dueDate" value={iso} />
          <Popover.Trigger
            ref={trigger}
            className="calendar-trigger"
            aria-label={
              iso
                ? `Alterar vencimento, ${isoToBrazilDate(iso)}`
                : "Abrir calendário de vencimento"
            }
          >
            <CalendarDays size={19} aria-hidden="true" />
          </Popover.Trigger>
        </div>
        <Popover.Portal>
          <Popover.Positioner
            className={styles.calendarPositioner}
            align="end"
            sideOffset={8}
            collisionPadding={12}
          >
            <Popover.Popup
              ref={popup}
              className={`date-popover ${styles.calendarPopup}`}
              initialFocus={() =>
                popup.current?.querySelector<HTMLButtonElement>(
                  '.rdp-day_button[tabindex="0"]',
                ) ?? true
              }
              finalFocus={trigger}
            >
              <Popover.Title className="sr-only">
                Escolher vencimento
              </Popover.Title>
              <Popover.Description className={styles.calendarHelp}>
                Use as setas para mudar o dia e Enter para selecionar. Escape
                fecha o calendário.
              </Popover.Description>
              <DayPicker
                mode="single"
                locale={ptBR}
                navLayout="after"
                formatters={{
                  formatWeekdayName: (date, options, dateLib) =>
                    (dateLib ?? new DateLib(options)).format(date, "ccccc"),
                }}
                timeZone={APP_TIME_ZONE}
                selected={selected}
                defaultMonth={selected}
                autoFocus
                showOutsideDays
                fixedWeeks
                onSelect={(date) => {
                  if (date) selectDate(date);
                }}
              />
              <div className="calendar-footer">
                <button type="button" onClick={() => selectDate(new Date())}>
                  Hoje
                </button>
                <Popover.Close>Fechar</Popover.Close>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <small id={`${id}-hint`}>dd/mm/aaaa · Horário de São Paulo</small>
      {invalid && (
        <p id={`${id}-date-error`} className="field-error" role="alert">
          {validationError || "Informe uma data válida no formato dd/mm/aaaa."}
        </p>
      )}
    </div>
  );
}
