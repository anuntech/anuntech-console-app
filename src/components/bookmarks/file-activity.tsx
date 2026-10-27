"use client";
import { useEffect, useState } from "react";
import { HistoryIcon } from "lucide-react";
import { dateTimeLabel } from "@/lib/format";

type Row = { id: string; what: string; who: string | null; at: string; note?: string };

/** "Atividade" in an item's edit sheet: who did what with it, newest first (lib/drive/activity.ts). */
export function FileActivity({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (!open || rows) return;
    let alive = true;
    fetch(`/api/bookmarks/${itemId}/atividade`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ activity: Row[] }>) : { activity: [] }))
      .then((data) => alive && setRows(data.activity));
    return () => {
      alive = false;
    };
  }, [open, rows, itemId]);
  return (
    <details className="group rounded-lg border px-3 py-2" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground">
        <HistoryIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        Atividade
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Ver quem enviou, baixou e mudou</span>
      </summary>
      <div className="mt-2">
        {rows === null ? (
          <p className="m-0 text-xs text-muted-foreground">Carregando…</p>
        ) : !rows.length ? (
          <p className="m-0 text-xs text-muted-foreground">Nada registrado ainda.</p>
        ) : (
          <ol className="m-0 grid list-none gap-1.5 p-0">
            {rows.map((row) => (
              <li key={row.id} className="flex items-baseline gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-foreground">
                  <span className="font-medium">{row.who ?? "Alguém"}</span> · {row.what}
                  {row.note ? ` (${row.note})` : ""}
                </span>
                <time dateTime={row.at} className="shrink-0 tabular-nums text-muted-foreground">
                  {dateTimeLabel(new Date(row.at))}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
