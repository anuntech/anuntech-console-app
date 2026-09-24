"use client";
import { useId, useState, type KeyboardEvent } from "react";
import { XIcon } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { LabelChip } from "./project-badges";

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
              <LabelChip label={label} className="gap-1 pr-0.5">
                <button
                  type="button"
                  aria-label={`Remover etiqueta ${label}`}
                  className="rounded-sm p-0.5 opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                  onClick={() => setLabels(labels.filter((l) => l !== label))}
                >
                  <XIcon className="size-3" />
                </button>
              </LabelChip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
