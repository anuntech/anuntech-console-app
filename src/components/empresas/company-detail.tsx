"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronRightIcon,
  FoldersIcon,
  HeadsetIcon,
  Layers3Icon,
  LogInIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PageHeader,
  SectionTitle,
  EmptyState,
} from "@/components/console/page-header";
import { Fact } from "@/components/console/fact";
import {
  ConfirmAction,
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { CompanySheet } from "./company-sheet";
import { companyInitials, StatusDot } from "./companies-table";
import type { CompanyFormValues } from "./company-form";
import { formatDocument, formatPhone } from "@/lib/company-input";
import { addressLabel } from "@/lib/company-billing";
import { auditLabels, currency, dateLabel, roleLabels } from "@/lib/format";
import {
  revokeMembership,
  saveMembership,
  setCompanyArchived,
} from "@/lib/actions";
import { sendAccessNotice } from "@/lib/email-actions";
import { startAssistedSession } from "@/lib/assisted-actions";

export type CompanyDetailData = {
  company: CompanyFormValues & {
    id: string;
    archived: boolean;
    createdAt: string;
  };
  members: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    verified: boolean;
  }[];
  events: { id: string; action: string; createdAt: string }[];
  relations: {
    openTickets: number;
    openInvoices: number;
    openInvoicesCents: number;
    contracts: number;
    engagements: number;
  };
  links: {
    tickets: string;
    invoices: string;
    contracts: string;
    engagements: string;
  };
};

function RelationRow({
  href,
  icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground [&_svg]:size-4 group-hover:text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        {hint && (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <ChevronRightIcon className="size-4 text-muted-foreground/60 group-hover:text-primary" />
    </Link>
  );
}

function GrantAccessDialog({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon />
        Liberar acesso
      </Button>
      <DialogContent className="sm:max-w-md">
        <ServerForm
          action={saveMembership}
          onSuccess={() => setOpen(false)}
          className="flex flex-col gap-5"
        >
          <input type="hidden" name="companyId" value={companyId} />
          <DialogHeader>
            <DialogTitle>Liberar acesso</DialogTitle>
            <DialogDescription>
              A pessoa entra com esse e-mail (código ou Google) e recebe um
              convite. Vale só para {companyName}.
            </DialogDescription>
          </DialogHeader>
          <FormError />
          <div className="grid gap-4">
            <div>
              <Label htmlFor="grant-email" className="mb-1.5">
                E-mail
              </Label>
              <Input
                id="grant-email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                placeholder="nome@empresa.com.br"
              />
            </div>
            <div>
              <Label htmlFor="grant-role" className="mb-1.5">
                Permissão
              </Label>
              <Select name="role" defaultValue="member">
                <SelectTrigger id="grant-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    Membro — chamados, bookmarks e projetos
                  </SelectItem>
                  <SelectItem value="manager">
                    Administrador — tudo, inclusive financeiro
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <SubmitButton pendingLabel="Liberando…">
              Liberar acesso
            </SubmitButton>
          </DialogFooter>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}

function MemberMenu({
  member,
  companyName,
}: {
  member: CompanyDetailData["members"][number];
  companyName: string;
}) {
  const [confirm, setConfirm] = useState<null | "notice" | "revoke">(null);
  const ask = (which: "notice" | "revoke") =>
    setTimeout(() => setConfirm(which), 0);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Ações de ${member.email}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => ask("notice")}>
            <MailIcon />
            Enviar aviso de acesso
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => ask("revoke")}
          >
            <ShieldCheckIcon />
            Revogar acesso
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm === "notice"}
        onOpenChange={(open) => !open && setConfirm(null)}
        action={sendAccessNotice}
        fields={{ id: member.id }}
        title="Enviar aviso de acesso?"
        description={`${member.email} recebe um e-mail explicando como entrar em ${companyName}.`}
        confirmLabel="Enviar aviso"
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        onOpenChange={(open) => !open && setConfirm(null)}
        action={revokeMembership}
        fields={{ id: member.id }}
        title="Revogar este acesso?"
        description={`${member.email} perde o acesso a ${companyName}. Os registros da empresa são preservados.`}
        confirmLabel="Revogar"
        destructive
      />
    </>
  );
}

