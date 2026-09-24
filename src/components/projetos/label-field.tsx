"use client";
import { useId, useState, type KeyboardEvent } from "react";
import { XIcon } from "lucide-react";
import { cn } from "cn";
import { LabelChip } from "./project-badges";

const MAX = 8;

/**
 * Tags for a task. Enter or comma adds what was typed; each chip submits as
 * one `labels` value. Suggestions come from the project's existing tags.
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
  const add = (raw: string) => {
    const label = raw.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!label) return;
    if (labels.some((l) => l.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR"))) {
      setDraft("");
      return;
    }
    if (labels.length >= MAX) return;
    setLabels([...labels, label]);
    setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && labels.length) {
      setLabels(labels.slice(0, -1));
    }
  };
  const available = suggestions.filter(
    (s) => !labels.some((l) => l.toLocaleLowerCase("pt-BR") === s.toLocaleLowerCase("pt-BR")),
  );
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {labels.map((label) => (
        <input key={label} type="hidden" name={name} value={label} />
      ))}
      <div className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-field px-2 py-1 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {labels.map((label) => (
          <LabelChip key={label} label={label} className="gap-1 pr-0.5">
            <button
              type="button"
              aria-label={`Remover etiqueta ${label}`}
              className="rounded-sm p-0.5 opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
              onClick={() => setLabels(labels.filter((l) => l !== label))}
            >
              <XIcon className="size-3" />
            </button>
          </LabelChip>
        ))}
        <input
          id={id}
          list={available.length ? listId : undefined}
          value={draft}
          maxLength={24}
          disabled={labels.length >= MAX}
          placeholder={labels.length ? "" : "Digite e pressione Enter"}
          className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 text-sm shadow-none outline-none focus:ring-0 placeholder:text-muted-foreground disabled:cursor-not-allowed"
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
      </div>
    </div>
  );
}
