"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  FileSignatureIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
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
import { toggleContractTemplate } from "@/lib/contract-actions";
import { ContractTemplateSheet, type ContractTemplateValues } from "./contract-template-sheet";

export type ContractTemplateRow = ContractTemplateValues & { id: string; active: boolean; uses: number };

export function ContractTemplatesTable({ rows }: { rows: ContractTemplateRow[] }) {
  const [editor, setEditor] = useState<{ item: ContractTemplateRow | null } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [toggling, setToggling] = useState("");
  const toggle = (templateId: string) =>
    setTimeout(() => {
      flushSync(() => setToggling(templateId));
      formRef.current?.requestSubmit();
    }, 0);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditor({ item: null })}>
          <PlusIcon />
          Novo modelo
        </Button>
      </div>
      {rows.length ? (
        <ul className="divide-y rounded-xl border bg-card shadow-card">
          {rows.map((row) => (
            <li key={row.id} className={cn("flex items-center gap-3 px-3 py-2.5", !row.active && "opacity-60")}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
                <FileSignatureIcon />
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
                  {row.description || "Sem descrição"}
                  {` · ${row.uses} ${row.uses === 1 ? "contrato" : "contratos"}`}
                </p>
              </div>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Ações de ${row.name}`}>
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => setTimeout(() => setEditor({ item: row }), 0)}>
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
            icon={<FileSignatureIcon />}
            title="Nenhum modelo ainda"
            description="Cole o texto dos seus contratos uma vez, com os campos do cliente entre chaves, e gere cada contrato a partir daqui."
            action={
              <Button onClick={() => setEditor({ item: null })}>
                <PlusIcon />
                Novo modelo
              </Button>
            }
          />
        </section>
      )}
      <ContractTemplateSheet
        open={editor !== null}
        onOpenChange={(open) => !open && setEditor(null)}
        template={editor?.item ?? null}
      />
      <ServerForm ref={formRef} action={toggleContractTemplate}>
        <input type="hidden" name="id" value={toggling} />
      </ServerForm>
    </>
  );
}
