"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
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
  EmptyState,
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
import { CompanySheet } from "./company-sheet";
import { companyInitials, StatusDot } from "./companies-table";
import { DeleteCompanyDialog } from "./delete-company-dialog";
import type { CompanyFormValues } from "./company-form";
import { formatDocument, formatPhone } from "@/lib/companies/company-input";
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
              <RoleSelect id="grant-role" />
            </FormField>
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
  const [confirm, setConfirm] = useState<null | "notice" | "revoke" | "resend">(null);
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

export function CompanyDetail({
  data,
  editorOpen = false,
  archiveOpen = false,
  termsCard,
}: {
  data: CompanyDetailData;
  editorOpen?: boolean;
  /** `?arquivar=1`, from the list's row menu: opens the archive dialog with its wind-down choices. */
  archiveOpen?: boolean;
  /** "Condições de atendimento", rendered by the page. */
  termsCard?: ReactNode;
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
                      Ainda não cadastrado. Sem ele, não dá para emitir cobranças
                      e notas.
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

          <Card id="pessoas" className="scroll-mt-24">
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
                  title="Próximo passo: convide o Administrador"
                  description="Só o Administrador assina contratos, responde orçamentos e vê as faturas. Libere o e-mail que ele usa; o convite sai automaticamente."
                  className="py-10"
                />
              )}
              {members.length > 0 && !members.some((member) => member.role === "manager") && (
                <p className="mx-6 mt-3 mb-0 rounded-lg border border-warning-edge bg-warning-soft px-3 py-2 text-xs text-warning">
                  Ninguém aqui é Administrador. Só ele assina contratos, responde orçamentos e vê as faturas da empresa.
                </p>
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
          {termsCard}
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
            : `${company.name} sai da lista de ativos. O histórico fica guardado e você pode restaurar o cliente depois.`
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
