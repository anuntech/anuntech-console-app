"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFillable } from "@/components/console/fillable";
import { CheckIcon, ChevronDownIcon, CpuIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fieldButtonClass } from "@/components/console/field";

export type ModelOption = {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  promptPerMillion: number | null;
  completionPerMillion: number | null;
  free: boolean;
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const matches = (haystack: string, search: string) => {
  const text = fold(haystack);
  return fold(search)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
};
const usd = (value: number) => `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "US$ 3,00 / 15,00 por 1M tokens", or "grátis". */
export function priceLabel(model: Pick<ModelOption, "promptPerMillion" | "completionPerMillion" | "free">) {
  if (model.free) return "grátis";
  if (model.promptPerMillion === null && model.completionPerMillion === null) return "preço não informado";
  return `${usd(model.promptPerMillion ?? 0)} / ${usd(model.completionPerMillion ?? 0)} por 1M tokens`;
}
const contextLabel = (tokens: number) => (tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(tokens));

/**
 * Picks the AI Gateway model: a searchable list of the models that accept
 * tools and have a provider that keeps nothing, with price per million
 * tokens, suggestions first. Only ids in the list are saved; a saved id that
 * left the list shows in a plain field until another one is chosen.
 */
export function ModelField({
  id,
  name = "model",
  models,
  suggested,
  defaultValue,
}: {
  id?: string;
  name?: string;
  models: ModelOption[];
  suggested: string[];
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(() => !!defaultValue && !models.some((m) => m.id === defaultValue));
  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);
  const current = byId.get(value) ?? null;
  const picks = suggested.map((sid) => byId.get(sid)).filter((m): m is ModelOption => !!m);
  const choose = (next: string) => {
    setValue(next);
    setCustom(false);
    setOpen(false);
  };
  const hidden = useRef<HTMLInputElement>(null);
  useFillable(
    hidden,
    useCallback(
      (next: string) => {
        setValue(next);
        setCustom(!byId.has(next));
      },
      [byId],
    ),
  );
  if (custom)
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="provedor/modelo"
          maxLength={120}
          className="font-mono text-[13px]"
        />
        {models.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setCustom(false);
              setOpen(true);
            }}
            className="shrink-0 text-left text-xs font-medium text-primary hover:underline"
          >
            Escolher da lista
          </button>
        )}
      </div>
    );
  const row = (model: ModelOption) => (
    <CommandItem
      key={model.id}
      value={model.id}
      keywords={[model.name, model.provider, model.id]}
      onSelect={() => choose(model.id)}
      className="gap-3 py-2"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-medium">{model.name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{model.provider}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground tabular-nums">
          {model.id} · {priceLabel(model)}
          {model.contextLength > 0 && ` · ${contextLabel(model.contextLength)} de contexto`}
        </span>
      </span>
      <CheckIcon className={cn("size-4", model.id === value ? "opacity-100" : "opacity-0")} />
    </CommandItem>
  );
  return (
    <>
      <input ref={hidden} type="hidden" name={name} value={value} data-picker="model" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button id={id} type="button" aria-haspopup="listbox" aria-expanded={open} className={cn(fieldButtonClass, "h-auto min-h-9 py-1.5")}>
            <CpuIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {current ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{current.name}</span>
                <span className="block truncate text-xs text-muted-foreground tabular-nums">
                  {current.id} · {priceLabel(current)}
                </span>
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{value || "Escolher modelo"}</span>
            )}
            <ChevronDownIcon className="ml-auto size-4 shrink-0 opacity-50" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-96 p-0">
          <Command filter={(_, search, keywords) => (matches((keywords ?? []).join(" "), search) ? 1 : 0)}>
            <CommandInput placeholder="Buscar por nome, provedor ou id" />
            <CommandList className="max-h-[min(400px,calc(var(--radix-popover-content-available-height)-3rem))]">
              <CommandEmpty>Nenhum modelo com esse nome.</CommandEmpty>
              {picks.length > 0 && <CommandGroup heading="Sugeridos">{picks.map(row)}</CommandGroup>}
              <CommandGroup heading={`Todos com ferramentas (${models.length})`}>{models.map(row)}</CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
