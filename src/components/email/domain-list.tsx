"use client";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { ForwardIcon, GlobeIcon, InboxIcon, LinkIcon, TriangleAlertIcon, UnlinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CompanyField, type CompanyOption } from "@/components/console/company-field";
import { FormField } from "@/components/console/form-field";
import { FormSheet } from "@/components/console/form-sheet";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { LinkRow, ListCard, PrimaryCell, RowActions } from "@/components/console/list-view";
import { InCardScope } from "@/components/console/list-grid";
import { linkMailDomain, unlinkMailDomain } from "@/lib/mail/mail-actions";
import type { DomainRow } from "@/lib/mail/mail-types";

export type DomainListRow = DomainRow & { mailboxes: number };

const at = (path: string, domain: string) => `${path}?dominio=${encodeURIComponent(domain)}`;
const boxes = (count: number) => (count === 1 ? "1 caixa" : `${count} caixas`);

function OffServer() {
  return (
    <Badge variant="secondary" title="O vínculo existe, mas o servidor de e-mail não tem mais esse domínio.">
      <TriangleAlertIcon />
      Fora do servidor
    </Badge>
  );
}

function DomainMenu({ row, unlink }: { row: DomainListRow; unlink: (row: DomainListRow) => void }) {
  return (
    <RowActions label={row.domain}>
      <DropdownMenuItem asChild>
        <Link href={at("/email", row.domain)}>
          <InboxIcon />
          Caixas
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={at("/email/redirecionamentos", row.domain)}>
          <ForwardIcon />
          Redirecionamentos
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={at("/email/dns", row.domain)}>
          <GlobeIcon />
          Saúde do DNS
        </Link>
      </DropdownMenuItem>
      {row.linkId && (
        <>
          <DropdownMenuSeparator />
          {/* The dialog opens after the menu has closed, so focus lands in it. */}
          <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => unlink(row), 0)}>
            <UnlinkIcon />
            Desvincular
          </DropdownMenuItem>
        </>
      )}
    </RowActions>
  );
}

/** "Vincular domínio": a domain the server already has, handed to a client. */
export function LinkDomainButton({ companies, linkable }: { companies: CompanyOption[]; linkable: string[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <Button onClick={() => setOpen(true)} data-assistant-action="">
        <LinkIcon />
        Vincular domínio
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        size="md"
        title="Vincular domínio"
        description="Depois de vinculado, as caixas, os redirecionamentos e o DNS do domínio são gerenciados aqui. Nada muda no servidor."
        action={linkMailDomain}
        formKey={open ? "open" : "closed"}
        submitLabel="Vincular domínio"
        pendingLabel="Vinculando…"
      >
        <FormField label="Empresa" htmlFor={`${id}-company`}>
          <CompanyField id={`${id}-company`} name="companyId" companies={companies} required />
        </FormField>
        <FormField
          label="Domínio"
          htmlFor={`${id}-domain`}
          hint={
            linkable.length
              ? "Os domínios que já estão no servidor de e-mail e ainda não são de ninguém."
              : "Todos os domínios do servidor já estão vinculados. Um domínio novo precisa ser criado no servidor antes."
          }
        >
          <NativeSelect id={`${id}-domain`} name="domain" required defaultValue="" disabled={!linkable.length}>
            <NativeSelectOption value="" disabled>
              Selecione o domínio
            </NativeSelectOption>
            {linkable.map((domain) => (
              <NativeSelectOption key={domain} value={domain}>
                {domain}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
      </FormSheet>
    </>
  );
}

function UnlinkDomainDialog({ open, row, onOpenChange }: { open: boolean; row: DomainListRow | null; onOpenChange: (open: boolean) => void }) {
  const [typed, setTyped] = useState("");
  const id = useId();
  const matches = !!row && typed.trim().toLowerCase() === row.domain;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setTyped("");
      }}
    >
      <AlertDialogContent>
        <ServerForm action={unlinkMailDomain} data-assistant-ignore="" onSuccess={() => onOpenChange(false)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular {row?.domain}?</AlertDialogTitle>
            <AlertDialogDescription>
              {row ? `O domínio deixa de ser de ${row.companyName} no Console. ` : ""}
              As caixas e os e-mails continuam no servidor, funcionando, mas saem do Console até alguém vincular de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4 grid gap-4">
            <FormError />
            {row?.linkId && <input type="hidden" name="id" value={row.linkId} />}
            <FormField label={`Para confirmar, digite ${row?.domain ?? "o domínio"}`} htmlFor={`${id}-confirm`}>
              <Input
                id={`${id}-confirm`}
                name="confirm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </FormField>
          </div>
          <AlertDialogFooter className="mt-5">
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <SubmitButton variant="destructive" pendingLabel="Desvinculando…" disabled={!matches}>
              Desvincular
            </SubmitButton>
          </AlertDialogFooter>
        </ServerForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The managed domains: a table from the tablet up, cards on the phone. */
export function DomainList({ rows, actions }: { rows: DomainListRow[]; actions: ReactNode }) {
  // The row stays set while the dialog fades out, so its text doesn't blank.
  const [unlinking, setUnlinking] = useState<{ open: boolean; row: DomainListRow | null }>({ open: false, row: null });
  const unlink = (row: DomainListRow) => setUnlinking({ open: true, row });
  return (
    <>
      <ListCard label="Domínios de e-mail" actions={actions}>
        <Table className="max-md:hidden">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Domínio</TableHead>
              <TableHead className="w-32">Caixas</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <LinkRow key={row.domain} href={at("/email", row.domain)}>
                <PrimaryCell
                  href={at("/email", row.domain)}
                  title={row.domain}
                  subtitle={row.onServer ? row.companyName : <OffServer />}
                  leading={
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-4">
                      <GlobeIcon />
                    </span>
                  }
                />
                <TableCell className="w-32 text-sm text-muted-foreground tabular-nums">{boxes(row.mailboxes)}</TableCell>
                <DomainMenu row={row} unlink={unlink} />
              </LinkRow>
            ))}
          </TableBody>
        </Table>
        <ul className="divide-y md:hidden" aria-label="Domínios">
          {rows.map((row) => (
            <li key={row.domain} className="flex min-w-0 items-start gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <Link href={at("/email", row.domain)} className="block truncate font-medium text-foreground">
                  {row.domain}
                </Link>
                <span className="block truncate text-xs text-muted-foreground">{row.companyName}</span>
                {!row.onServer && <OffServer />}
                <p className="mt-1 text-xs text-muted-foreground">{boxes(row.mailboxes)}</p>
              </div>
              <div className="-mr-1 shrink-0">
                <InCardScope>
                  <DomainMenu row={row} unlink={unlink} />
                </InCardScope>
              </div>
            </li>
          ))}
        </ul>
      </ListCard>
      <UnlinkDomainDialog open={unlinking.open} row={unlinking.row} onOpenChange={(open) => setUnlinking((current) => ({ ...current, open }))} />
    </>
  );
}
