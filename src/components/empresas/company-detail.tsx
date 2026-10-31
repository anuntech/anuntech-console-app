"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  EyeIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  CalculatorIcon,
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
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "@/components/console/page-header";
import { Fact } from "@/components/console/fact";
import { FormField } from "@/components/console/form-field";
import {
  ConfirmAction,
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { RoleSelect } from "@/components/settings/member-actions";
import { EngagementScopeField, scopeSummary, type MemberScope, type ScopeEngagement } from "@/components/settings/member-access-fields";
import { CompanySheet } from "./company-sheet";
import { CompanyTile } from "./company-tile";
import { DeleteCompanyDialog } from "./delete-company-dialog";
import type { CompanyFormValues } from "./company-form";
import { formatDocument, formatPhone, onlyDigits } from "@/lib/companies/company-input";
import { companyDisplayName } from "@/lib/companies/display-name";
import { Disclosure } from "@/components/console/disclosure";
import { addressLabel } from "@/lib/companies/company-billing";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { auditLabels, currency, dateLabel, roleLabels } from "@/lib/format";
import {
  revokeMembership,
  saveMembership,
  setCompanyArchived,
} from "@/lib/actions";
import { sendAccessNotice } from "@/lib/access/email-actions";
import { resendInvite } from "@/lib/access/members-actions";
import { startAssistedSession } from "@/lib/access/assisted-actions";
import { canDeleteCompany, type CompanyLinks } from "@/lib/deletion-rules";

/** What is still running for a client, offered to wind down when it is archived. */
export type CompanyOffboarding = {
  recurrences: number;
  engagements: number;
  openInvoices: { n: number; cents: number };
  contracts: number;
  tickets: number;
};

export type CompanyDetailData = {
  /** Staff: what still runs, for the archive dialog. */
  offboarding?: CompanyOffboarding;
  company: CompanyFormValues & {
    id: string;
    archived: boolean;
    createdAt: string;
    /** Who receives the billing notices (the same list the client edits in Notificações). */
    finance: { emails: string[]; phones: string[] };
  };
  members: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    verified: boolean;
    /** What a Membro sees of the company's products, services and projects. */
    scope?: MemberScope;
  }[];
  /** The company's products, services and projects, for "O que esta pessoa vê". */
  scopeEngagements: ScopeEngagement[];
  events: { id: string; action: string; createdAt: string }[];
  relations: {
    openTickets: number;
    openInvoices: number;
    openInvoicesCents: number;
    contracts: number;
    quotes: number;
    engagements: number;
  };
  links: {
    tickets: string;
    invoices: string;
    contracts: string;
    quotes: string;
    engagements: string;
  };
  /** What points at the company, so "Excluir" shows only when it can go. */
  deleteLinks?: CompanyLinks;
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
  value: number;
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
      <span className={cn("text-sm font-medium tabular-nums", value ? "text-foreground" : "text-muted-foreground")}>
        {value}
      </span>
      <ChevronRightIcon className="size-4 text-muted-foreground/60 group-hover:text-primary" />
    </Link>
  );
}

