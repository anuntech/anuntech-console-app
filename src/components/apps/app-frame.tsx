"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, LoaderCircleIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFillViewport } from "@/components/console/fill-viewport";
import { openApp } from "@/lib/apps/app-actions";

type Frame = { phase: "opening" } | { phase: "ready"; src: string } | { phase: "error"; message: string };

// What the apps need inside the frame: their own cookie and scripts, forms,
// links and files that open outside, downloads (exports). Nothing else.
const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads";

export type AppFrameData = {
  /** The product (engagement) the app belongs to. */
  id: string;
  name: string;
  /** The app's name in the registry, shown when the product is called something else. */
  app: string;
  company: string;
};

/** One app filling the content area, under a bar with the way back, its name and the company. */
export function AppFrame({ data }: { data: AppFrameData }) {
  const [frame, setFrame] = useState<Frame>({ phase: "opening" });
  const [loaded, setLoaded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const fit = useFillViewport(box, { min: 420 });
  const asked = useRef<string | null>(null);

  // A new pass every time: the old one is single-use for the app and lives two minutes.
  const request = useCallback(() => {
    openApp(data.id).then(
      (result) => {
        setLoaded(false);
        setFrame("src" in result ? { phase: "ready", src: result.src } : { phase: "error", message: result.error });
      },
      () =>
        setFrame({
          phase: "error",
          message: "Não deu para falar com o Console. Confira a conexão e tente de novo.",
        }),
    );
  }, [data.id]);

  useEffect(() => {
    // One pass per visit, though React runs effects twice in development.
    if (asked.current === data.id) return;
    asked.current = data.id;
    request();
  }, [data.id, request]);

  const reload = () => {
    setFrame({ phase: "opening" });
    request();
  };

  const busy = frame.phase === "opening" || (frame.phase === "ready" && !loaded);
  return (
    <>
      <header className="mb-3 flex items-center gap-3">
        {/* A link, not history.back(): pages inside the frame add to the tab's history. */}
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/produtos" aria-label="Voltar para Produtos e serviços">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-6 font-semibold tracking-[-0.01em] text-foreground">{data.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {[data.company, data.app !== data.name ? data.app : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={frame.phase === "opening"}>
          <RotateCwIcon />
          <span className="max-sm:sr-only">Recarregar</span>
        </Button>
      </header>
      <div
        ref={box}
        data-fill-viewport=""
        className="relative overflow-hidden rounded-xl border bg-card shadow-card"
        style={{ height: fit?.height ?? "max(420px, calc(100dvh - 150px))", marginBottom: fit?.clearance || undefined }}
      >
        {frame.phase === "ready" && (
          <iframe
            key={frame.src}
            src={frame.src}
            title={data.name}
            sandbox={SANDBOX}
            allow="clipboard-write"
            className="block size-full border-0 bg-card"
            onLoad={() => setLoaded(true)}
          />
        )}
        {busy && (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center gap-2 bg-card text-sm text-muted-foreground"
          >
            <LoaderCircleIcon aria-hidden="true" className="size-4 motion-safe:animate-spin" />
            Abrindo {data.name}…
          </div>
        )}
        {frame.phase === "error" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-warning-soft text-warning [&_svg]:size-6">
              <TriangleAlertIcon aria-hidden="true" />
            </span>
            <p className="max-w-[46ch] text-sm text-pretty text-foreground">{frame.message}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={reload}>Tentar de novo</Button>
              <Button variant="outline" asChild>
                <Link href="/produtos">Ver produtos e serviços</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
