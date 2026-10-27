"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { previewOf } from "@/lib/drive/drive-rules";
import { fileSizeLabel } from "@/lib/format";
import type { BookmarkView } from "@/lib/bookmarks/bookmarks";
import { fileTypeOf } from "@/lib/bookmarks/file-types";
import { GROUP_ICONS } from "./file-card";

/** Straight to the file: the browser writes it to disk as it arrives (a file in R2 can be gigabytes). */
export function downloadBookmark(item: Pick<BookmarkView, "id" | "fileName" | "title">) {
  const link = document.createElement("a");
  link.href = `/api/bookmarks/${item.id}`;
  link.download = (item.fileName ?? item.title).replace(/[\\/]/g, "_");
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export const canPreview = (item: Pick<BookmarkView, "fileName" | "fileSize" | "url" | "board">) =>
  !item.url && !item.board && !!previewOf(item.fileName, item.fileSize);

/**
 * A file shown in the Console: picture, PDF, video, audio or text, or its
 * kind when it has no preview, with its details beside it, "Baixar" and the
 * arrows (and ← →) to the other files of the list.
 */
export function FilePreview({
  item,
  items = [],
  onNavigate,
  onClose,
  details = [],
  actions,
}: {
  item: BookmarkView | null;
  /** The list's files, for the arrows. */
  items?: BookmarkView[];
  onNavigate?: (item: BookmarkView) => void;
  onClose: () => void;
  details?: string[][];
  actions?: ReactNode;
}) {
  const preview = item ? previewOf(item.fileName, item.fileSize) : null;
  const src = item ? `/api/bookmarks/${item.id}/ver` : "";
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  // Starting over for each file, while rendering (the text arrives afterwards).
  if ((item?.id ?? null) !== shown) {
    setShown(item?.id ?? null);
    setText(null);
    setFailed(false);
  }
  const at = item ? items.findIndex((i) => i.id === item.id) : -1;
  const previous = at > 0 ? items[at - 1] : null;
  const next = at >= 0 && at < items.length - 1 ? items[at + 1] : null;
  useEffect(() => {
    if (!item || preview?.kind !== "text") return;
    let alive = true;
    fetch(`/api/bookmarks/${item.id}/ver`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error())))
      .then((value) => alive && setText(value))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [item, preview?.kind]);
  useEffect(() => {
    if (!item || !onNavigate) return;
    const keys = (event: KeyboardEvent) => {
      // Not while typing, nor while a video takes the arrows.
      if ((event.target as HTMLElement | null)?.closest("input, textarea, video, audio")) return;
      if (event.key === "ArrowLeft" && previous) onNavigate(previous);
      if (event.key === "ArrowRight" && next) onNavigate(next);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [item, previous, next, onNavigate]);
  const type = fileTypeOf(item?.fileName);
  const Icon = GROUP_ICONS[type.group];
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[94dvh] w-[min(80rem,calc(100vw-2rem))] max-w-none flex-col gap-3 sm:max-w-none">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{item?.title}</DialogTitle>
          <DialogDescription className="truncate">
            {[item?.fileName, item?.fileSize ? fileSizeLabel(item.fileSize) : null, items.length > 1 && at >= 0 ? `${at + 1} de ${items.length}` : null].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="relative flex min-h-[50dvh] items-center justify-center overflow-auto rounded-lg border bg-muted/40">
            {!item ? null : !preview ? (
              <div className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
                <Icon className="size-16 stroke-[1.2]" aria-hidden="true" />
                <span className="text-sm font-semibold tracking-wide text-foreground">{type.label}</span>
                <p className="m-0 max-w-sm text-sm">Este tipo de arquivo não tem prévia no Console. Baixe para abrir no programa que você usa.</p>
              </div>
            ) : failed ? (
              <p className="m-0 p-8 text-center text-sm text-muted-foreground">Não foi possível mostrar este arquivo. Baixe para abrir no seu aparelho.</p>
            ) : preview.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived address from R2, not an asset to optimize
              <img src={src} alt={item.title} className="max-h-[72dvh] max-w-full object-contain" onError={() => setFailed(true)} />
            ) : preview.kind === "pdf" ? (
              <iframe src={src} title={item.title} className="h-[72dvh] w-full rounded-lg bg-background" />
            ) : preview.kind === "video" ? (
              <video src={src} controls playsInline className="max-h-[72dvh] max-w-full" onError={() => setFailed(true)} />
            ) : preview.kind === "audio" ? (
              <audio src={src} controls className="w-full max-w-lg p-6" onError={() => setFailed(true)} />
            ) : text === null ? (
              <p className="m-0 p-8 text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <pre className="m-0 h-[72dvh] w-full overflow-auto p-4 text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere] text-foreground">{text}</pre>
            )}
            {previous && onNavigate && (
              <Button variant="outline" size="icon" aria-label="Arquivo anterior" title="Anterior (←)" className="absolute top-1/2 left-2 -translate-y-1/2 bg-background/90" onClick={() => onNavigate(previous)}>
                <ChevronLeftIcon />
              </Button>
            )}
            {next && onNavigate && (
              <Button variant="outline" size="icon" aria-label="Próximo arquivo" title="Próximo (→)" className="absolute top-1/2 right-2 -translate-y-1/2 bg-background/90" onClick={() => onNavigate(next)}>
                <ChevronRightIcon />
              </Button>
            )}
          </div>
          {details.length > 0 && (
            <aside aria-label="Detalhes" className="min-h-0 overflow-auto rounded-lg border p-4">
              <p className="m-0 mb-3 text-sm font-medium text-foreground">Detalhes</p>
              <dl className="m-0 grid gap-2.5 text-xs">
                {details.map(([term, value]) => (
                  <div key={term} className="grid gap-0.5">
                    <dt className="text-muted-foreground">{term}</dt>
                    <dd className="m-0 break-words text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {actions}
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {item && (
            <Button onClick={() => downloadBookmark(item)}>
              <DownloadIcon />
              Baixar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
