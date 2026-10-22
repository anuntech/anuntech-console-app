"use client";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A long attention list shows its first rows and "Ver todos (n)" for the rest.
 * The hidden rows stay in the HTML (marked `data-extra`), so nothing is lost to
 * search, the assistant or a screen reader that expands the list; they open in
 * place, without motion, because the painel is opened many times a day.
 */
export function AttentionMore({ total, children, className }: { total: number; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <ul id={id} className={cn(className, !open && "[&>li[data-extra]]:hidden")}>
        {children}
      </ul>
      <div className="border-t px-6 pt-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
          className="rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {open ? "Ver menos" : `Ver todos (${total})`}
        </button>
      </div>
    </>
  );
}
