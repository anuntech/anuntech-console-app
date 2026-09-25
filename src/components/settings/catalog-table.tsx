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

/** Creates a catalog item; the page header and the empty state show it. */
export function NewCatalogItemButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Novo item
      </Button>
      <CatalogSheet open={open} onOpenChange={setOpen} item={null} />
    </>
  );
}

/** The catalog as a compact list, with a sheet for editing. */
export function CatalogTable({ rows }: { rows: CatalogRow[] }) {
  // The item stays set while the sheet slides out, so its fields don't blank.
  const [editor, setEditor] = useState<{ open: boolean; item: CatalogRow | null }>({ open: false, item: null });
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
            action={<NewCatalogItemButton />}
          />
        </section>
      )}
      <CatalogSheet
        open={editor.open}
        onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
        item={editor.item}
      />
      <ServerForm ref={formRef} action={toggleCatalogItem}>
        <input type="hidden" name="id" value={toggling} />
      </ServerForm>
    </>
  );
}
