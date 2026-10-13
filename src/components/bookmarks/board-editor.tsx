"use client";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { CheckIcon, CloudOffIcon, EyeIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "cn";
import { PageHeader } from "@/components/console/page-header";
import { useFillViewport } from "@/components/console/fill-viewport";
import { dateTimeLabel, relativeLabel } from "@/lib/format";
import type { BoardScene } from "@/lib/bookmarks/board-rules";
import type { SaveStatus } from "./board-canvas";

// The canvas and Excalidraw only exist in the browser; the page streams without them.
const BoardCanvas = dynamic(() => import("./board-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground" role="status">
      Carregando a lousa…
    </div>
  ),
});

export type BoardEditorData = {
  id: string;
  title: string;
  scene: BoardScene;
  editable: boolean;
  folder: { id: string; name: string } | null;
  /** ISO instant of the last stroke stored, shown while nothing changes. */
  updatedAt: string;
  /** ISO instant the page was rendered at, so relative times hydrate equal. */
  now: string;
};

/** One whiteboard, full width: the title above, the canvas down to the dock. */
export function BoardEditor({ data }: { data: BoardEditorData }) {
  const [status, setStatus] = useState<SaveStatus>({ state: "saved", at: data.updatedAt });
  const onStatus = useCallback((next: SaveStatus) => setStatus(next), []);
  // Measured once for the loading text and the canvas alike, so nothing jumps when Excalidraw lands.
  const frame = useRef<HTMLDivElement>(null);
  const fit = useFillViewport(frame, { min: 420 });
  const crumbs = [
    { label: "Bookmarks", href: "/bookmarks" },
    ...(data.folder ? [{ label: data.folder.name, href: `/bookmarks?pasta=${data.folder.id}` }] : []),
    { label: data.title },
  ];
  return (
    <>
      <PageHeader
        className="mb-4"
        crumbs={crumbs}
        title={data.title}
        actions={
          data.editable ? (
            <Status status={status} now={data.now} />
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <EyeIcon aria-hidden="true" className="size-4" />
              Só leitura
            </span>
          )
        }
      />
      <div
        ref={frame}
        data-fill-viewport=""
        className="overflow-hidden rounded-xl border bg-card shadow-card"
        style={{
          height: fit?.height ?? "max(420px, calc(100dvh - 190px))",
          marginBottom: fit?.clearance || undefined,
        }}
      >
        <BoardCanvas id={data.id} title={data.title} scene={data.scene} editable={data.editable} onStatus={onStatus} />
      </div>
    </>
  );
}

/** What happened to the last stroke, in a few words. */
function Status({ status, now }: { status: SaveStatus; now: string }) {
  const base = "flex items-center gap-1.5 text-sm";
  if (status.state === "error")
    return (
      <span role="alert" className={cn(base, "text-destructive")}>
        <CloudOffIcon aria-hidden="true" className="size-4" />
        {status.message}
      </span>
    );
  if (status.state === "saving" || status.state === "dirty")
    return (
      <span role="status" className={cn(base, "text-muted-foreground")}>
        <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
        Salvando…
      </span>
    );
  return (
    <span role="status" className={cn(base, "text-muted-foreground")}>
      <CheckIcon aria-hidden="true" className="size-4 text-success" />
      {status.at ? (
        <>
          Salvo{" "}
          <time dateTime={status.at} title={dateTimeLabel(status.at)}>
            {relativeLabel(status.at, now)}
          </time>
        </>
      ) : (
        "Salvo"
      )}
    </span>
  );
}
