"use client";
import { useId, useState, type KeyboardEvent } from "react";
import { PlusIcon } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { TokenChip } from "@/components/console/token-chip";
import { labelTone } from "./project-badges";

const MAX = 8;

/**
 * Tags for a task: a normal field where Enter or a comma adds what was
 * typed, and the chips sit below it. Each chip submits as one `labels`
 * value; suggestions come from the project's existing tags.
 */
export function LabelField({
  id,
  name = "labels",
  defaultValue = [],
  suggestions = [],
  className,
}: {
  id?: string;
  name?: string;
  defaultValue?: string[];
  suggestions?: string[];
  className?: string;
}) {
  const [labels, setLabels] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");
  const listId = useId();
  const same = (a: string, b: string) =>
    a.toLocaleLowerCase("pt-BR") === b.toLocaleLowerCase("pt-BR");
  const add = (raw: string) => {
    const label = raw.trim().replace(/\s+/g, " ").slice(0, 24);
    setDraft("");
    if (!label || labels.some((l) => same(l, label)) || labels.length >= MAX) return;
    setLabels([...labels, label]);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && labels.length) {
      setLabels(labels.slice(0, -1));
    }
  };
  const available = suggestions.filter((s) => !labels.some((l) => same(l, s)));
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {labels.map((label) => (
        <input key={label} type="hidden" name={name} value={label} />
      ))}
      <Input
        id={id}
        list={available.length ? listId : undefined}
        value={draft}
        maxLength={24}
        disabled={labels.length >= MAX}
        placeholder={labels.length >= MAX ? `Até ${MAX} etiquetas` : "Digite e pressione Enter"}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
      />
      {available.length > 0 && (
        <datalist id={listId}>
          {available.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {labels.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <li key={label}>
              <TokenChip
                removeLabel={`Remover etiqueta ${label}`}
                onRemove={() => setLabels(labels.filter((l) => l !== label))}
              >
                {/* The label's colour, as on the board cards. */}
                <span
                  aria-hidden="true"
                  className={cn("size-2 shrink-0 rounded-full", labelTone(label), "bg-current")}
                />
                <span className="truncate">{label}</span>
              </TokenChip>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 && labels.length < MAX && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Etiquetas já usadas no projeto">
          {available.slice(0, 12).map((label) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => add(label)}
                className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-input px-2 py-0.5 text-[11px] leading-4 font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <PlusIcon className="size-3" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
