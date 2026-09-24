"use client";
import { useState } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fieldButtonClass } from "@/components/console/field";
import { AvatarStack, PersonAvatar } from "@/components/console/person-avatar";

export type PersonOption = { id: string; name: string; image: string | null };

function summary(people: PersonOption[]) {
  if (people.length <= 2) return people.map((p) => p.name).join(" e ");
  return `${people[0].name}, ${people[1].name} +${people.length - 2}`;
}

/**
 * Several people on one task. Looks like the other fields, opens a
 * searchable list and submits one `assigneeIds` value per person.
 */
export function PeopleField({
  id,
  name = "assigneeIds",
  people,
  defaultValue = [],
  placeholder = "Sem responsável",
}: {
  id?: string;
  name?: string;
  people: PersonOption[];
  defaultValue?: string[];
  placeholder?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const chosen = people.filter((person) => selected.includes(person.id));
  const toggle = (personId: string) =>
    setSelected((current) =>
      current.includes(personId)
        ? current.filter((value) => value !== personId)
        : [...current, personId],
    );
  return (
    <>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(fieldButtonClass, !chosen.length && "text-muted-foreground")}
          >
            {chosen.length > 0 && <AvatarStack people={chosen} size={20} max={3} />}
            <span className="truncate">{chosen.length ? summary(chosen) : placeholder}</span>
            <ChevronDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder="Buscar pessoa" />
            <CommandList>
              <CommandEmpty>Ninguém com esse nome.</CommandEmpty>
              <CommandGroup>
                {people.map((person) => {
                  const active = selected.includes(person.id);
                  return (
                    <CommandItem
                      key={person.id}
                      value={person.name}
                      onSelect={() => toggle(person.id)}
                    >
                      <PersonAvatar person={person} size={24} />
                      <span className="truncate">{person.name}</span>
                      <CheckIcon
                        className={cn("ml-auto size-4", active ? "opacity-100" : "opacity-0")}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
