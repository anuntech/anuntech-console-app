"use client";
import { useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  DownloadIcon,
  EyeIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  LinkIcon,
  PenToolIcon,
  PlayIcon,
  PresentationIcon,
  StarIcon,
  type LucideIcon,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { InCardScope } from "@/components/console/list-grid";
import { kindOf } from "@/lib/bookmarks/board-rules";
import { fileTypeOf, showsPage, type FileGroup } from "@/lib/bookmarks/file-types";
import { letterTile, linkHost } from "@/lib/bookmarks/letter-tile";
import type { BookmarkView } from "@/lib/bookmarks/bookmarks";
import { cn } from "@/lib/cn";

/* A file as a drive shows it (Arquivos' grid): its picture, or its first page, or its kind, big; the name and the facts below. */

export const GROUP_ICONS: Record<FileGroup, LucideIcon> = {
  image: FileImageIcon,
  video: FileVideoIcon,
  audio: FileAudioIcon,
  pdf: FileTextIcon,
  document: FileTextIcon,
  sheet: FileSpreadsheetIcon,
  slides: PresentationIcon,
  archive: FileArchiveIcon,
  code: FileCodeIcon,
  design: PenToolIcon,
  other: FileIcon,
};

/** Brand and neutrals only, as the letter tiles: color here would read as a state elsewhere in the Console. */
const LETTER_TONES = ["bg-accent text-primary", "bg-secondary text-foreground", "bg-card text-foreground"];

/** What fills the top of the card. */
function Cover({ item }: { item: BookmarkView }) {
  const [broken, setBroken] = useState(false);
  const kind = kindOf(item);
  if (kind === "board")
    return item.preview ? (
      // The PNG is private and changes with every stroke: a plain image, no optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/bookmarks/${item.id}/preview?v=${encodeURIComponent(item.updatedAt ?? "")}`} alt="" loading="lazy" className="size-full bg-white object-contain" />
    ) : (
      <BigIcon icon={PresentationIcon} label="LOUSA" />
    );
  if (item.url) {
    const { letter, tone } = letterTile(item.url);
    return (
      <span className="flex size-full flex-col items-center justify-center gap-2">
        <span aria-hidden="true" className={cn("flex size-11 items-center justify-center rounded-xl border text-lg font-semibold uppercase", LETTER_TONES[tone])}>
          {letter}
        </span>
        <span className="max-w-[85%] truncate text-xs text-muted-foreground">{linkHost(item.url)}</span>
      </span>
    );
  }
  const type = fileTypeOf(item.fileName);
  if (type.group === "image" && item.thumb && !broken)
    return (
      // A small WebP made by the Console (lib/drive/thumbnails.ts), through a short-lived signed address.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/bookmarks/${item.id}/miniatura`} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="size-full object-cover" />
    );
  if (type.group === "video" && !broken)
    return (
      <span className="relative block size-full bg-black">
        {/* Only the start of the video is read, for its first frame. */}
        <video src={`/api/bookmarks/${item.id}/ver#t=0.5`} preload="metadata" muted playsInline onError={() => setBroken(true)} className="size-full object-cover" />
        <span aria-hidden="true" className="absolute inset-0 m-auto flex size-10 items-center justify-center rounded-full bg-black/55 text-white">
          <PlayIcon className="size-4 translate-x-px fill-current" />
        </span>
      </span>
    );
  if (showsPage(type.group) && item.page)
    return (
      <span className="block size-full overflow-hidden px-3 pt-3">
        {/* The start of the text the Console read, as the top of a page. */}
        <span className="block h-full overflow-hidden rounded-t-md border border-b-0 bg-white px-3 pt-3 text-[9px] leading-[1.45] break-words whitespace-pre-line text-neutral-700 shadow-[0_0_0_1px_rgb(0_0_0/0.02)] dark:bg-neutral-100">
          {item.page}
        </span>
      </span>
    );
  return <BigIcon icon={GROUP_ICONS[type.group]} label={type.label} />;
}

function BigIcon({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon className="size-8 stroke-[1.4]" aria-hidden="true" />
      <span className="text-[11px] font-semibold tracking-wide">{label}</span>
    </span>
  );
}

export function FileCard({
  item,
  href,
  external,
  onOpen,
  selected,
  selecting,
  onToggle,
  onDragStart,
  onStar,
  quick,
  actions,
  meta,
  badge,
}: {
  item: BookmarkView;
  href?: string | null;
  external?: boolean;
  onOpen?: () => void;
  selected: boolean;
  /** Something is selected: the boxes show on every card. */
  selecting: boolean;
  onToggle: () => void;
  onDragStart?: (event: DragEvent<HTMLLIElement>) => void;
  onStar?: () => void;
  /** The buttons on the picture when the pointer is over it: see, download, share. */
  quick?: { label: string; icon: LucideIcon; onClick: () => void }[];
  actions: ReactNode;
  meta: ReactNode;
  badge?: string | null;
}) {
  const type = fileTypeOf(item.fileName);
  const label = `Abrir ${item.title}`;
  const cover = "absolute inset-0 z-0 rounded-t-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
  return (
    <li
      {...(onDragStart ? { draggable: true, onDragStart } : {})}
      className={cn(
        "group/card relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/30",
        selected && "border-primary ring-2 ring-primary/30",
      )}
    >
      <div className="relative aspect-[16/11] overflow-hidden border-b bg-muted/40">
        <Cover item={item} />
        {onOpen ? (
          <button type="button" onClick={onOpen} aria-label={label} className={cover} />
        ) : href ? (
          external ? (
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (abre em nova aba)`} className={cover} />
          ) : (
            <Link href={href} prefetch={false} aria-label={label} className={cover} />
          )
        ) : null}
        <span className={cn("absolute top-2 left-2 z-10 rounded-md bg-background/90 p-1 transition-opacity", selected || selecting ? "opacity-100" : "opacity-0 group-hover/card:opacity-100 focus-within:opacity-100")}>
          <Checkbox aria-label={`Selecionar ${item.title}`} checked={selected} onCheckedChange={onToggle} className="block" />
        </span>
        {onStar && (
          <button
            type="button"
            onClick={onStar}
            aria-pressed={!!item.starred}
            aria-label={item.starred ? `Tirar a estrela de ${item.title}` : `Marcar ${item.title} com estrela`}
            className={cn(
              "absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground transition-opacity hover:text-primary",
              item.starred ? "text-primary opacity-100" : "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100",
            )}
          >
            <StarIcon className={cn("size-4", item.starred && "fill-current")} />
          </button>
        )}
        {kindOf(item) === "file" && (
          <span className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md border bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-foreground">
            {type.label}
          </span>
        )}
        {quick?.length ? (
          <span className="absolute right-2 bottom-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
            {quick.map(({ label: name, icon: Icon, onClick }) => (
              <button
                key={name}
                type="button"
                onClick={onClick}
                aria-label={name}
                title={name}
                className="flex size-7 items-center justify-center rounded-md border bg-background/95 text-foreground hover:text-primary"
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 items-start gap-1.5 px-2.5 pt-2 pb-2.5">
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[13px] font-medium text-foreground" title={item.title}>
            {item.title}
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {badge && <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[10px] font-medium text-primary">{badge}</span>}
            <span className="min-w-0 truncate">{meta}</span>
          </div>
        </div>
        <div className="relative z-10 -mt-1 -mr-2 shrink-0">
          <InCardScope>{actions}</InCardScope>
        </div>
      </div>
    </li>
  );
}

export const quickIcons = { preview: EyeIcon, download: DownloadIcon, link: LinkIcon };
