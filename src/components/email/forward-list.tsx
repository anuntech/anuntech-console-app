"use client";
import { useId, useState, type ReactNode } from "react";
import { ForwardIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/console/page-header";
import { FormField } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { InCardScope } from "@/components/console/list-grid";
import { LinkRow, ListCard, PrimaryCell, RowActions } from "@/components/console/list-view";
import { ConfirmDialog } from "@/components/console/server-form";
import { createForward, deleteForward, updateForward } from "@/lib/mail/mail-actions";
import { FORWARD_RECIPIENTS_MAX } from "@/lib/mail/mail-rules";
import type { ForwardRow } from "@/lib/mail/mail-types";
import { AddressInput } from "./mailbox-sheets";

/** A forward: an address of the domain that hands each message to one or more destinations. */
export function ForwardSheet({
  open,
  onOpenChange,
  forward,
  domain,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forward: ForwardRow | null;
  domain: string;
}) {
  const id = useId();
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={forward ? `Editar ${forward.address}` : "Novo redirecionamento"}
      description="O que chega no endereço vai para os destinos. Nada fica guardado numa caixa."
      action={forward ? updateForward : createForward}
      formKey={forward?.id ?? (open ? "new" : "closed")}
      submitLabel={forward ? "Salvar" : "Criar redirecionamento"}
      pendingLabel={forward ? "Salvando…" : "Criando…"}
    >
      {forward ? <input type="hidden" name="id" value={forward.id} /> : <input type="hidden" name="domain" value={domain} />}
      {!forward && (
        <FormField label="Endereço" htmlFor={`${id}-local`} hint="O endereço que as pessoas vão usar.">
          <AddressInput id={`${id}-local`} domain={domain} />
        </FormField>
      )}
      <FormField label="Descrição" htmlFor={`${id}-name`} hint="Para a equipe saber para que serve.">
        <Input id={`${id}-name`} name="name" maxLength={120} defaultValue={forward?.name ?? ""} placeholder="Ex.: Contato do Alessandro" />
      </FormField>
      <FormField
        label="Destinos"
        htmlFor={`${id}-recipients`}
        hint={`Um endereço por linha, de fora (Gmail, Outlook) ou de uma caixa do domínio. Até ${FORWARD_RECIPIENTS_MAX}.`}
      >
        <Textarea
          id={`${id}-recipients`}
          name="recipients"
          required
          rows={4}
          maxLength={6000}
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={forward?.recipients.join("\n") ?? ""}
          placeholder={"fulano@gmail.com"}
        />
      </FormField>
    </FormSheet>
  );
}

export function NewForwardButton({ domain }: { domain: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} data-assistant-action="">
        <PlusIcon />
        Novo redirecionamento
      </Button>
      <ForwardSheet open={open} onOpenChange={setOpen} forward={null} domain={domain} />
    </>
  );
}

function ForwardMenu({ row, edit, remove }: { row: ForwardRow; edit: () => void; remove: () => void }) {
  return (
    <RowActions label={row.address}>
      <DropdownMenuItem onSelect={() => setTimeout(edit, 0)}>
        <PencilIcon />
        Editar
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(remove, 0)}>
        <Trash2Icon />
        Excluir
      </DropdownMenuItem>
    </RowActions>
  );
}

export function ForwardList({ rows, domain, actions }: { rows: ForwardRow[]; domain: string; actions: ReactNode }) {
  const [editor, setEditor] = useState<{ open: boolean; row: ForwardRow | null }>({ open: false, row: null });
  const [removing, setRemoving] = useState<{ open: boolean; row: ForwardRow | null }>({ open: false, row: null });
  const edit = (row: ForwardRow) => setEditor({ open: true, row });
  const remove = (row: ForwardRow) => setRemoving({ open: true, row });
  return (
    <>
      <ListCard label="Redirecionamentos" fill empty={!rows.length} actions={actions}>
        {!rows.length ? (
          <EmptyState
            icon={<ForwardIcon />}
            title="Nenhum redirecionamento ainda"
            description="Um redirecionamento manda o que chega num endereço do domínio para outros endereços, como um Gmail."
          />
        ) : (
          <>
            <Table className="max-md:hidden">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Endereço</TableHead>
                  <TableHead>Destinos</TableHead>
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
                      title={row.address}
                      subtitle={row.name}
                      leading={
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
                          <ForwardIcon />
                        </span>
                      }
                    />
                    <TableCell className="max-w-[24rem]">
                      <span className="block text-sm break-words text-foreground">{row.recipients.join(", ")}</span>
                    </TableCell>
                    <ForwardMenu row={row} edit={() => edit(row)} remove={() => remove(row)} />
                  </LinkRow>
                ))}
              </TableBody>
            </Table>
            <ul className="divide-y md:hidden" aria-label="Redirecionamentos">
              {rows.map((row) => (
                <li key={row.id} className="flex min-w-0 items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => edit(row)} className="block max-w-full text-left">
                      <span className="block truncate font-medium text-foreground">{row.address}</span>
                    </button>
                    {row.name && <span className="block truncate text-xs text-muted-foreground">{row.name}</span>}
                    <p className="mt-1.5 text-xs break-words text-muted-foreground">Para: {row.recipients.join(", ")}</p>
                  </div>
                  <div className="-mr-1 shrink-0">
                    <InCardScope>
                      <ForwardMenu row={row} edit={() => edit(row)} remove={() => remove(row)} />
                    </InCardScope>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </ListCard>
      <ForwardSheet
        open={editor.open}
        onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
        forward={editor.row}
        domain={domain}
      />
      <ConfirmDialog
        open={removing.open}
        onOpenChange={(open) => setRemoving((current) => ({ ...current, open }))}
        action={deleteForward}
        fields={{ id: removing.row?.id ?? "" }}
        title={`Excluir ${removing.row?.address ?? "o redirecionamento"}?`}
        description="O que chegar nesse endereço volta para quem enviou, com aviso de endereço inexistente. As mensagens já entregues continuam nos destinos."
        confirmLabel="Excluir"
        destructive
      />
    </>
  );
}
