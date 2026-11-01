"use client";
import { useMemo, useState, type ReactNode } from "react";
import { KeyRoundIcon, MailIcon, PencilIcon, ShieldIcon, SmartphoneIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/console/page-header";
import { LinkRow, ListCard, PrimaryCell, RowActions } from "@/components/console/list-view";
import { SearchField } from "@/components/console/search-field";
import { InCardScope } from "@/components/console/list-grid";
import { dateLabel } from "@/lib/format";
import type { MailboxRow } from "@/lib/mail/mail-types";
import { QuotaBar } from "./mail-pieces";
import { DeleteMailboxDialog, DevicesSheet, EditMailboxSheet, PasswordSheet } from "./mailbox-sheets";

type Panel = "edit" | "password" | "devices" | "delete";

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** The address, its name or an alias: the list is short, so the search runs here, and the URL keeps it. */
function matches(row: MailboxRow, query: string) {
  const q = fold(query.trim());
  if (!q) return true;
  return [row.address, row.name ?? "", ...row.aliases.map((a) => `${a}@${row.domain}`)].some((value) => fold(value).includes(q));
}

/** `manages` false: a Membro's own mailbox, with the password and the devices only. */
function MailboxMenu({ row, open, manages }: { row: MailboxRow; open: (panel: Panel, row: MailboxRow) => void; manages: boolean }) {
  // Menu items open their panel after the menu has closed, so focus lands in the panel.
  const later = (panel: Panel) => () => setTimeout(() => open(panel, row), 0);
  return (
    <RowActions label={row.address}>
      {manages && (
        <DropdownMenuItem onSelect={later("edit")}>
          <PencilIcon />
          Editar
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onSelect={later("password")}>
        <KeyRoundIcon />
        Trocar senha
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={later("devices")}>
        <SmartphoneIcon />
        Configurar aparelhos
      </DropdownMenuItem>
      {manages && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={later("delete")}>
            <Trash2Icon />
            Excluir caixa
          </DropdownMenuItem>
        </>
      )}
    </RowActions>
  );
}

function Protected() {
  return (
    <Badge variant="secondary" title="Administradores e papéis próprios são gerenciados no servidor de e-mail.">
      <ShieldIcon />
      Gerenciada no servidor
    </Badge>
  );
}

/**
 * The mailboxes: a table from the tablet up, cards on the phone (no sideways
 * scroll at 320 px). `manages` false: a Membro's own mailbox, whose row
 * opens the devices' setup and whose menu has only the password besides.
 */
export function MailboxList({ rows, query: initial, actions, manages }: { rows: MailboxRow[]; query: string; actions: ReactNode; manages: boolean }) {
  const [query, setQuery] = useState(initial);
  const [panel, setPanel] = useState<{ kind: Panel | null; row: MailboxRow | null }>({ kind: null, row: null });
  const shown = useMemo(() => rows.filter((row) => matches(row, query)), [rows, query]);
  const open = (kind: Panel, row: MailboxRow) => setPanel({ kind, row });
  const main: Panel = manages ? "edit" : "devices";
  // The row stays set while a panel slides out, so its fields don't blank.
  const onOpenChange = (kind: Panel) => (next: boolean) => setPanel((current) => ({ kind: next ? kind : null, row: current.row }));
  const search = (value: string) => {
    setQuery(value);
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set("q", value.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };
  return (
    <>
      <ListCard
        label="Caixas de e-mail"
        fill
        empty={!shown.length}
        toolbar={manages && rows.length > 0 && <SearchField value={query} onChange={search} placeholder="Buscar por endereço, nome ou apelido" />}
        actions={actions}
      >
        {!rows.length ? (
          manages ? (
            <EmptyState art="projetos" title="Nenhuma caixa ainda" description="Crie a primeira caixa do domínio para entrar pelos aplicativos de e-mail." />
          ) : (
            <EmptyState
              art="projetos"
              title="Nenhuma caixa ligada a você"
              description="Sua caixa aparece aqui quando o endereço dela é um dos e-mails da sua conta. Peça ao Administrador da empresa para criar a caixa ou incluir o endereço na sua conta."
            />
          )
        ) : !shown.length ? (
          <EmptyState art="busca" title="Nenhuma caixa encontrada" description="Confira o endereço ou busque por outra parte do nome." />
        ) : (
          <>
            <Table className="max-md:hidden">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Caixa</TableHead>
                  <TableHead className="w-56">Espaço</TableHead>
                  <TableHead className="hidden lg:table-cell">Apelidos</TableHead>
                  <TableHead className="hidden w-28 xl:table-cell">Criada em</TableHead>
                  <TableHead className="w-12 pr-3">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((row) => (
                  <LinkRow key={row.id} onOpen={row.managed ? () => open(main, row) : undefined}>
                    <PrimaryCell
                      onOpen={row.managed ? () => open(main, row) : undefined}
                      title={row.address}
                      subtitle={row.managed ? row.name : <Protected />}
                      leading={
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
                          <MailIcon />
                        </span>
                      }
                    />
                    <TableCell className="w-56">
                      <QuotaBar used={row.usedBytes} quota={row.quotaBytes} />
                    </TableCell>
                    <TableCell className="hidden max-w-[16rem] lg:table-cell">
                      <span className="block truncate text-sm text-muted-foreground">{row.aliases.length ? row.aliases.join(", ") : "—"}</span>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground tabular-nums xl:table-cell">
                      {row.createdAt ? dateLabel(new Date(row.createdAt)) : "—"}
                    </TableCell>
                    {row.managed ? <MailboxMenu row={row} open={open} manages={manages} /> : <TableCell className="w-12" />}
                  </LinkRow>
                ))}
              </TableBody>
            </Table>
            <ul className="divide-y md:hidden" aria-label="Caixas">
              {shown.map((row) => (
                <li key={row.id} className="flex min-w-0 items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    {row.managed ? (
                      <button type="button" onClick={() => open(main, row)} className="block max-w-full text-left">
                        <span className="block truncate font-medium text-foreground">{row.address}</span>
                      </button>
                    ) : (
                      <span className="block truncate font-medium text-foreground">{row.address}</span>
                    )}
                    {row.name && <span className="block truncate text-xs text-muted-foreground">{row.name}</span>}
                    {!row.managed && <Protected />}
                    <QuotaBar used={row.usedBytes} quota={row.quotaBytes} className="mt-2" />
                    {row.aliases.length > 0 && (
                      <p className="mt-1.5 text-xs break-words text-muted-foreground">Apelidos: {row.aliases.join(", ")}</p>
                    )}
                    {row.createdAt && <p className="mt-1 text-xs text-muted-foreground">Criada em {dateLabel(new Date(row.createdAt))}</p>}
                  </div>
                  {row.managed && (
                    <div className="-mr-1 shrink-0">
                      <InCardScope>
                        <MailboxMenu row={row} open={open} manages={manages} />
                      </InCardScope>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </ListCard>
      {manages && <EditMailboxSheet open={panel.kind === "edit"} onOpenChange={onOpenChange("edit")} mailbox={panel.row} />}
      <PasswordSheet open={panel.kind === "password"} onOpenChange={onOpenChange("password")} mailbox={panel.row} />
      <DevicesSheet open={panel.kind === "devices"} onOpenChange={onOpenChange("devices")} mailbox={panel.row} />
      {manages && <DeleteMailboxDialog open={panel.kind === "delete"} onOpenChange={onOpenChange("delete")} mailbox={panel.row} />}
    </>
  );
}
