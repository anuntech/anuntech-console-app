"use client";
import { useCallback, useRef, useState } from "react";
import { Building2Icon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fieldButtonClass } from "@/components/console/field";
import { useFillable } from "@/components/console/fillable";
import { CompanyMark } from "@/components/console/company-mark";
import { formatDocument, onlyDigits } from "@/lib/companies/company-input";

export type CompanyOption = { id: string; name: string; document?: string | null };

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Every typed word must appear somewhere in the name or the document, accents aside. */
function matches(haystack: string, search: string) {
  const text = fold(haystack);
  return fold(search)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

/** cmdk needs a non-empty value; the internal "Anuntech" option has id "". */
const keyOf = (id: string) => id || "__internal";

/**
 * The one way to pick a company: a field-looking button that opens a
 * searchable list with initials, name and document. Inside a form it
 * submits `name` and honours `required` like a native select would.
 * Outside a form (filters) leave `name` out and drive it with `value`.
 */
export function CompanyField({
  id,
  name,
  companies,
  value,
  defaultValue,
  onChange,
  allOption,
  placeholder = "Selecione a empresa",
  required = false,
  disabled = false,
  autoFocus = false,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  name?: string;
  companies: CompanyOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** A first entry that stands for every company, for filters. */
  allOption?: { id: string; label: string };
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [selected, setSelected] = useState(defaultValue ?? "");
  const button = useRef<HTMLButtonElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const current = value !== undefined ? value : selected;
  const chosen = companies.find((option) => option.id === current);
  const all = allOption && current === allOption.id ? allOption : null;
  const choose = (next: string) => {
    setSelected(next);
    setInvalid(false);
    setOpen(false);
    onChange?.(next);
  };
  const searchable = companies.length > 5;
  // The assistant fills this field by id or by (part of) the name.
  useFillable(
    hidden,
    useCallback(
      (value: string) => {
        const wanted = fold(value);
        const match =
          companies.find((c) => c.id === value) ??
          companies.find((c) => fold(c.name) === wanted) ??
          companies.find((c) => fold(c.name).includes(wanted));
        if (match) {
          setSelected(match.id);
          setInvalid(false);
          onChange?.(match.id);
        }
      },
      [companies, onChange],
    ),
  );
  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={button}
            id={id}
            type="button"
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            data-invalid={invalid || undefined}
            autoFocus={autoFocus}
            disabled={disabled}
            className={cn(
              fieldButtonClass,
              "data-[invalid]:border-destructive data-[invalid]:ring-[3px] data-[invalid]:ring-destructive/20",
              !chosen && !all && "text-muted-foreground",
              className,
            )}
          >
            {chosen ? (
              <CompanyMark name={chosen.name} size={22} className="rounded-sm" />
            ) : (
              <Building2Icon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
            )}
            <span className="truncate">{chosen?.name ?? all?.label ?? placeholder}</span>
            {chosen?.document && (
              <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
                {formatDocument(chosen.document)}
              </span>
            )}
            <ChevronDownIcon className="ml-auto size-4 shrink-0 opacity-50" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-80 p-0">
          <Command
            filter={(_, search, keywords) => (matches((keywords ?? []).join(" "), search) ? 1 : 0)}
          >
            {searchable && <CommandInput placeholder="Buscar por nome ou CNPJ" />}
            <CommandList className="max-h-[min(320px,calc(var(--radix-popover-content-available-height)-3rem))]">
              <CommandEmpty>Nenhuma empresa com esse nome.</CommandEmpty>
              <CommandGroup>
                {allOption && (
                  <CommandItem
                    value={keyOf(allOption.id)}
                    keywords={[allOption.label]}
                    onSelect={() => choose(allOption.id)}
                    className="gap-3 py-2"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                      <Building2Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{allOption.label}</span>
                    <CheckIcon
                      className={cn("size-4", current === allOption.id ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                )}
                {companies.map((option) => {
                  const active = option.id === current;
                  const document = option.document ? formatDocument(option.document) : null;
                  return (
                    <CommandItem
                      key={keyOf(option.id)}
                      value={keyOf(option.id)}
                      keywords={[option.name, document ?? "", option.document ? onlyDigits(option.document) : ""]}
                      onSelect={() => choose(option.id)}
                      className="gap-3 py-2"
                    >
                      <CompanyMark name={option.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{option.name}</span>
                        {document && (
                          <span className="block text-xs tabular-nums text-muted-foreground">{document}</span>
                        )}
                      </span>
                      <CheckIcon className={cn("size-4", active ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {name !== undefined && (
        /* Carries the value to the form and lets the browser enforce `required`
           without its bubble: an empty submit opens the list instead. */
        <input
          ref={hidden}
          name={name}
          value={current}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          data-picker="company"
          data-options={JSON.stringify(companies.slice(0, 40).map((c) => ({ valor: c.id, texto: c.name })))}
          onChange={() => {}}
          onInvalid={(event) => {
            event.preventDefault();
            setInvalid(true);
            button.current?.focus();
            setOpen(true);
          }}
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-0"
        />
      )}
    </div>
  );
}
