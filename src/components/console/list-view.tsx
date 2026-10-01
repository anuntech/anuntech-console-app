"use client";
import { useRef, type MouseEvent, type ReactNode } from "react";
import { useFillViewport } from "@/components/console/fill-viewport";
import { useInCard } from "@/components/console/list-grid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DownloadIcon, ExternalLinkIcon, MoreHorizontalIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadFile } from "@/components/console/download-link";
import { TableCell, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/console/table-pagination";

/**
 * The one list layout of the Console:
 *
 *   ┌ toolbar: search · filter chips · filters ···· actions ┐
 *   │ table (or an EmptyState)                              │
 *   └ footer: per page · "1–25 de 80 x" · ‹ page › ──────────┘
 *
 * Every list (chamados, faturas, empresas, contratos, orçamentos, projetos,
 * produtos…) renders inside this card, with the same toolbar and footer.
 *
 * With `fill`, the card grows down to just above the dock at most, so the
 * page does not scroll: the rows scroll inside, under the column names,
 * while the toolbar and the footer stay in view. Small screens are most of
 * the clients, and the page actions (`actions`) share the toolbar's line
 * instead of taking one of their own.
 */
const LIST_MIN_HEIGHT = 280;

export function ListCard({
  label,
  toolbar,
  layout,
  actions,
  footer,
  fill = false,
  children,
  className,
}: {
  /** Accessible name of the region, e.g. "Lista de contratos". */
  label: string;
  toolbar?: ReactNode;
  /** The Lista · Grade switch (`ViewToggle`), just before the actions. */
  layout?: ReactNode;
  /** The page's own buttons (create, export), at the right end of the toolbar. */
  actions?: ReactNode;
  footer?: ReactNode;
  fill?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  // Lower than the board's floor: the toolbar, the column names and the
  // footer still leave a few rows, and on a short notebook screen the page
  // keeps from scrolling.
  const fit = useFillViewport(ref, { enabled: fill, min: LIST_MIN_HEIGHT });
  return (
    <section
      ref={ref}
      aria-label={label}
      data-fill-viewport={fill ? "" : undefined}
      style={
        !fill
          ? undefined
          : fit
            ? { maxHeight: fit.height, marginBottom: fit.clearance || undefined }
            : // Until measured (the first paint of a full load): a header's height above,
              // the dock below, so the card does not start out under the dock.
              { maxHeight: `max(${LIST_MIN_HEIGHT}px, calc(100dvh - 172px))` }
      }
      className={cn("overflow-hidden rounded-xl border bg-card shadow-card", fill && "flex flex-col", className)}
    >
      {(toolbar || layout || actions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
          {toolbar}
          {(layout || actions) && (
            // Together at the right end, so they wrap as one.
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {layout}
              {actions && (
                <div
                  className={cn(
                    "flex items-center gap-2",
                    // On a phone the buttons keep only their icon, so they fit
                    // beside the filters; the name stays for screen readers.
                    "max-sm:[&_[data-slot=button]]:w-9 max-sm:[&_[data-slot=button]]:gap-0 max-sm:[&_[data-slot=button]]:px-0 max-sm:[&_[data-slot=button]]:text-[0px]",
                  )}
                >
                  {actions}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {fill ? (
        <div
          data-list-body
          className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible"
        >
          {children}
        </div>
      ) : (
        children
      )}
      {fill && footer ? <div className="shrink-0">{footer}</div> : footer}
    </section>
  );
}

/** An active filter shown as a chip in the toolbar, removed by following `removeHref`. */
export function FilterChip({
  icon,
  label,
  removeHref,
  removeLabel,
}: {
  icon?: ReactNode;
  label: string;
  removeHref: string;
  removeLabel?: string;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background pr-1 pl-2.5 text-xs font-medium text-foreground [&>svg]:size-3.5 [&>svg]:text-muted-foreground">
      {icon}
      <span className="max-w-[14rem] truncate">{label}</span>
      <Link
        href={removeHref}
        scroll={false}
        aria-label={removeLabel ?? `Remover filtro ${label}`}
        className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <XIcon className="size-3.5" />
      </Link>
    </span>
  );
}

const interactive = "a, button, input, select, textarea, label, [role='menuitem'], [role='checkbox'], [data-row-ignore]";

/**
 * A table row that opens its record when clicked anywhere. The first cell
 * still holds a real link (for keyboard, screen readers and ⌘-click); clicks
 * on buttons, menus and links inside the row keep their own behaviour, and
 * selecting text does not navigate.
 */
export function LinkRow({
  href = null,
  external = false,
  onOpen,
  className,
  children,
}: {
  /** Without a destination (and no `onOpen`) the row is a plain row. */
  href?: string | null;
  /** Opens the record in place instead (a sheet, a download). */
  onOpen?: () => void;
  /** Opens outside the Console, in a new tab (a product's own site). */
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  // Row menus are non-modal, so the click that dismisses an open menu reaches the row
  // underneath; a click that started while any menu was open only closes it.
  const menuWasOpen = useRef(false);
  const noteMenu = () => {
    menuWasOpen.current = !!document.querySelector('[role="menu"][data-state="open"]');
  };
  const open = (event: MouseEvent<HTMLTableRowElement>) => {
    if (menuWasOpen.current) return void (menuWasOpen.current = false);
    if (event.defaultPrevented || event.button !== 0) return;
    // Menus and dialogs opened from the row are portaled elsewhere in the DOM, but
    // React still bubbles their clicks here; only clicks really inside the row count.
    const target = event.target as HTMLElement;
    if (!event.currentTarget.contains(target) || target.closest(interactive)) return;
    if (window.getSelection()?.toString()) return;
    if (onOpen) return onOpen();
    if (!href) return;
    if (external) return void window.open(href, "_blank", "noopener,noreferrer");
    if (event.metaKey || event.ctrlKey) return void window.open(href, "_blank");
    router.push(href);
  };
  if (!href && !onOpen) return <TableRow className={className}>{children}</TableRow>;
  return (
    <TableRow className={cn("cursor-pointer", className)} onPointerDownCapture={noteMenu} onClick={open}>
      {children}
    </TableRow>
  );
}

/** The first cell of a row: the record's name as a link, with a muted line under it. */
export function PrimaryCell({
  href = null,
  external = false,
  onOpen,
  title,
  subtitle,
  leading,
  className,
}: {
  /** Without a destination (and no `onOpen`) the name is plain text. */
  href?: string | null;
  /** Opens the record in place (a sheet, a download): the name becomes a button. */
  onOpen?: () => void;
  /** Opens outside the Console, in a new tab, with an external-link mark. */
  external?: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  /** An icon or avatar before the text. */
  leading?: ReactNode;
  className?: string;
}) {
  const content = (
    <>
      {leading}
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-foreground group-hover:text-primary">{title}</span>
          {external && href && <ExternalLinkIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />}
        </span>
        {subtitle ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
    </>
  );
  return (
    // w-full + max-w-0: the name column takes the room the other columns leave and
    // truncates, instead of stretching the table past the card; min-w keeps it readable.
    <TableCell className={cn("w-full max-w-0 min-w-48 py-3 pl-4", className)}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="group flex w-full min-w-0 items-center gap-3 text-left">
          {content}
        </button>
      ) : !href ? (
        <span className="flex min-w-0 items-center gap-3">{content}</span>
      ) : external ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 items-center gap-3">
          {content}
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      ) : (
        // No prefetch: a list shows 25+ rows, and opening one already shows the loading state at once.
        <Link href={href} prefetch={false} className="group flex min-w-0 items-center gap-3">
          {content}
        </Link>
      )}
    </TableCell>
  );
}

/** The "Empresa" column of staff lists: truncated, hidden on phones (the head needs `hidden md:table-cell` too). */
export function CompanyCell({ children }: { children: ReactNode }) {
  return (
    <TableCell className="hidden max-w-[14rem] md:table-cell">
      <span className="block truncate text-foreground">{children}</span>
    </TableCell>
  );
}

/**
 * The "…" menu at the end of a row. Put DropdownMenuItems inside. Inside a
 * GridCard it is the card's menu instead, without the table cell.
 */
export function RowActions({ label, children, extra }: { label: string; children: ReactNode; extra?: ReactNode }) {
  const inCard = useInCard();
  const menu = (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${label}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      {extra}
    </>
  );
  if (inCard) return menu;
  return (
    <TableCell className="w-12 pr-3 text-right" data-row-ignore>
      {menu}
    </TableCell>
  );
}

/** A row-menu item that downloads a private file (PDF, attachment) through the session-aware fetch. */
export function DownloadMenuItem({ href, filename, children = "Baixar PDF" }: { href: string; filename: string; children?: ReactNode }) {
  return (
    <DropdownMenuItem onSelect={() => void downloadFile(href, filename)}>
      <DownloadIcon />
      {children}
    </DropdownMenuItem>
  );
}

/** The footer, wired to the URL: `hrefFor` builds the list URL for a page and size. */
export function ListPagination({
  page,
  pageSize,
  total,
  pageCount,
  noun,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  noun: [string, string];
  hrefFor: (patch: { page: number; pageSize?: number }) => string;
}) {
  const router = useRouter();
  return (
    <TablePagination
      page={page}
      pageCount={pageCount}
      pageSize={pageSize}
      total={total}
      noun={noun}
      onPageChange={(next) => router.push(hrefFor({ page: next }), { scroll: false })}
      onPageSizeChange={(size) => router.push(hrefFor({ page: 1, pageSize: size }), { scroll: false })}
    />
  );
}
