"use client";
import { useEffect, useState, useTransition } from "react";
import { CheckIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/console/person-avatar";
import type { PersonOption } from "@/components/console/people-field";
import { searchPeople } from "@/lib/bookmark-actions";

/**
 * Picks people by typing a name: nothing is listed until there is a query,
 * and the server answers with a handful of matches from the folder's
 * company and the team. Each chosen person submits as one `userIds` value.
 */
export function SharePeoplePicker({
  folderId,
  name = "userIds",
  initial = [],
}: {
  folderId: string;
  name?: string;
  initial?: PersonOption[];
}) {
  const [selected, setSelected] = useState<PersonOption[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonOption[]>([]);
  const [searching, startSearch] = useTransition();
  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    const timer = setTimeout(() => {
      startSearch(async () => {
        setResults(await searchPeople(folderId, term));
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, folderId]);
  const chosen = (personId: string) => selected.some((p) => p.id === personId);
  const toggle = (person: PersonOption) =>
    setSelected((current) =>
      chosen(person.id) ? current.filter((p) => p.id !== person.id) : [...current, person],
    );
  return (
    <div className="flex flex-col gap-2">
      {selected.map((person) => (
        <input key={person.id} type="hidden" name={name} value={person.id} />
      ))}
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <li
              key={person.id}
              className="flex items-center gap-1.5 rounded-full border bg-card py-0.5 pr-1 pl-1 text-xs"
            >
              <PersonAvatar person={person} size={20} />
              <span className="max-w-[12rem] truncate font-medium">{person.name}</span>
              <button
                type="button"
                aria-label={`Remover ${person.name}`}
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => toggle(person)}
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        {searching ? (
          <Loader2Icon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!event.target.value.trim()) setResults([]);
          }}
          placeholder="Buscar pessoa pelo nome"
          aria-label="Buscar pessoa pelo nome"
          autoComplete="off"
          className="pl-9"
        />
      </div>
      {query.trim() && (
        <ul
          className="max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
          aria-label="Resultados"
        >
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => toggle(person)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <PersonAvatar person={person} size={24} />
                <span className="truncate">{person.name}</span>
                <CheckIcon
                  className={cn("ml-auto size-4", chosen(person.id) ? "opacity-100" : "opacity-0")}
                />
              </button>
            </li>
          ))}
          {!results.length && !searching && (
            <li className="px-2 py-2 text-sm text-muted-foreground">Ninguém com esse nome.</li>
          )}
        </ul>
      )}
    </div>
  );
}
