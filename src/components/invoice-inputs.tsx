"use client";
import { useEffect, useId, useRef, useState } from "react";
import { NumericFormat, PatternFormat } from "react-number-format";
import { DayPicker, TZDate } from "@daypicker/react";
import { ptBR } from "@daypicker/react/locale";
import { CalendarDays } from "lucide-react";
import {
  APP_TIME_ZONE,
  brazilDateToISO,
  isoToBrazilDate,
  saoPauloDate,
} from "@/lib/dates";
import { Field } from "./ui";

export function InvoiceAmount({ defaultCents }: { defaultCents?: number }) {
  const [value, setValue] = useState(
    defaultCents === undefined ? "" : (defaultCents / 100).toFixed(2),
  );
  return (
    <Field label="Valor (R$)">
      <NumericFormat
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
  const [above, setAbove] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const iso = brazilDateToISO(text);
  const selected = iso
    ? new TZDate(`${iso}T12:00:00Z`, APP_TIME_ZONE)
    : undefined;
  useEffect(() => {
    input.current?.setCustomValidity(
      text && !iso ? "Informe uma data válida no formato dd/mm/aaaa." : "",
    );
  }, [text, iso]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  function closeCalendar() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div className="field">
      <label htmlFor={id}>Vencimento</label>
      <div
        ref={container}
        className="date-input"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            closeCalendar();
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setOpen(false);
        }}
      >
        <PatternFormat
          id={id}
          getInputRef={input}
          value={text}
          format="##/##/####"
          mask="_"
          onValueChange={({ formattedValue }) => setText(formattedValue)}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          required
          autoComplete="off"
          aria-describedby={`${id}-hint`}
          minLength={10}
          pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
        />
        <input type="hidden" name="dueDate" value={iso} />
        <button
          ref={trigger}
          type="button"
          className="calendar-trigger"
          aria-label="Abrir calendário de vencimento"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${id}-calendar` : undefined}
          onClick={() => {
            const rect = container.current?.getBoundingClientRect();
            setAbove(
              !!rect &&
                window.innerHeight - rect.bottom < 390 &&
                rect.top > 390,
            );
            setOpen(!open);
          }}
        >
          <CalendarDays size={19} aria-hidden="true" />
        </button>
        {open && (
          <div
            id={`${id}-calendar`}
            className={`date-popover${above ? " above" : ""}`}
            role="dialog"
            aria-label="Escolher vencimento"
          >
            <DayPicker
              mode="single"
              locale={ptBR}
              timeZone={APP_TIME_ZONE}
              selected={selected}
              defaultMonth={selected}
              autoFocus
              showOutsideDays
              fixedWeeks
              onSelect={(date) => {
                if (date) setText(isoToBrazilDate(saoPauloDate(date)));
                closeCalendar();
              }}
            />
            <div className="calendar-footer">
              <button
                type="button"
                onClick={() => {
                  setText(isoToBrazilDate(saoPauloDate()));
                  closeCalendar();
                }}
              >
                Hoje
              </button>
              <button type="button" onClick={closeCalendar}>
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
      <small id={`${id}-hint`}>dd/mm/aaaa · Horário de São Paulo</small>
    </div>
  );
}
