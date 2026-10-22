"use client";
import { useRef, useState } from "react";
import { PlayIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Tutorial } from "@/lib/help/tutorials";

export function durationLabel(seconds: number) {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes ? (rest ? `${minutes} min ${rest} s` : `${minutes} min`) : `${rest} s`;
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const SPEEDS = [1, 1.25, 1.5] as const;

/**
 * A tutorial video in the Console's own frame: a cover with the title until
 * the first play, the steps as chapters that follow the video, the speed and
 * the narration with each line's time. The captions are burned into the video.
 */
export function TutorialPlayer({ tutorial, className }: { tutorial: Tutorial; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const current = tutorial.chapters.reduce((found, chapter, i) => (time >= chapter.start ? i : found), -1);

  const play = (at?: number) => {
    const el = video.current;
    if (!el) return;
    if (at !== undefined) el.currentTime = at;
    setStarted(true);
    void el.play().catch(() => {});
    el.focus({ preventScroll: true });
  };

  return (
    <section id="video" aria-label={`Vídeo: ${tutorial.title}`} className={cn("flex scroll-mt-6 flex-col gap-3", className)}>
      <div className="relative overflow-hidden rounded-xl border bg-black shadow-card">
        <video
          ref={video}
          src={tutorial.src}
          controls={started}
          playsInline
          preload="metadata"
          className="block aspect-video w-full bg-black"
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onPlay={() => setStarted(true)}
          aria-label={tutorial.title}
        />
        {!started && (
          <button
            type="button"
            onClick={() => play()}
            className="group absolute inset-0 flex flex-col items-start justify-end gap-3 bg-[radial-gradient(120%_90%_at_70%_20%,var(--accent),var(--card))] p-5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:p-8"
          >
            <span className="text-caption font-medium text-muted-foreground">Tutorial em vídeo</span>
            <span className="max-w-xl text-title text-balance text-foreground sm:text-display-sm">{tutorial.title}</span>
            <span className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float transition-transform group-active:scale-95 motion-reduce:transition-none">
                <PlayIcon aria-hidden="true" className="ml-0.5 size-5 fill-current" />
              </span>
              <span className="text-sm text-muted-foreground">
                Assistir <span className="tabular-nums">· {durationLabel(tutorial.duration)}</span>
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ol className="m-0 flex min-w-0 flex-1 list-none flex-wrap gap-2 p-0" aria-label="Passos do vídeo">
          {tutorial.chapters.map((chapter, i) => (
            <li key={chapter.start}>
              <button
                type="button"
                onClick={() => play(chapter.start)}
                aria-current={i === current ? "step" : undefined}
                title={chapter.hint}
                className={cn(
                  "flex min-h-9 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  i === current && "border-primary bg-accent text-primary",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("flex size-5 items-center justify-center rounded-full bg-secondary text-[11px] tabular-nums", i === current && "bg-primary text-primary-foreground")}
                >
                  {i + 1}
                </span>
                {chapter.title}
                <span className="text-muted-foreground tabular-nums">{clock(chapter.start)}</span>
              </button>
            </li>
          ))}
        </ol>
        <div role="group" aria-label="Velocidade" className="flex shrink-0 rounded-md border bg-background p-0.5">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              onClick={() => {
                setSpeed(value);
                if (video.current) video.current.playbackRate = value;
              }}
              className={cn(
                "h-7 rounded px-2 text-xs font-medium tabular-nums transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                speed === value ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {String(value).replace(".", ",")}x
            </button>
          ))}
        </div>
      </div>
      <details className="group rounded-lg border bg-card px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-foreground marker:text-muted-foreground">O que o vídeo diz</summary>
        <ol className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {tutorial.transcript.map(([at, line]) => (
            <li key={at} className="flex gap-3 leading-6">
              <button
                type="button"
                onClick={() => play(at)}
                className="h-6 shrink-0 rounded px-1 text-xs font-medium text-primary tabular-nums hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={`Ir para ${clock(at)}`}
              >
                {clock(at)}
              </button>
              <span className="text-foreground">{line}</span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
