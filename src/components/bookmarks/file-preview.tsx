"use client";
import { useEffect, useState } from "react";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { previewOf } from "@/lib/drive/drive-rules";
import { fileSizeLabel } from "@/lib/format";
import type { BookmarkView } from "@/lib/bookmarks/bookmarks";

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

/** A file shown in the Console: picture, PDF, video, audio or text, with "Baixar" beside it. */
export function FilePreview({ item, onClose }: { item: BookmarkView | null; onClose: () => void }) {
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
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[min(64rem,calc(100vw-2rem))] max-w-none flex-col gap-3 sm:max-w-none">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{item?.title}</DialogTitle>
          <DialogDescription className="truncate">
            {[item?.fileName, item?.fileSize ? fileSizeLabel(item.fileSize) : null].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border bg-muted/40">
          {!item || !preview ? null : failed ? (
            <p className="m-0 p-8 text-center text-sm text-muted-foreground">Não foi possível mostrar este arquivo. Baixe para abrir no seu aparelho.</p>
          ) : preview.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived address from R2, not an asset to optimize
            <img src={src} alt={item.title} className="max-h-[70dvh] max-w-full object-contain" onError={() => setFailed(true)} />
          ) : preview.kind === "pdf" ? (
            <iframe src={src} title={item.title} className="h-[70dvh] w-full rounded-lg bg-background" />
          ) : preview.kind === "video" ? (
            <video src={src} controls playsInline className="max-h-[70dvh] max-w-full" onError={() => setFailed(true)} />
          ) : preview.kind === "audio" ? (
            <audio src={src} controls className="w-full max-w-lg p-6" onError={() => setFailed(true)} />
          ) : text === null ? (
            <p className="m-0 p-8 text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <pre className="m-0 h-[70dvh] w-full overflow-auto p-4 text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere] text-foreground">{text}</pre>
          )}
        </div>
        <div className="flex justify-end gap-2">
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
