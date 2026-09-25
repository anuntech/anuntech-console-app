"use client";
import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontalIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/console/table-pagination";

/**
 * The one list layout of the Console:
 *
 *   ┌ toolbar: search · filter chips · filters ─────────────┐
 *   │ table (or an EmptyState)                              │
 *   └ footer: per page · "1–25 de 80 x" · ‹ page › ──────────┘
 *
 * Every list (chamados, faturas, empresas, contratos, orçamentos, projetos,
 * produtos…) renders inside this card, with the same toolbar and footer.
 */
export function ListCard({
  label,
  toolbar,
  footer,
  children,
  className,
}: {
  /** Accessible name of the region, e.g. "Lista de contratos". */
  label: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={label} className={cn("overflow-hidden rounded-xl border bg-card shadow-card", className)}>
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">{toolbar}</div>}
      {children}
      {footer}
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
export function LinkRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const open = (event: MouseEvent<HTMLTableRowElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    // Menus and dialogs opened from the row are portaled elsewhere in the DOM, but
    // React still bubbles their clicks here; only clicks really inside the row count.
    const target = event.target as HTMLElement;
    if (!event.currentTarget.contains(target) || target.closest(interactive)) return;
    if (window.getSelection()?.toString()) return;
    if (event.metaKey || event.ctrlKey) return void window.open(href, "_blank");
    router.push(href);
  };
  return (
    <TableRow className={cn("cursor-pointer", className)} onClick={open}>
      {children}
    </TableRow>
  );
}

/** The first cell of a row: the record's name as a link, with a muted line under it. */
export function PrimaryCell({
  href,
  title,
  subtitle,
  leading,
  className,
}: {
  href: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** An icon or avatar before the text. */
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <TableCell className={cn("max-w-[28rem] py-3 pl-4", className)}>
      <Link href={href} className="group flex min-w-0 items-center gap-3">
        {leading}
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground group-hover:text-primary">{title}</span>
          {subtitle ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
        </span>
      </Link>
    </TableCell>
  );
}

/** The "…" menu at the end of a row. Put DropdownMenuItems inside. */
export function RowActions({ label, children, extra }: { label: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <TableCell className="w-12 pr-3 text-right" data-row-ignore>
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
    </TableCell>
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
