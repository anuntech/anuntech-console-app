"use client";
import { useCallback, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "@/components/shell/notifications";
import { Button } from "@/components/ui/button";
import { saveBookmark } from "@/lib/bookmarks/bookmark-actions";
import { fileSizeLabel } from "@/lib/format";
import { uploadToR2 } from "./r2-upload";

type Item = { key: string; name: string; size: number; sent: number; state: "waiting" | "sending" | "done" | "error"; error?: string };

/** The title a file gets: its name without the extension. */
const titleOf = (name: string) => (name.replace(/\.[^.]+$/, "") || name).slice(0, 160);

/**
 * Several files at once, picked or dropped on the list, each sent to R2 and
 * saved as a bookmark in the folder (and company) open. Two at a time, with
 * their progress in a tray; closing the tab stops what is still going.
 */
export function useBulkUpload({ companyId, folderId, enabled }: { companyId: string; folderId: string; enabled: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const controllers = useRef(new Map<string, AbortController>());
  const patch = useCallback((key: string, change: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i))), []);

  const send = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const batch = files.map((file) => ({ file, item: { key: crypto.randomUUID(), name: file.name, size: file.size, sent: 0, state: "waiting" as const } }));
      setItems((list) => [...list.filter((i) => i.state !== "done"), ...batch.map((b) => b.item)]);
      const queue = [...batch];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { file, item } = next;
          const controller = new AbortController();
          controllers.current.set(item.key, controller);
          patch(item.key, { state: "sending" });
          try {
            const uploadId = await uploadToR2(file, { companyId, folderId }, (p) => patch(item.key, { sent: p.sent }), controller.signal);
            const form = new FormData();
            form.set("companyId", companyId);
            form.set("folderId", folderId);
            form.set("title", titleOf(file.name));
            form.set("kind", "file");
            form.set("uploadId", uploadId);
            const result = await saveBookmark({}, form);
            if (result.error) throw new Error(result.error);
            patch(item.key, { state: "done", sent: file.size });
          } catch (error) {
            const aborted = error instanceof DOMException && error.name === "AbortError";
            patch(item.key, { state: "error", error: aborted ? "Cancelado." : error instanceof Error ? error.message : "Não foi possível enviar." });
          } finally {
            controllers.current.delete(item.key);
          }
        }
      };
      await Promise.all([worker(), worker()]);
      router.refresh();
    },
    [companyId, folderId, patch, router],
  );

  const pick = () => input.current?.click();
  const picker = enabled && (
    <>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void send([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <Button variant="outline" onClick={pick}>
        <UploadIcon />
        Enviar arquivos
      </Button>
    </>
  );
  const dropProps = enabled
    ? {
        onDragOver: (event: DragEvent) => {
          if (![...event.dataTransfer.types].includes("Files")) return;
          event.preventDefault();
          setDragging(true);
        },
        onDragLeave: (event: DragEvent) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        },
        onDrop: (event: DragEvent) => {
          if (![...event.dataTransfer.types].includes("Files")) return;
          event.preventDefault();
          setDragging(false);
          const files = [...event.dataTransfer.files].filter((file) => file.size > 0 || file.type);
          if (!files.length) return void toast.error("Arraste arquivos, não pastas.");
          void send(files);
        },
      }
    : {};
  const busy = items.some((i) => i.state === "waiting" || i.state === "sending");
  const tray = items.length > 0 && (
    <div role="status" aria-live="polite" className="fixed right-4 bottom-24 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-card p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="m-0 text-sm font-medium text-foreground">
          {busy ? "Enviando arquivos" : `${items.filter((i) => i.state === "done").length} de ${items.length} enviados`}
        </p>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={busy ? "Cancelar envios" : "Fechar"}
          onClick={() => {
            for (const controller of controllers.current.values()) controller.abort();
            if (!busy) setItems([]);
          }}
        >
          <XIcon />
        </Button>
      </div>
      <ul className="m-0 grid max-h-64 list-none gap-2 overflow-y-auto p-0">
        {items.map((item) => (
          <li key={item.key} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-foreground">{item.name}</span>
              <span className={`shrink-0 tabular-nums ${item.state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                {item.state === "done" ? <CheckIcon className="size-3.5 text-success" aria-label="Enviado" /> : item.state === "error" ? "Falhou" : `${Math.floor((item.sent / Math.max(1, item.size)) * 100)}%`}
              </span>
            </div>
            {item.state === "error" ? (
              <p className="m-0 mt-0.5 text-destructive">{item.error}</p>
            ) : (
              item.state !== "done" && (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(item.sent / Math.max(1, item.size)) * 100}%` }} />
                </div>
              )
            )}
            {item.state !== "error" && item.state !== "done" && <span className="text-muted-foreground tabular-nums">{fileSizeLabel(item.sent || 1)} de {fileSizeLabel(item.size)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
  return { picker, dropProps, dragging, tray };
}
