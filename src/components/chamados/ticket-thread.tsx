"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/console/page-header";
import { FileChip } from "@/components/console/file-chip";
import { PersonAvatar } from "@/components/console/person-avatar";
import { APP_LOCALE, APP_TIME_ZONE } from "@/lib/dates";
import { dateTimeLabel, timeLabel } from "@/lib/format";
import type { TicketEntry } from "./ticket-detail";

/* The conversation of a ticket, read like a chat: one block per day, and
   consecutive entries by the same person within a few minutes share one
   header. Entries that arrive while the page is open (a reply just sent, a
   refresh) rise in; the ones the page loaded with stay still. */

/** Within this gap, the next entry by the same person continues the block. */
const GROUP_MS = 5 * 60 * 1000;

const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(new Date(iso));

/** "Hoje", "Ontem", "20 de outubro" (and the year when it is not this one). */
function dayLabel(iso: string, now: string) {
  const key = dayKey(iso);
  if (key === dayKey(now)) return "Hoje";
  if (key === dayKey(new Date(new Date(now).getTime() - 86400000).toISOString())) return "Ontem";
  const sameYear = key.slice(0, 4) === dayKey(now).slice(0, 4);
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(new Date(iso));
}

type Item = {
  key: string;
  entry: TicketEntry;
  at: string;
  author: string;
  staff: boolean;
  /** Same person, a moment after the previous entry: no avatar or header of its own. */
  continued: boolean;
};

const keyOf = (entry: TicketEntry) => (entry.kind === "message" ? entry.id : entry.file.id);

function groupByDay(entries: TicketEntry[], now: string) {
  const days: { key: string; label: string; items: Item[] }[] = [];
  let previous: Item | null = null;
  for (const entry of entries) {
    const at = entry.kind === "message" ? entry.createdAt : entry.file.createdAt;
    const author = entry.kind === "message" ? entry.author : entry.file.author;
    const day = dayKey(at);
    if (days.at(-1)?.key !== day) {
      days.push({ key: day, label: dayLabel(at, now), items: [] });
      previous = null;
    }
    const continued =
      !!previous &&
      previous.author === author &&
      previous.staff === entry.staff &&
      new Date(at).getTime() - new Date(previous.at).getTime() < GROUP_MS;
    const item: Item = { key: keyOf(entry), entry, at, author, staff: entry.staff, continued };
    days.at(-1)!.items.push(item);
    previous = item;
  }
  return days;
}

function Avatar({ item, size, className }: { item: Item; size: number; className?: string }) {
  const { entry } = item;
  const person =
    entry.kind === "message" ? { id: entry.authorId, name: entry.author, image: entry.authorImage } : { name: entry.file.author };
  return <PersonAvatar person={person} size={size} tone={item.staff ? "staff" : "default"} className={className} />;
}

function Header({ item }: { item: Item }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Avatar item={item} size={20} className="sm:hidden" />
      <span className="text-sm font-medium text-foreground">
        {item.author}
        {item.entry.kind === "file" && <span className="font-normal text-muted-foreground"> anexou um arquivo</span>}
      </span>
      {item.staff && (
        <span className="rounded-full bg-accent px-1.5 py-px text-caption font-medium text-accent-foreground">Equipe</span>
      )}
      <time dateTime={item.at} title={dateTimeLabel(item.at)} className="text-xs text-muted-foreground tabular-nums">
        {timeLabel(item.at)}
      </time>
    </div>
  );
}

export function TicketThread({
  entries,
  now,
  admin,
  closed,
}: {
  entries: TicketEntry[];
  now: string;
  admin: boolean;
  closed: boolean;
}) {
  // What the page loaded with; anything else arrived while it was open.
  const [initial] = useState(() => new Set(entries.map(keyOf)));

  if (!entries.length)
    return (
      <EmptyState
        art="chamados"
        size="compact"
        title="Nenhuma mensagem ainda"
        description={
          closed
            ? "Este chamado foi encerrado sem mensagens."
            : admin
              ? "A conversa com o cliente aparece aqui."
              : "A resposta da equipe aparece aqui."
        }
      />
    );

  // The viewer's side is outlined; the other side, the one to read, is filled.
  const ours = (staff: boolean) => staff === admin;

  return (
    <ol className="m-0 flex list-none flex-col gap-6 p-0">
      {groupByDay(entries, now).map((day) => (
        <li key={day.key} className="flex flex-col gap-4">
          <p className="m-0 flex items-center gap-3 text-caption font-medium text-muted-foreground">
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
            {day.label}
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </p>
          <ol className="m-0 flex list-none flex-col p-0">
            {day.items.map((item) => {
              const fresh = !initial.has(item.key);
              const { entry } = item;
              return (
                <li
                  key={item.key}
                  className={cn("flex gap-3", item.continued ? "mt-1.5" : "mt-4 first:mt-0", fresh && "reveal [--rise:10px]")}
                >
                  {/* The avatar column stays, so continued bubbles line up under the first.
                      Phones give the room to the text: a small avatar goes in the header. */}
                  <div className="w-8 shrink-0 max-sm:hidden">{!item.continued && <Avatar item={item} size={32} />}</div>
                  <div className="min-w-0 flex-1">
                    {item.continued ? (
                      <span className="sr-only">
                        {item.author}, {dateTimeLabel(item.at)}:
                      </span>
                    ) : (
                      <Header item={item} />
                    )}
                    {entry.kind === "message" ? (
                      <div
                        title={item.continued ? dateTimeLabel(item.at) : undefined}
                        className={cn(
                          "w-fit max-w-[min(100%,44rem)] rounded-2xl px-4 py-2.5 text-sm leading-6 break-words whitespace-pre-wrap text-foreground",
                          !item.continued && "mt-1.5 rounded-tl-md",
                          ours(entry.staff) ? "border bg-card" : "bg-secondary",
                        )}
                      >
                        {entry.body}
                      </div>
                    ) : (
                      <div className={cn(!item.continued && "mt-1.5")}>
                        <FileChip file={entry.file} href={`/api/anexos/${entry.file.id}`} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
