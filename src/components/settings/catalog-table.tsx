"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MoreHorizontalIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  WrenchIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/console/page-header";
import { ServerForm } from "@/components/console/server-form";
import { toggleCatalogItem } from "@/lib/catalog-actions";
import { currency } from "@/lib/format";
import { CatalogSheet, type CatalogItemValues } from "./catalog-sheet";

export type CatalogRow = CatalogItemValues & { id: string; active: boolean };

const intervalLabel = { monthly: "por mês", yearly: "por ano" } as const;

/** The catalog as a compact list, with a sheet for creating and editing. */
export function CatalogTable({ rows }: { rows: CatalogRow[] }) {
  const [editor, setEditor] = useState<{ open: true; item: CatalogRow | null } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [toggling, setToggling] = useState("");
  const toggle = (itemId: string) =>
    setTimeout(() => {
      flushSync(() => setToggling(itemId));
      formRef.current?.requestSubmit();
    }, 0);
  const later = (fn: () => void) => setTimeout(fn, 0);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditor({ open: true, item: null })}>
          <PlusIcon />
          Novo item
        </Button>
      </div>
      {rows.length ? (
        <ul className="divide-y rounded-xl border bg-card shadow-card">
          {rows.map((row) => (
            <li
              key={row.id}
              className={cn("flex items-center gap-3 px-3 py-2.5", !row.active && "opacity-60")}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
                {row.kind === "product" ? <PackageIcon /> : <WrenchIcon />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {row.name}
                  {!row.active && (
                    <span className="ml-2 rounded-full bg-secondary px-1.5 py-px text-[11px] font-medium text-muted-foreground">
                      Desativado
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.kind === "product" ? "Produto" : "Serviço"}
                  {row.defaultAmountCents != null &&
                    ` · ${currency(row.defaultAmountCents)}${row.interval ? ` ${intervalLabel[row.interval]}` : ""}`}
                  {row.kind === "product" && row.url && ` · ${row.url.replace(/^https?:\/\//, "")}`}
                </p>
              </div>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    aria-label={`Ações de ${row.name}`}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => later(() => setEditor({ open: true, item: row }))}>
                    <PencilIcon />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => toggle(row.id)}>
                    {row.active ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
                    {row.active ? "Desativar" : "Reativar"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      ) : (
        <section className="rounded-xl border bg-card shadow-card">
          <EmptyState
            icon={<PackageIcon />}
            title="Catálogo vazio"
            description="Cadastre produtos e serviços uma vez; depois é só vincular a cada cliente com o preço dele."
            action={
              <Button onClick={() => setEditor({ open: true, item: null })}>
                <PlusIcon />
                Novo item
              </Button>
            }
          />
        </section>
      )}
      <CatalogSheet
        open={editor !== null}
        onOpenChange={(open) => !open && setEditor(null)}
        item={editor?.item ?? null}
      />
      <ServerForm ref={formRef} action={toggleCatalogItem}>
        <input type="hidden" name="id" value={toggling} />
      </ServerForm>
    </>
  );
}
