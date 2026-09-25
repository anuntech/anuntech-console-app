"use client";
import type { ReactNode } from "react";
import { DownloadIcon, FileTextIcon, ImageIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DownloadLink } from "@/components/console/download-link";
import { fileSizeLabel } from "@/lib/format";

/** The icon for a file: a picture for images, a page for everything else. */
export function FileIcon({ mime, className }: { mime?: string | null; className?: string }) {
  const Icon = mime?.startsWith("image/") ? ImageIcon : FileTextIcon;
  return <Icon aria-hidden="true" className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
}

type FileLike = { name: string; size: number; mime?: string | null };

/**
 * The one way a file shows up inline: a small pill with icon, name and size.
 * With `href` it downloads (through the session-aware DownloadLink); with
 * `onRemove` it gets a remove button. Used for files already saved and for
 * files picked but not sent yet.
 */
export function FileChip({
  file,
  href,
  onRemove,
  className,
}: {
  file: FileLike;
  href?: string;
  onRemove?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <FileIcon mime={file.mime} className={href ? "group-hover:text-primary" : undefined} />
      <span className="max-w-[14rem] truncate font-medium text-foreground">{file.name}</span>
      <span className="shrink-0 text-muted-foreground">{fileSizeLabel(file.size)}</span>
    </>
  );
  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border bg-card pl-2.5 text-xs",
        onRemove ? "pr-0.5" : "pr-2.5",
        href && "transition-colors hover:bg-accent",
        className,
      )}
    >
      {href ? (
        <DownloadLink href={href} filename={file.name} className="group flex min-w-0 items-center gap-1.5">
          {body}
        </DownloadLink>
      ) : (
        body
      )}
      {onRemove && (
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remover ${file.name}`} onClick={onRemove}>
          <XIcon />
        </Button>
      )}
    </span>
  );
}

/** A list of chips, wrapping. */
export function FileChips({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("flex flex-wrap gap-2 [&>li]:max-w-full", className)}>{children}</ul>;
}

/** A roomier row for side panels and lists: name, size and a detail line, with a download icon. */
export function FileRow({
  file,
  href,
  detail,
  className,
}: {
  file: FileLike;
  href: string;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <DownloadLink
      href={href}
      filename={file.name}
      className={cn("group flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors hover:bg-accent", className)}
    >
      <FileIcon mime={file.mime} className="size-4 group-hover:text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{file.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {fileSizeLabel(file.size)}
          {detail ? <> · {detail}</> : null}
        </span>
      </span>
      <DownloadIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-primary" />
    </DownloadLink>
  );
}
