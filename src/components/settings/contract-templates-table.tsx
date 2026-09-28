"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  FileSignatureIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
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
import { ServerForm } from "@/components/console/server-form";
import { toggleContractTemplate } from "@/lib/contracts/contract-actions";
import { ActiveStatus } from "./catalog-table";
import { ContractTemplateSheet, type ContractTemplateValues } from "./contract-template-sheet";

export type ContractTemplateRow = ContractTemplateValues & { id: string; active: boolean; uses: number };

/** Creates a contract template; the page header and the empty state show it. */
export function NewContractTemplateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Novo modelo
      </Button>
      <ContractTemplateSheet open={open} onOpenChange={setOpen} template={null} />
    </>
  );
}

/** The model contracts as the standard list table, with a sheet for editing. */
export function ContractTemplatesTable({ rows }: { rows: ContractTemplateRow[] }) {
  // The template stays set while the sheet slides out, so its fields don't blank.
  const [editor, setEditor] = useState<{ open: boolean; item: ContractTemplateRow | null }>({
    open: false,
    item: null,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const [toggling, setToggling] = useState("");
  const toggle = (templateId: string) =>
    setTimeout(() => {
      flushSync(() => setToggling(templateId));
      formRef.current?.requestSubmit();
    }, 0);
  const edit = (item: ContractTemplateRow) => setEditor({ open: true, item });
  return (
    <>
      <ListCard label="Modelos de contrato">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Modelo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="hidden text-right md:table-cell">Contratos</TableHead>
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
                    subtitle={row.description || "Sem descrição"}
                    leading={
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
                        <FileSignatureIcon />
                      </span>
                    }
                  />
                  <TableCell>
                    <ActiveStatus active={row.active} />
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{row.uses}</TableCell>
                  <RowActions label={row.name}>
                    <DropdownMenuItem onSelect={() => setTimeout(() => edit(row), 0)}>
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
            icon={<FileSignatureIcon />}
            title="Nenhum modelo ainda"
            description="Cole o texto dos seus contratos uma vez, com os campos do cliente entre chaves, e gere cada contrato a partir daqui."
            action={<NewContractTemplateButton />}
          />
        )}
      </ListCard>
      <ContractTemplateSheet
        open={editor.open}
        onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
        template={editor.item}
      />
      <ServerForm ref={formRef} action={toggleContractTemplate}>
        <input type="hidden" name="id" value={toggling} />
      </ServerForm>
    </>
  );
}
