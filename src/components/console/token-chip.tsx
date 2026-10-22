"use client";
import type { ReactNode } from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A removable token inside a field: a label, a person, a technology. Same
 * geometry as FileChip, one step smaller, so tokens and files read as one family.
 */
export function TokenChip({
  children,
  onRemove,
  removeLabel,
  className,
}: {
  children: ReactNode;
  onRemove?: () => void;
  /** Accessible name for the remove button, e.g. "Remover design". */
  removeLabel?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 rounded-md border bg-card text-xs text-foreground",
        onRemove ? "pr-0.5 pl-2" : "px-2",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5 truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}
