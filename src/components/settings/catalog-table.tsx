"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/console/page-header";
import { LinkRow, ListCard, PrimaryCell, RowActions } from "@/components/console/list-view";
import { ProductIcon } from "@/components/console/product-icon";
import { ServerForm } from "@/components/console/server-form";
import { toggleCatalogItem } from "@/lib/catalog/catalog-actions";
import { catalogIconSrc } from "@/lib/catalog/catalog-icons";
import { currency } from "@/lib/format";
import { CatalogSheet, type CatalogItemValues } from "./catalog-sheet";

export type CatalogRow = CatalogItemValues & { id: string; active: boolean };

const intervalLabel = { monthly: "por mês", yearly: "por ano" } as const;

const pill = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** Situation of a record that can be switched off (catalog items, contract templates). */
export function ActiveStatus({ active }: { active: boolean }) {
  return (
    <span className={cn(pill, active ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground")}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground/50")} />
      {active ? "Ativo" : "Desativado"}
    </span>
  );
}

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

/** The catalog as the standard list table, with a sheet for editing. */
export function CatalogTable({ rows, iconAi = false }: { rows: CatalogRow[]; iconAi?: boolean }) {
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
  const edit = (item: CatalogRow) => setEditor({ open: true, item });
  return (
    <>
      <ListCard label="Itens do catálogo">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Item</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="hidden text-right md:table-cell">Valor</TableHead>
                <TableHead className="w-12 pr-3">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <LinkRow key={row.id} onOpen={() => edit(row)}>
                  <PrimaryCell
                    onOpen={() => edit(row)}
                    title={row.name}
                    subtitle={[
                      row.kind === "product" ? "Produto" : "Serviço",
                      row.kind === "product" && row.url ? row.url.replace(/^https?:\/\//, "") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    leading={<ProductIcon src={catalogIconSrc(row.id, row.icon)} name={row.name} size={32} />}
                  />
                  <TableCell>
                    <ActiveStatus active={row.active} />
                  </TableCell>
                  <TableCell className="hidden text-right whitespace-nowrap tabular-nums md:table-cell">
                    {row.defaultAmountCents != null ? (
                      <>
                        <span className="text-foreground">{currency(row.defaultAmountCents)}</span>
                        {row.interval && (
                          <span className="text-muted-foreground"> {intervalLabel[row.interval]}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <RowActions label={row.name}>
                    <DropdownMenuItem onSelect={() => later(() => edit(row))}>
                      <PencilIcon />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => toggle(row.id)}>
                      {row.active ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
                      {row.active ? "Desativar" : "Reativar"}
                    </DropdownMenuItem>
                  </RowActions>
                </LinkRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<PackageIcon />}
            title="Catálogo vazio"
            description="Cadastre produtos e serviços uma vez; depois é só vincular a cada cliente com o preço dele."
            action={<NewCatalogItemButton />}
          />
        )}
      </ListCard>
      <CatalogSheet
        open={editor.open}
        onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
        item={editor.item}
        iconAi={iconAi}
      />
      <ServerForm ref={formRef} action={toggleCatalogItem}>
        <input type="hidden" name="id" value={toggling} />
      </ServerForm>
    </>
  );
}
