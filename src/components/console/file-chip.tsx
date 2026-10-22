"use client";
import type { ReactNode } from "react";
import { DownloadIcon, FileTextIcon, ImageIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { DownloadLink } from "@/components/console/download-link";
import { fileSizeLabel } from "@/lib/format";

/** The icon for a file: a picture for images, a page for everything else. */
export function FileIcon({ mime, className }: { mime?: string | null; className?: string }) {
  const Icon = mime?.startsWith("image/") ? ImageIcon : FileTextIcon;
  return <Icon aria-hidden="true" className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
}

/** `size` may be unknown (older records); the chip then shows only the name. */
type FileLike = { name: string; size?: number | null; mime?: string | null };

/**
 * The one way a file shows up inline: a small pill with icon, name and size.
 * With `href` it downloads (through the session-aware DownloadLink); with
 * `onRemove` it gets a remove button. Used for files already saved and for
 * files picked but not sent yet. A saved file marked for removal passes
 * `onRestore` instead: it reads as struck through, with "Desfazer" in place
 * of the ×, until the form is saved.
 */
export function FileChip({
  file,
  href,
  onRemove,
  onRestore,
  className,
}: {
  file: FileLike;
  href?: string;
  onRemove?: () => void;
  onRestore?: () => void;
  className?: string;
}) {
  const removed = !!onRestore;
  const link = href && !removed ? href : undefined;
  const body = (
    <>
      <FileIcon mime={file.mime} className={link ? "group-hover:text-primary" : undefined} />
      <span className={cn("max-w-[14rem] truncate font-medium", removed ? "text-muted-foreground line-through" : "text-foreground")}>
        {file.name}
      </span>
      {file.size != null && (
        <span className={cn("shrink-0 text-muted-foreground", removed && "line-through")}>{fileSizeLabel(file.size)}</span>
      )}
      {removed && <span className="sr-only">(será removido ao salvar)</span>}
    </>
  );
  // One button slot for both states, so focus stays put when it flips.
  const action = removed ? (
    <Button type="button" variant="ghost" size="xs" aria-label={`Desfazer a remoção de ${file.name}`} onClick={onRestore}>
      Desfazer
    </Button>
  ) : onRemove ? (
    <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remover ${file.name}`} onClick={onRemove}>
      <XIcon />
    </Button>
  ) : null;
  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border pl-2.5 text-xs",
        removed ? "border-dashed bg-transparent" : "bg-card",
        action ? "pr-0.5" : "pr-2.5",
        link && "transition-colors hover:bg-accent",
        className,
      )}
    >
      {link ? (
        <DownloadLink href={link} filename={file.name} className="group flex min-w-0 items-center gap-1.5">
          {body}
        </DownloadLink>
      ) : (
        body
      )}
      {action}
    </span>
  );
}

/** A list of chips, wrapping. */
export function FileChips({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("flex flex-wrap gap-2 [&>li]:max-w-full", className)}>{children}</ul>;
}

/**
 * A roomier row for side panels and lists: name, size and a detail line.
 * With `href` the row downloads; `actions` sit at the end, outside the link.
 */
export function FileRow({
  file,
  href,
  detail,
  actions,
  className,
}: {
  file: FileLike;
  href?: string;
  detail?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const content = (
    <>
      <FileIcon mime={file.mime} className={cn("size-4", href && "group-hover:text-primary")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium text-foreground", href && "group-hover:text-primary")}>
          {file.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {file.size != null && fileSizeLabel(file.size)}
          {file.size != null && detail ? " · " : null}
          {detail}
        </span>
      </span>
      {href && <DownloadIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-primary" />}
    </>
  );
  const row = "flex items-center gap-3 rounded-lg border px-3 py-2";
  if (href && !actions)
    return (
      <DownloadLink href={href} filename={file.name} className={cn("group transition-colors hover:bg-accent", row, className)}>
        {content}
      </DownloadLink>
    );
  return (
    <div className={cn(row, actions && "pr-2", href && "transition-colors has-[>a:hover]:bg-accent", className)}>
      {href ? (
        <DownloadLink href={href} filename={file.name} className="group flex min-w-0 flex-1 items-center gap-3">
          {content}
        </DownloadLink>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{content}</span>
      )}
      {actions && <span className="flex shrink-0 items-center gap-1">{actions}</span>}
    </div>
  );
}
