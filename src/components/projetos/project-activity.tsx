"use client";
import { useMemo, useState } from "react";
import { HistoryIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PersonAvatar } from "@/components/console/person-avatar";
import { activityFilters, activityText, type ActivityEvent, type ActivityKind } from "@/lib/projects/activity-model";
import { APP_LOCALE, APP_TIME_ZONE, saoPauloDate } from "@/lib/dates";
import { timeLabel } from "@/lib/format";

const dayLabel = (iso: string, today: string) => {
  const day = saoPauloDate(new Date(iso));
  if (day === today) return "Hoje";
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (day === yesterday.toISOString().slice(0, 10)) return "Ontem";
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
};

/**
 * "Atividade": who moved, approved, commented or edited what on the board,
 * newest first, by day. A task still on the board opens from its name.
 */
export function ProjectActivity({
  name,
  events,
  today,
  onOpenTask,
}: {
  name: string;
  events: ActivityEvent[];
  today: string;
  onOpenTask: (taskId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | ActivityKind>("all");
  const shown = useMemo(
    () => events.map((event) => ({ event, ...activityText(event) })).filter((row) => filter === "all" || row.kind === filter),
    [events, filter],
  );
  const days = useMemo(() => {
    const groups: { label: string; rows: typeof shown }[] = [];
    for (const row of shown) {
      const label = dayLabel(row.event.at, today);
      if (groups.at(-1)?.label === label) groups.at(-1)!.rows.push(row);
      else groups.push({ label, rows: [row] });
    }
    return groups;
  }, [shown, today]);
  return (
    <>
      <Button variant="outline" size="icon" aria-label="Atividade do projeto" title="Atividade do projeto" onClick={() => setOpen(true)}>
        <HistoryIcon />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Atividade</SheetTitle>
            <SheetDescription>{name}: quem mexeu em cada tarefa, e quando.</SheetDescription>
          </SheetHeader>
          <div role="group" aria-label="Filtrar a atividade" className="flex flex-wrap gap-1.5 border-b px-4 py-3">
            {activityFilters.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={filter === option.key}
                onClick={() => setFilter(option.key)}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
                  filter === option.key ? "border-primary bg-accent text-primary" : "bg-background text-muted-foreground hover:bg-accent",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!days.length ? (
              <p className="m-0 py-10 text-center text-sm text-muted-foreground">
                {events.length ? "Nada deste tipo por aqui." : "Nada aconteceu neste projeto ainda."}
              </p>
            ) : (
              days.map((day) => (
                <section key={day.label} className="mb-5 last:mb-0">
                  <h3 className="m-0 mb-2 text-caption font-medium text-muted-foreground first-letter:uppercase">{day.label}</h3>
                  <ol className="m-0 grid list-none gap-3 p-0">
                    {day.rows.map(({ event, text }) => (
                      <li key={event.id} className="flex items-start gap-2.5 text-sm">
                        <PersonAvatar person={event.who} size={24} tone={event.who.staff ? "staff" : "default"} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-foreground [overflow-wrap:anywhere]">
                            <span className="font-medium">{event.who.name}</span>
                            {event.who.staff && <span className="text-muted-foreground"> (Anuntech)</span>} {text}
                          </p>
                          {event.task &&
                            (event.task.exists ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpen(false);
                                  onOpenTask(event.task!.id);
                                }}
                                className="block max-w-full truncate text-left text-xs text-primary hover:underline"
                              >
                                {event.task.title}
                              </button>
                            ) : (
                              <span className="block truncate text-xs text-muted-foreground">{event.task.title} (excluída)</span>
                            ))}
                        </div>
                        <time dateTime={event.at} className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {timeLabel(event.at)}
                        </time>
                      </li>
                    ))}
                  </ol>
                </section>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
