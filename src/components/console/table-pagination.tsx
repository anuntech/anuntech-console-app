"use client";
import { useId } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES } from "@/lib/list-query";

/**
 * The footer every list shares: page size, range summary, previous/next.
 *
 * On a phone the three parts don't fit one line, so the range summary takes
 * its own line on top and the size picker and the arrows share the line
 * below, one at each edge; from `sm` up everything sits on one line.
 */
export function TablePagination({
  page,
  pageCount,
  pageSize,
  total,
  noun,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  /** Singular and plural, e.g. ["empresa", "empresas"]. */
  noun: [string, string];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const labelId = useId();
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-2 whitespace-nowrap">
        {/* A <label> around a Radix trigger would forward its clicks to the
            button; naming the trigger by the visible text is enough. */}
        <span id={labelId}>Por página</span>
        <Select
          value={String(pageSize)}
          onValueChange={(size) => onPageSizeChange(Number(size))}
        >
          <SelectTrigger
            size="sm"
            aria-labelledby={labelId}
            className="h-7 w-[72px] tabular-nums"
          >
            <SelectValue>{pageSize}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span
        aria-live="polite"
        className="order-first basis-full tabular-nums sm:order-none sm:basis-auto"
      >
        {total
          ? `${from}–${to} de ${total} ${total === 1 ? noun[0] : noun[1]}`
          : `0 ${noun[1]}`}
      </span>
      <nav aria-label="Paginação" className="flex items-center gap-1 whitespace-nowrap">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="px-2 tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Próxima página"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </nav>
    </div>
  );
}
