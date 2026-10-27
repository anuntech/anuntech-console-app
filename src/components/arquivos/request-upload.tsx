"use client";
import { useRef, useState, type DragEvent } from "react";
import { CheckIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/console/form-field";
import { uploadThroughLink } from "@/components/bookmarks/r2-upload";
import { requestRefusal } from "@/lib/drive/share-rules";
import { fileSizeLabel } from "@/lib/format";

type Item = { key: string; name: string; size: number; sent: number; state: "waiting" | "sending" | "done" | "error"; error?: string };

/** A request link: the visitor's name, then files picked or dropped, each sent to R2 and saved in the folder. */
export function RequestUpload({ token }: { token: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const patch = (key: string, change: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)));
  const send = async (files: File[]) => {
    const batch = files.map((file) => ({ file, item: { key: crypto.randomUUID(), name: file.name, size: file.size, sent: 0, state: "waiting" as const } }));
    setItems((list) => [...list, ...batch.map((b) => b.item)]);
    const queue = [...batch];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const { file, item } = next;
        const blocked = requestRefusal(file.name);
        if (blocked) {
          patch(item.key, { state: "error", error: blocked });
          continue;
        }
        patch(item.key, { state: "sending" });
        try {
          await uploadThroughLink(file, token, name.trim(), (p) => patch(item.key, { sent: p.sent }), new AbortController().signal);
          patch(item.key, { state: "done", sent: file.size });
        } catch (error) {
          patch(item.key, { state: "error", error: error instanceof Error ? error.message : "Não foi possível enviar." });
        }
      }
    };
    await Promise.all([worker(), worker()]);
  };
  const busy = items.some((i) => i.state === "waiting" || i.state === "sending");
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Seu nome" htmlFor="request-name" hint="Opcional: aparece junto dos arquivos para quem pediu.">
        <Input id="request-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Ex.: Marina, do financeiro" />
      </FormField>
      <div
        onDragOver={(event: DragEvent) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          setDragging(false);
          void send([...event.dataTransfer.files]);
        }}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm ${dragging ? "border-primary bg-accent" : "border-border"}`}
      >
        <UploadIcon className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="m-0 text-foreground">Arraste os arquivos para cá</p>
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
        <Button type="button" onClick={() => input.current?.click()}>
          Escolher arquivos
        </Button>
        <p className="m-0 text-xs text-muted-foreground">Qualquer tipo, até 100 GB cada. Programas e scripts não são aceitos.</p>
      </div>
      {items.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="rounded-lg border px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-foreground">{item.name}</span>
                <span className={`shrink-0 tabular-nums ${item.state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                  {item.state === "done" ? <CheckIcon className="size-3.5 text-success" aria-label="Enviado" /> : item.state === "error" ? "Falhou" : `${Math.floor((item.sent / Math.max(1, item.size)) * 100)}%`}
                </span>
              </div>
              {item.state === "error" && <p className="m-0 mt-0.5 text-destructive">{item.error}</p>}
              {item.state !== "error" && item.state !== "done" && (
                <p className="m-0 mt-0.5 text-muted-foreground tabular-nums">
                  {fileSizeLabel(item.sent || 1)} de {fileSizeLabel(item.size)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && !busy && items.every((i) => i.state === "done") && (
        <p className="m-0 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">Tudo enviado. Quem pediu já recebe os arquivos no Console.</p>
      )}
      {busy && <p className="m-0 text-xs text-muted-foreground">Deixe esta página aberta até o envio terminar.</p>}
    </div>
  );
}