export function CompanyDetail({
  data,
  editorOpen = false,
}: {
  data: CompanyDetailData;
  editorOpen?: boolean;
}) {
  const { company, members, events, relations, links } = data;
  const router = useRouter();
  const pathname = usePathname();
  // `?editar=1` deep-links into the sheet; the page remounts per company, so
  // the initial value is all that matters.
  const [editing, setEditing] = useState(editorOpen);
  const [confirm, setConfirm] = useState<null | "assist" | "archive">(null);
  const closeEditor = (open: boolean) => {
    setEditing(open);
    if (!open && editorOpen) router.replace(pathname, { scroll: false });
  };
  const ask = (which: "assist" | "archive") =>
    setTimeout(() => setConfirm(which), 0);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Empresas", href: "/empresas" },
          { label: company.name },
        ]}
        leading={
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-primary">
            {companyInitials(company.name)}
          </span>
        }
        title={company.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tabular-nums">
              {formatDocument(company.document)}
            </span>
            <span aria-hidden="true">·</span>
            <StatusDot archived={company.archived} />
            <span aria-hidden="true">·</span>
            <span>Cliente desde {dateLabel(company.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem asChild>
                  <Link href={`/chamados/novo?companyId=${company.id}`}>
                    <HeadsetIcon />
                    Abrir chamado
                  </Link>
                </DropdownMenuItem>
                {!company.archived && (
                  <DropdownMenuItem onSelect={() => ask("assist")}>
                    <LogInIcon />
                    Entrar como esta empresa
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/financeiro/nova?companyId=${company.id}`}>
                    <ReceiptTextIcon />
                    Nova cobrança
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/contratos/novo?companyId=${company.id}`}>
                    <FoldersIcon />
                    Novo contrato
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant={company.archived ? "default" : "destructive"}
                  onSelect={() => ask("archive")}
                >
                  {company.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                  {company.archived ? "Restaurar cliente" : "Arquivar cliente"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {company.archived && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-edge bg-warning-soft px-4 py-3 text-sm text-warning">
          <span>
            Cliente arquivado. Ele não aparece na lista de ativos, mas
            histórico, acessos e cobranças continuam aqui.
          </span>
          <ConfirmAction
            action={setCompanyArchived}
            fields={{ id: company.id, archived: "no" }}
            title="Restaurar cliente?"
            description={`${company.name} volta para a lista de clientes ativos.`}
            confirmLabel="Restaurar"
          >
            <Button size="sm" variant="outline">
              <ArchiveRestoreIcon />
              Restaurar
            </Button>
          </ConfirmAction>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle
                title="Cadastro"
                description="Dados usados em cobranças, contratos e notas fiscais."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(true)}
                  >
                    <PencilIcon />
                    Editar
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <Fact label="Razão social">{company.name}</Fact>
                <Fact label="CNPJ">
                  <span className="tabular-nums">
                    {formatDocument(company.document)}
                  </span>
                </Fact>
                <Fact label="E-mail financeiro">{company.billingEmail}</Fact>
                <Fact label="Telefone">
                  {company.phone ? (
                    formatPhone(company.phone)
                  ) : (
                    <span className="text-muted-foreground">Não informado</span>
                  )}
                </Fact>
                <Fact label="Endereço de cobrança" className="sm:col-span-2">
                  {company.billingAddress ? (
                    addressLabel(company.billingAddress)
                  ) : (
                    <span className="text-muted-foreground">
                      Ainda não cadastrado — necessário para emitir cobranças e
                      notas.
                    </span>
                  )}
                </Fact>
                <Fact label="Nota fiscal automática">
                  {company.autoIssueNfse ? (
                    <Badge variant="secondary">Ativada</Badge>
                  ) : (
                    <span className="text-muted-foreground">Desativada</span>
                  )}
                </Fact>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle
                title={
                  <span className="flex items-center gap-2">
                    Pessoas com acesso
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground">
                      {members.length}
                    </span>
                  </span>
                }
                description="Quem entra no Console em nome desta empresa."
                action={
                  <GrantAccessDialog
                    companyId={company.id}
                    companyName={company.name}
                  />
                }
              />
            </CardHeader>
            <CardContent className="px-0">
              {members.length ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Pessoa</TableHead>
                      <TableHead>Permissão</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="w-12 pr-4">
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="pl-6">
                          <span className="flex items-center gap-3">
                            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                              <UserRoundIcon className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {member.name || member.email}
                              </span>
                              {member.name && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {member.email}
                                </span>
                              )}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              member.role === "manager"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {roleLabels[member.role] || member.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {member.verified
                            ? "Ativo"
                            : "Aguardando primeiro acesso"}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <MemberMenu
                            member={member}
                            companyName={company.name}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={<UserRoundIcon />}
                  title="Ninguém tem acesso ainda"
                  description="Libere o e-mail que o cliente usa para entrar. Ele recebe um convite automaticamente."
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle
                title="Histórico"
                description="Últimas alterações registradas neste cadastro."
              />
            </CardHeader>
            <CardContent>
              {events.length ? (
                <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
                  {events.map((event) => (
                    <li key={event.id} className="relative text-sm">
                      <span
                        aria-hidden="true"
                        className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-primary/70"
                      />
                      <span className="block text-foreground">
                        {auditLabels[event.action] || "Registro atualizado"}
                      </span>
                      <time
                        dateTime={event.createdAt}
                        className="text-xs text-muted-foreground"
                      >
                        {dateLabel(event.createdAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma alteração registrada.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle
                title="Relacionamento"
                description="O que está em andamento com este cliente."
              />
            </CardHeader>
            <CardContent className="flex flex-col">
              <RelationRow
                href={links.tickets}
                icon={<HeadsetIcon />}
                label="Chamados abertos"
                value={relations.openTickets}
              />
              <RelationRow
                href={links.invoices}
                icon={<ReceiptTextIcon />}
                label="Faturas em aberto"
                hint={
                  relations.openInvoices
                    ? currency(relations.openInvoicesCents)
                    : undefined
                }
                value={relations.openInvoices}
              />
              <RelationRow
                href={links.contracts}
                icon={<FoldersIcon />}
                label="Contratos"
                value={relations.contracts}
              />
              <RelationRow
                href={links.engagements}
                icon={<Layers3Icon />}
                label="Produtos e projetos"
                value={relations.engagements}
              />
            </CardContent>
          </Card>
        </aside>
      </div>

      <CompanySheet
        open={editing}
        onOpenChange={closeEditor}
        company={company}
        companyId={company.id}
      />
      <ConfirmDialog
        open={confirm === "assist"}
        onOpenChange={(open) => !open && setConfirm(null)}
        action={startAssistedSession}
        fields={{ companyId: company.id }}
        title="Entrar como esta empresa?"
        description={`Você passa a ver e usar o Console exatamente como ${company.name}, com acesso completo. Suas telas de administrador ficam ocultas até você sair do modo assistido.`}
        confirmLabel="Entrar como esta empresa"
      />
      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(open) => !open && setConfirm(null)}
        action={setCompanyArchived}
        fields={{ id: company.id, archived: company.archived ? "no" : "yes" }}
        title={company.archived ? "Restaurar cliente?" : "Arquivar cliente?"}
        description={
          company.archived
            ? `${company.name} volta para a lista de clientes ativos.`
            : `${company.name} sai da lista de ativos. Histórico, acessos e cobranças são preservados e você pode restaurar depois.`
        }
        confirmLabel={company.archived ? "Restaurar" : "Arquivar"}
        destructive={!company.archived}
      />
    </>
  );
}
