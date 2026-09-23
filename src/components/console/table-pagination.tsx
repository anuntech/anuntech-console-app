"use client";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The footer every list shares: page size, range summary, previous/next. */
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
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
      <label className="flex items-center gap-2">
        Por página
        <Select
          value={String(pageSize)}
          onValueChange={(size) => onPageSizeChange(Number(size))}
        >
          <SelectTrigger size="sm" className="h-7 w-[72px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <span aria-live="polite" className="tabular-nums">
        {total
          ? `${from}–${to} de ${total} ${total === 1 ? noun[0] : noun[1]}`
          : `0 ${noun[1]}`}
      </span>
      <nav aria-label="Paginação" className="flex items-center gap-1">
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