function GrantAccessDialog({
  companyId,
  companyName,
  engagements,
}: {
  companyId: string;
  companyName: string;
  engagements: ScopeEngagement[];
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("member");
  // The choice is sent only when opened: someone who already has access keeps what they see.
  const [choosing, setChoosing] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon />
        Liberar acesso
      </Button>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <ServerForm
          action={saveMembership}
          onSuccess={() => {
            setOpen(false);
            setRole("member");
            setChoosing(false);
          }}
          className="flex flex-col gap-5"
        >
          <input type="hidden" name="companyId" value={companyId} />
          <DialogHeader>
            <DialogTitle>Liberar acesso</DialogTitle>
            <DialogDescription>
              A pessoa recebe um convite e entra com esse e-mail (código ou
              Google). Vale só para {companyName}.
            </DialogDescription>
          </DialogHeader>
          <FormError />
          <div className="grid gap-5">
            <FormField label="E-mail" htmlFor="grant-email">
              <Input
                id="grant-email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                placeholder="nome@empresa.com.br"
              />
            </FormField>
            <FormField label="Permissão" htmlFor="grant-role">
              <RoleSelect id="grant-role" onValueChange={setRole} />
            </FormField>
            {role === "member" &&
              (choosing ? (
                <EngagementScopeField engagements={engagements} defaultValue={{ access: "selected", ids: [] }} />
              ) : (
                <p className="m-0 text-xs text-muted-foreground">
                  Um Membro vê todos os produtos, serviços e projetos da empresa (quem já tem acesso mantém o que vê).{" "}
                  <button type="button" onClick={() => setChoosing(true)} className="font-medium text-primary underline-offset-4 hover:underline">
                    Escolher o que ele vê
                  </button>
                </p>
              ))}
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
  companyId,
  companyName,
  engagements,
}: {
  member: CompanyDetailData["members"][number];
  companyId: string;
  companyName: string;
  engagements: ScopeEngagement[];
}) {
  const [confirm, setConfirm] = useState<null | "notice" | "revoke" | "resend">(null);
  const [scoping, setScoping] = useState(false);
  const ask = (which: "notice" | "revoke" | "resend") =>
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
          {!member.verified && (
            <DropdownMenuItem onSelect={() => ask("resend")}>
              <MailIcon />
              Reenviar convite
            </DropdownMenuItem>
          )}
          {member.role === "member" && (
            <DropdownMenuItem onSelect={() => setTimeout(() => setScoping(true), 0)}>
              <EyeIcon />
              O que esta pessoa vê
            </DropdownMenuItem>
          )}
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
      {member.role === "member" && (
        <Dialog open={scoping} onOpenChange={setScoping}>
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg">
            <ServerForm action={saveMembership} onSuccess={() => setScoping(false)} className="flex min-h-0 flex-col gap-5">
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="email" value={member.email} />
              <input type="hidden" name="role" value="member" />
              <DialogHeader>
                <DialogTitle>O que esta pessoa vê</DialogTitle>
                <DialogDescription>
                  {member.email} em {companyName}
                </DialogDescription>
              </DialogHeader>
              <FormError />
              <div className="-mx-1 min-h-0 overflow-y-auto px-1">
                <EngagementScopeField engagements={engagements} defaultValue={member.scope} hideLegend />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
              </DialogFooter>
            </ServerForm>
          </DialogContent>
        </Dialog>
      )}
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
        open={confirm === "resend"}
        onOpenChange={(open) => !open && setConfirm(null)}
        action={resendInvite}
        fields={{ id: member.id }}
        title="Reenviar o convite?"
        description={`${member.email} ainda não entrou. Um novo convite sai agora; dá para reenviar uma vez por semana.`}
        confirmLabel="Reenviar"
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

type HistoryItem = { id: string; action: string; createdAt: string; times: number };

/** Events of the same kind on the same day, as one line (newest first, as they arrive). */
function groupEvents(events: CompanyDetailData["events"]) {
  const items: HistoryItem[] = [];
  const byKey = new Map<string, HistoryItem>();
  for (const event of events) {
    const key = `${dateLabel(event.createdAt)}|${event.action}`;
    const same = byKey.get(key);
    if (same) same.times += 1;
    else {
      const item = { ...event, times: 1 };
      byKey.set(key, item);
      items.push(item);
    }
  }
  return items;
}

function HistoryList({ items }: { items: HistoryItem[] }) {
  return (
    <ol className="relative m-0 flex list-none flex-col gap-4 border-l border-border p-0 pl-5">
      {items.map((event) => (
        <li key={event.id} className="relative text-sm">
          <span
            aria-hidden="true"
            className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-card bg-primary/70"
          />
          <span className="block text-foreground">
            {auditLabels[event.action] || "Registro atualizado"}
          </span>
          <span className="text-xs text-muted-foreground">
            <time dateTime={event.createdAt}>{dateLabel(event.createdAt)}</time>
            {event.times > 1 && `, ${event.times} vezes`}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function CompanyDetail({
  data,
  editorOpen = false,
  archiveOpen = false,
  termsCard,
  engagementCard,
  notesCard,
}: {
  data: CompanyDetailData;
  editorOpen?: boolean;
  /** `?arquivar=1`, from the list's row menu: opens the archive dialog with its wind-down choices. */
  archiveOpen?: boolean;
  /** "Condições de atendimento", rendered by the page. */
  termsCard?: ReactNode;
  /** How the company's people use the Console (team only). */
  engagementCard?: ReactNode;
  /** Internal notes about the client (team only), beside Histórico. */
  notesCard?: ReactNode;
}) {
  const { company, members, events, relations, links, deleteLinks } = data;
  const router = useRouter();
  const pathname = usePathname();
  // `?editar=1` deep-links into the sheet, also from a link on this same page
  // (the Implantação card), which keeps the component: follow the prop.
  const [editing, setEditing] = useState(editorOpen);
  const [deepLinked, setDeepLinked] = useState(editorOpen);
  if (deepLinked !== editorOpen) {
    setDeepLinked(editorOpen);
    if (editorOpen) setEditing(true);
  }
  const [confirm, setConfirm] = useState<null | "assist" | "archive" | "delete">(archiveOpen && !company.archived ? "archive" : null);
  // The dialog is open from the first render; the address goes back to the page's own, so a reload does not reopen it.
  useEffect(() => {
    if (archiveOpen) router.replace(pathname, { scroll: false });
  }, [archiveOpen, router, pathname]);
  const closeEditor = (open: boolean) => {
    setEditing(open);
    if (!open && editorOpen) router.replace(pathname, { scroll: false });
  };
  const ask = (which: "assist" | "archive" | "delete") =>
    setTimeout(() => setConfirm(which), 0);
  // The page is staff-only; the rule decides whether the company can go.
  const deletable = canDeleteCompany(deleteLinks);
  // The name people read; the razão social and the document stay in Cadastro, once.
  const displayName = companyDisplayName(company.name, company.document);
  const person = onlyDigits(company.document).length === 11;
  // The company's own e-mail and phone first, then the others that receive the billing notices.
  const mainFirst = (main: string | null, list: string[]) =>
    main && (list.includes(main) || !list.length) ? [main, ...list.filter((item) => item !== main)] : list;
  const financeEmails = mainFirst(company.billingEmail, company.finance.emails);
  const financePhones = mainFirst(company.phone, company.finance.phones);
  // Events of the same kind on the same day read as one line ("Tarefa criada", 6 vezes).
  const history = groupEvents(events);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Empresas", href: "/empresas" }]}
        leading={<CompanyTile name={company.name} size="lg" />}
        title={displayName}
        // Archived is said once, by the notice below with its "Restaurar"; an active client needs no badge.
        meta={[<span key="since">Cliente desde {dateLabel(company.createdAt)}</span>]}
        actionsInline
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
                  <Link href={`/orcamentos/novo?companyId=${company.id}`}>
                    <CalculatorIcon />
                    Novo orçamento
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
                {deletable && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => ask("delete")}>
                      <Trash2Icon />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {company.archived && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-edge bg-warning-soft px-4 py-3 text-sm text-warning">
          <span>Cliente arquivado. Histórico, acessos e cobranças continuam aqui.</span>
          <ConfirmAction
            action={setCompanyArchived}
            fields={{ id: company.id, archived: "no" }}
            title="Restaurar cliente?"
            description={`${displayName} volta para a lista de clientes ativos.`}
            confirmLabel="Restaurar"
          >
            <Button size="sm" variant="outline">
              <ArchiveRestoreIcon />
              Restaurar
            </Button>
          </ConfirmAction>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle
                title="Cadastro"
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
            <CardContent className="flex flex-col gap-5">
              {/* The registry data, as documents carry it: the only place for the full name and the document. */}
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <Fact label={person ? "Nome" : "Razão social"}>{company.name}</Fact>
                <Fact label={person ? "CPF" : "CNPJ"}>
                  <span className="tabular-nums">
                    {formatDocument(company.document)}
                  </span>
                </Fact>
                <Fact label={financeEmails.length > 1 ? "E-mails do financeiro" : "E-mail financeiro"}>
                  <ContactList items={financeEmails} />
                </Fact>
                <Fact label={financePhones.length > 1 ? "Telefones do financeiro" : "Telefone"}>
                  <ContactList items={financePhones.map(formatPhone)} />
                </Fact>
                <Fact label="Endereço de cobrança" className="sm:col-span-2">
                  {company.billingAddress && addressLabel(company.billingAddress)}
                </Fact>
                {/* Off is the default; only the exception is worth a line. */}
                <Fact label="Nota fiscal automática">
                  {company.autoIssueNfse && "Ativada"}
                </Fact>
              </dl>
              {!company.billingAddress && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-edge bg-warning-soft px-3 py-2.5 text-sm text-warning">
                  <span>Falta o endereço de cobrança. Sem ele, a cobrança e a nota não saem.</span>
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Cadastrar endereço
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="pessoas" className="scroll-mt-24">
            <CardHeader>
              <SectionTitle
                title={
                  <span className="flex items-center gap-2">
                    Pessoas com acesso
                    {members.length > 0 && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground">
                        {members.length}
                      </span>
                    )}
                  </span>
                }
                action={
                  <GrantAccessDialog
                    companyId={company.id}
                    companyName={displayName}
                    engagements={data.scopeEngagements}
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
                      <TableHead className="hidden md:table-cell">Permissão</TableHead>
                      <TableHead className="w-12 pr-4">
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        {/* max-w-0 + w-full: the name and e-mail truncate instead of pushing the menu off a phone. */}
                        <TableCell className="w-full max-w-0 min-w-40 pl-6">
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
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
                              {/* Signed in is the normal state; only the one still waiting is said. */}
                              {!member.verified && (
                                <span className="block text-xs font-medium text-warning">
                                  Aguardando primeiro acesso
                                </span>
                              )}
                              {/* Phones have no Permissão column: the role rides under the person. */}
                              <span className="block truncate text-xs text-muted-foreground md:hidden">
                                {roleLabels[member.role] || member.role}
                                {member.role === "member" && member.scope?.access === "selected" && ` · Vê: ${scopeSummary(member.scope)}`}
                              </span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="flex flex-col items-start gap-1">
                            <Badge
                              variant={
                                member.role === "manager"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {roleLabels[member.role] || member.role}
                            </Badge>
                            {member.role === "member" && member.scope?.access === "selected" && (
                              <span className="text-xs text-muted-foreground">{`Vê: ${scopeSummary(member.scope)}`}</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <MemberMenu
                            member={member}
                            companyId={company.id}
                            companyName={displayName}
                            engagements={data.scopeEngagements}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : company.archived ? (
                <p className="m-0 px-6 text-sm text-muted-foreground">Ninguém tem acesso.</p>
              ) : (
                <div className="px-6 text-sm">
                  <p className="m-0 font-medium text-foreground">Convide o Administrador</p>
                  <p className="m-0 mt-0.5 max-w-[60ch] text-muted-foreground">
                    Só ele assina contratos, responde orçamentos e vê as faturas. O convite sai quando você libera o e-mail.
                  </p>
                </div>
              )}
              {members.length > 0 && !members.some((member) => member.role === "manager") && (
                <p className="mx-6 mt-3 mb-0 rounded-lg border border-warning-edge bg-warning-soft px-3 py-2 text-xs text-warning">
                  Ninguém aqui é Administrador. Só ele assina contratos, responde orçamentos e vê as faturas da empresa.
                </p>
              )}
            </CardContent>
          </Card>

          {engagementCard}

          <div className="grid items-start gap-6 xl:grid-cols-2">
            {notesCard}
            {history.length > 0 && (
              <Card>
                <CardHeader>
                  <SectionTitle title="Histórico" />
                </CardHeader>
                <CardContent>
                  <HistoryList items={history.slice(0, 5)} />
                  {history.length > 5 && (
                    <Disclosure summary={`Ver todos (${history.length})`} className="mt-4">
                      <HistoryList items={history.slice(5)} />
                    </Disclosure>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          {termsCard}
          <Card variant="quiet">
            <CardHeader>
              <SectionTitle title="Relacionamento" />
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
                href={links.quotes}
                icon={<CalculatorIcon />}
                label="Orçamentos"
                value={relations.quotes}
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
        financeExtras={{
          emails: financeEmails.filter((email) => email !== company.billingEmail),
          phones: financePhones.filter((phone) => phone !== company.phone),
        }}
      />
      <ConfirmDialog
        open={confirm === "assist"}
        onOpenChange={(open) => !open && setConfirm(null)}
        action={startAssistedSession}
        fields={{ companyId: company.id }}
        title="Entrar como esta empresa?"
        description={`Você passa a ver e usar o Console exatamente como ${displayName}, com acesso completo. Suas telas de administrador ficam ocultas até você sair do modo assistido.`}
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
            ? `${displayName} volta para a lista de clientes ativos.`
            : `${displayName} sai da lista de ativos. O histórico fica guardado e dá para restaurar depois.`
        }
        confirmLabel={company.archived ? "Restaurar" : "Arquivar"}
        destructive={!company.archived}
        extra={company.archived || !data.offboarding ? undefined : (formId) => <OffboardingChoices formId={formId} data={data.offboarding!} members={members.length} />}
      />
      {deletable && (
        <DeleteCompanyDialog
          company={company}
          open={confirm === "delete"}
          onOpenChange={(open) => !open && setConfirm(null)}
        />
      )}
    </>
  );
}

/** Archiving a client: what still runs, and what to wind down with it. Only what is ticked happens. */
function OffboardingChoices({ formId, data, members }: { formId: string; data: CompanyOffboarding; members: number }) {
  const choices = [
    data.recurrences > 0 && { name: "pauseRecurrences", label: `Pausar ${data.recurrences === 1 ? "a recorrência ativa" : `as ${data.recurrences} recorrências ativas`}` },
    data.engagements > 0 && { name: "completeEngagements", label: `Concluir ${data.engagements === 1 ? "o projeto, produto ou serviço ativo" : `os ${data.engagements} projetos, produtos e serviços ativos`}` },
    members > 0 && { name: "revokeAccess", label: `Revogar ${members === 1 ? "o acesso da pessoa" : `os acessos das ${members} pessoas`} da empresa` },
  ].filter((choice): choice is { name: string; label: string } => !!choice);
  const open = [
    data.openInvoices.n > 0 && `${data.openInvoices.n === 1 ? "1 fatura em aberto" : `${data.openInvoices.n} faturas em aberto`} (${currency(data.openInvoices.cents)}): cancele no Inter pela fatura, se for o caso`,
    data.contracts > 0 && `${data.contracts === 1 ? "1 contrato em vigência" : `${data.contracts} contratos em vigência`}`,
    data.tickets > 0 && `${data.tickets === 1 ? "1 chamado aberto" : `${data.tickets} chamados abertos`}`,
  ].filter(Boolean);
  if (!choices.length && !open.length) return null;
  return (
    <div className="grid gap-3 rounded-lg border bg-field/60 px-3 py-3 text-sm">
      {choices.length > 0 && (
        <div className="grid gap-2">
          <p className="m-0 text-xs font-medium text-muted-foreground">Junto com o arquivamento (só o que você marcar; restaurar não desfaz)</p>
          {choices.map((choice) => (
            <Label key={choice.name} className="flex items-start gap-2 font-normal">
              <Checkbox form={formId} name={choice.name} value="yes" className="mt-0.5" />
              {choice.label}
            </Label>
          ))}
        </div>
      )}
      {open.length > 0 && (
        <div className="grid gap-1">
          <p className="m-0 text-xs font-medium text-muted-foreground">Continua como está</p>
          {open.map((line) => (
            <p key={line as string} className="m-0 text-xs text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Contacts one per line, so a list of e-mails reads like a list and copies cleanly. */
function ContactList({ items }: { items: string[] }) {
  if (!items.length) return null;
  if (items.length === 1) return <>{items[0]}</>;
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {items.map((item) => (
        <li key={item} className="break-all">
          {item}
        </li>
      ))}
    </ul>
  );
}
