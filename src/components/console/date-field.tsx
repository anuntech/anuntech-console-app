"use client";
import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { cn } from "cn";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { dateLabel } from "@/lib/format";
import { fieldButtonClass } from "./field";

/** "2026-09-23" ⇄ a local Date, so the day never drifts with the time zone. */
function parseIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function toIso(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A civil-date field for server forms: a button that opens the Console's
 * calendar and a hidden input carrying the ISO value under `name`. Works
 * uncontrolled (`defaultValue`) or controlled (`value` + `onChange`).
 * Clicking the chosen day again clears it, unless `required`.
 */
export function DateField({
  id,
  name,
  value: controlled,
  defaultValue = "",
  onChange,
  required = false,
  placeholder = "Escolher data",
  min,
  className,
}: {
  id?: string;
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  /** Earliest selectable day, ISO. */
  min?: string;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const value = controlled ?? internal;
  const selected = value ? parseIso(value) : undefined;
  const set = (next: string) => {
    setInternal(next);
    onChange?.(next);
  };
  return (
    <div className={cn("relative w-full", className)}>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className={cn(fieldButtonClass, value ? "text-foreground" : "text-muted-foreground")}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{value ? dateLabel(value) : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            required={required}
            locale={ptBR}
            selected={selected}
            defaultMonth={selected}
            disabled={min ? { before: parseIso(min) } : undefined}
            onSelect={(date: Date | undefined) => {
              set(date ? toIso(date) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
