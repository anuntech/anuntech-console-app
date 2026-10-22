"use client";
import { useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type MultiSelectOption = {
  value: string;
  label: string;
  /** Avatar, colour dot or chip drawn before the label. */
  icon?: ReactNode;
};

/**
 * A filter that keeps several choices: a quiet button that names the group
 * and counts what is selected, opening a checklist. Search appears only
 * when the list is long enough to need it.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  searchPlaceholder = "Buscar",
  className,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.filter((option) => selected.includes(option.value));
  const toggle = (value: string) =>
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "bg-card font-normal",
            chosen.length > 0 && "border-primary/40 text-foreground",
            className,
          )}
        >
          {chosen.length === 1 && chosen[0].icon}
          <span className="truncate">
            {chosen.length === 0
              ? label
              : chosen.length === 1
                ? chosen[0].label
                : `${label} · ${chosen.length}`}
          </span>
          <ChevronDownIcon className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          {options.length > 7 && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const active = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggle(option.value)}
                  >
                    {option.icon}
                    <span className="truncate">{option.label}</span>
                    <CheckIcon
                      className={cn("ml-auto size-4", active ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {chosen.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__clear"
                    onSelect={() => onChange([])}
                    className="justify-center text-muted-foreground"
                  >
                    Limpar seleção
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
