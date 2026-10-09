"use client";
import Link from "next/link";
import { ContractHandoffCard, type ContractHandoff } from "./contract-handoff-card";
import { InviteManagerField } from "@/components/console/invite-manager-field";
import { useRef, useState } from "react";
import {
  Building2Icon,
  CalendarRangeIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  DownloadIcon,
  FilePlusIcon,
  FileSignatureIcon,
  MoreHorizontalIcon,
  SendIcon,
  Trash2Icon,
  Undo2Icon,
  XCircleIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, SectionTitle } from "@/components/console/page-header";
import { DateField } from "@/components/console/date-field";
import { Fact } from "@/components/console/fact";
import { CopyButton } from "@/components/console/copy-button";
import { DownloadLink } from "@/components/console/download-link";
import {
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import {
  cancelContract,
  revertContract,
  saveContract,
  sendContract,
  setContractTerm,
  signContract,
} from "@/lib/contracts/contract-actions";
import { deleteContract } from "@/lib/contracts/contract-deletion";
import { canDeleteContract } from "@/lib/deletion-rules";
import { auditLabels, currency, dateLabel, dateTimeLabel, relativeLabel } from "@/lib/format";
import { formatDocument } from "@/lib/companies/company-input";
import {
  contractStatusLabels,
  contractTerm,
  contractTermLabel,
  type ContractKind,
  type ContractStatus,
} from "@/lib/contracts/contract-table";
import { ContractKindChip, ContractStatusBadge, ContractTermBadge } from "./contract-badges";
import { ContractText } from "./contract-text";
import { ContractFieldsPanel, type FieldSuggestions } from "./contract-fields-panel";
import {
  ClientRoundCard,
  ReviewHistory,
  TeamReviewPanel,
  useClientReview,
  type ChangeRequestView,
} from "./contract-review";

export type ContractDetailData = {
  contract: {
    id: string;
    title: string;
    body: string;
    kind: ContractKind;
    status: ContractStatus;
    revision: number;
    version: number;
    companyId: string;
    company: string;
    companyDocument: string;
    engagement: string | null;
    template: string | null;
    documentHash: string | null;
    startsAt: string | null;
    endsAt: string | null;
    sentAt: string | null;
    signedAt: string | null;
    createdAt: string;
    /** What the Console already knows for the open fields of a draft. */
    fieldSuggestions: FieldSuggestions;
    /** What in the company's record keeps Inter from issuing its charges (the team, on a draft). */
    billingProblems: string | null;
  };
  /** The contract this one amends, when it is an amendment. */
  parent: { id: string; title: string; status: ContractStatus } | null;
  /** Amendments to this contract, oldest first. */
  amendments: { id: string; title: string; status: ContractStatus; signedAt: string | null; endsAt: string | null }[];
  /** Staff, on a signed contract near its anniversary: the IPCA readjust to prepare. */
  readjust?: { anniversary: string; currentCents: number; newCents: number; percent: number } | null;
  /** Every text sent so far, newest first; `current` is the one in force. */
  versions: { version: number; sentAt: string; hash: string; current: boolean; signedBy: ("client" | "anuntech")[] }[];
  signatures: {
    party: "client" | "anuntech";
    name: string;
    email: string;
    signedAt: string;
    ip: string | null;
  }[];
  viewer: { admin: boolean; party: "anuntech" | "client" | null; name: string };
  /**
   * Change requests (the client's side also sees the ones it has not sent)
   * and the text of the version before the one shown, to mark what changed.
   */
  review?: { requests: ChangeRequestView[]; previousBody: string | null };
  events: { id: string; action: string; createdAt: string }[];
  /**
   * Staff only: every signature on any version and every amendment, cancelled
   * ones included, which decide whether it can be deleted. Absent, it cannot.
   */
  deletion?: { signatures: number; amendments: number };
  /** Staff, on a signed contract: the proposal behind it and what is ready to prepare from it. */
  handoff?: ContractHandoff;
  /** Staff, before sending: the company has no Administrador yet, and who to suggest. */
  invite?: { suggestion: string } | null;
  now: string;
  today: string;
};

function Party({
  label,
  who,
  signature,
  pending,
}: {
  label: string;
  who: string;
  signature?: ContractDetailData["signatures"][number];
  pending: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {signature ? (
        <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" />
      ) : (
        <CircleDashedIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{who}</p>
        {signature ? (
          <p className="mt-1 text-xs text-foreground">
            {signature.name} · {dateTimeLabel(signature.signedAt)}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{pending ? "Aguardando assinatura" : "—"}</p>
        )}
      </div>
    </div>
  );
}

/** Start and end of validity, side by side; shared by the editor and the dialog. */
function TermFields({
  startsAt,
  endsAt,
  hint,
  idPrefix,
}: {
  startsAt: string | null;
  endsAt: string | null;
  hint?: string;
  idPrefix: string;
}) {
  const [start, setStart] = useState(startsAt ?? "");
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-starts`} className="mb-1.5">
            Início da vigência
          </Label>
          <DateField id={`${idPrefix}-starts`} name="startsAt" value={start} onChange={setStart} placeholder="Sem data" />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-ends`} className="mb-1.5">
            Fim da vigência
          </Label>
          <DateField id={`${idPrefix}-ends`} name="endsAt" defaultValue={endsAt ?? ""} min={start || undefined} placeholder="Sem data" />
        </div>
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ContractDetail({ data }: { data: ContractDetailData }) {
  const { contract: c, parent, amendments, readjust, versions, signatures, viewer, events, deletion, now, today } = data;
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [editingTerm, setEditingTerm] = useState(false);
  const [consent, setConsent] = useState(false);
  const signed = (party: "client" | "anuntech") => signatures.find((s) => s.party === party);
  const canSign = c.status === "sent" && viewer.party !== null && !signed(viewer.party);
  // During a review the team edits the next version while the client reads the sent one.
  const editable = viewer.admin && (c.status === "draft" || c.status === "in_review");
  const review = data.review ?? { requests: [], previousBody: null };
  const canRequest = c.status === "sent" && viewer.party === "client" && !signed("client");
  const clientReview = useClientReview({
    contractId: c.id,
    version: c.version,
    requests: review.requests,
    canRequest,
    now,
  });
  const pendingRequests = review.requests.filter((r) => r.version === c.version && r.status === "pending").length;
  const roundCard = viewer.party === "client" && (canRequest || c.status === "in_review") && (
    <ClientRoundCard
      contractId={c.id}
      status={c.status === "in_review" ? "in_review" : "sent"}
      version={c.version}
      requests={review.requests}
      drafts={clientReview.drafts}
      amendment={c.kind === "amendment"}
    />
  );
  const [showChanges, setShowChanges] = useState(true);
  // Accepting a proposed text rewrites the saved draft: unsaved edits in the editor would be lost.
  const [dirtyRevision, setDirtyRevision] = useState<number | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const editorDirty = dirtyRevision === c.revision;
  const amendment = c.kind === "amendment";
  const noun = amendment ? "aditivo" : "contrato";
  const pdfHref = `/api/contratos/${c.id}/pdf`;
  const term = c.status === "signed" ? contractTerm({ startsAt: c.startsAt, endsAt: c.endsAt }, today) : null;
  const termLabel = term ? contractTermLabel(term) : null;
  const canAmend = viewer.admin && !amendment && c.status === "signed";
  const deletable = viewer.admin && !!deletion && canDeleteContract({ status: c.status, kind: c.kind, ...deletion });
  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Contratos", href: "/contratos" },
          ...(parent ? [{ label: parent.title, href: `/contratos/${parent.id}` }] : []),
          { label: c.title },
        ]}
        title={c.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ContractStatusBadge status={c.status} />
            <ContractTermBadge status={c.status} startsAt={c.startsAt} endsAt={c.endsAt} today={today} />
            <ContractKindChip kind={c.kind} />
            {viewer.admin ? (
              <Link href={`/empresas/${c.companyId}`} className="text-foreground hover:text-primary">
                {c.company}
              </Link>
            ) : (
              <span>{c.company}</span>
            )}
            {c.engagement && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span>{c.engagement}</span>
              </>
            )}
          </span>
        }
        actions={
          <>
            {(viewer.admin || c.status !== "draft") && c.status !== "cancelled" && (
              <Button variant={canAmend ? "outline" : c.status === "signed" ? "default" : "outline"} asChild>
                <DownloadLink href={pdfHref} filename={`${c.title}.pdf`}>
                  <DownloadIcon />
                  {c.status === "signed" ? "Baixar PDF assinado" : "Baixar PDF"}
                </DownloadLink>
              </Button>
            )}
            {canAmend && (
              <Button asChild>
                <Link href={`/contratos/novo?parentId=${c.id}`}>
                  <FilePlusIcon />
                  Criar aditivo
                </Link>
              </Button>
            )}
            {viewer.admin && c.status === "draft" && (
              <Button onClick={() => setSending(true)}>
                <SendIcon />
                Enviar para assinatura
              </Button>
            )}
            {viewer.admin && c.status === "in_review" && (
              <Button
                onClick={() => setSending(true)}
                disabled={pendingRequests > 0}
                title={pendingRequests > 0 ? "Responda todos os pedidos do cliente antes de enviar." : undefined}
              >
                <SendIcon />
                Enviar versão {c.version + 1}
              </Button>
            )}
            {viewer.admin && (c.status !== "cancelled" || deletable) && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Mais ações">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem asChild>
                    <Link href={`/empresas/${c.companyId}`}>
                      <Building2Icon />
                      Ver empresa
                    </Link>
                  </DropdownMenuItem>
                  {c.status !== "draft" && (
                    <DropdownMenuItem onSelect={() => setTimeout(() => setEditingTerm(true), 0)}>
                      <CalendarRangeIcon />
                      Editar vigência
                    </DropdownMenuItem>
                  )}
                  {c.status === "sent" && (
                    <DropdownMenuItem onSelect={() => setTimeout(() => setReverting(true), 0)}>
                      <Undo2Icon />
                      Voltar para rascunho
                    </DropdownMenuItem>
                  )}
                  {(c.status === "draft" || c.status === "sent" || c.status === "in_review" || deletable) && (
                    <DropdownMenuSeparator />
                  )}
                  {(c.status === "draft" || c.status === "sent" || c.status === "in_review") && (
                    <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => setCancelling(true), 0)}>
                      <XCircleIcon />
                      {amendment ? "Cancelar aditivo" : "Cancelar contrato"}
                    </DropdownMenuItem>
                  )}
                  {deletable && (
                    <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => setDeleting(true), 0)}>
                      <Trash2Icon />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {/* On a phone the round goes before the text, not after all of it. */}
          {roundCard && <div className="lg:hidden">{roundCard}</div>}
          {viewer.admin && c.status === "in_review" && (
            <TeamReviewPanel version={c.version} requests={review.requests} editorDirty={editorDirty} now={now} />
          )}
          {editable ? (
            <Card>
              <ServerForm
                key={c.revision}
                action={saveContract}
                className="contents"
                onInput={() => setDirtyRevision(c.revision)}
              >
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="revision" value={c.revision} />
                <CardHeader>
                  <SectionTitle
                    title={amendment ? "Texto do aditivo" : "Texto do contrato"}
                    description={
                      c.version > 0
                        ? `Nova versão. A versão ${c.version} ficou no histórico e o próximo envio pede as assinaturas de novo.`
                        : "Revise o que veio do modelo. Quebras de linha viram parágrafos no PDF."
                    }
                  />
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <FormError />
                  <ContractFieldsPanel bodyRef={bodyRef} initialBody={c.body} suggestions={c.fieldSuggestions} />
                  <div>
                    <Label htmlFor="contract-title" className="mb-1.5">
                      Título
                    </Label>
                    <Input id="contract-title" name="title" required maxLength={160} defaultValue={c.title} />
                  </div>
                  <TermFields
                    idPrefix="contract"
                    startsAt={c.startsAt}
                    endsAt={c.endsAt}
                    hint={
                      amendment
                        ? "Preencha só se o aditivo prorrogar ou encurtar o contrato original; ao ser assinado, a vigência dele passa a ser esta."
                        : "Entra no PDF e dispara o alerta de vencimento 30 dias antes do fim. Deixe em branco se não houver prazo."
                    }
                  />
                  <div>
                    <Label htmlFor="contract-body" className="mb-1.5">
                      Texto
                    </Label>
                    <Textarea
                      ref={bodyRef}
                      id="contract-body"
                      name="body"
                      required
                      rows={26}
                      maxLength={100000}
                      defaultValue={c.body}
                      className="min-h-[32rem] font-serif text-[15px] leading-7"
                    />
                  </div>
                </CardContent>
                <CardFooter className="justify-end gap-2 border-t">
                  <SubmitButton pendingLabel="Salvando…">Salvar rascunho</SubmitButton>
                </CardFooter>
              </ServerForm>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <SectionTitle
                  title={amendment ? "Texto do aditivo" : "Texto do contrato"}
                  description={
                    [
                      c.status === "signed"
                        ? `Versão assinada${c.version > 1 ? ` (${c.version}ª)` : ""}. O hash abaixo identifica este texto.`
                        : c.status === "in_review"
                          ? `Versão ${c.version}, como foi enviada. Os pedidos de alteração estão com a Anuntech.`
                          : canRequest
                            ? "Texto enviado para assinatura. Para pedir uma mudança, use o botão ao lado da cláusula."
                            : c.status === "sent"
                              ? "Texto enviado para assinatura. Não muda mais."
                              : null,
                      review.previousBody && showChanges ? `A barra na margem marca o que mudou desde a versão ${c.version - 1}.` : null,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  action={
                    review.previousBody ? (
                      <Button variant="ghost" size="sm" onClick={() => setShowChanges((value) => !value)}>
                        {showChanges ? "Esconder mudanças" : "Marcar mudanças"}
                      </Button>
                    ) : undefined
                  }
                />
              </CardHeader>
              <CardContent className="px-6 py-8 sm:px-12 sm:py-10">
                <ContractText
                  body={c.body}
                  previousBody={showChanges ? review.previousBody : null}
                  extras={viewer.party === "client" ? clientReview.extras : undefined}
                />
              </CardContent>
            </Card>
          )}
          <ReviewHistory
            requests={review.requests}
            before={c.version}
            now={now}
            audience={viewer.admin ? "team" : "client"}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          {roundCard && <div className="hidden lg:block">{roundCard}</div>}
          {viewer.admin && data.handoff && <ContractHandoffCard contractId={c.id} handoff={data.handoff} />}
          {viewer.party === "client" && c.status === "signed" && !amendment && (
            <Card className="gap-4 py-5">
              <CardHeader>
                <SectionTitle title="Próximos passos" description="O que acontece com o contrato assinado." />
              </CardHeader>
              <CardContent>
                <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-foreground marker:text-muted-foreground">
                  <li>
                    As cobranças aparecem em <Link href="/financeiro" className="font-medium hover:text-primary">Financeiro</Link>.
                  </li>
                  <li>
                    Acessos, dúvidas e pedidos seguem por <Link href="/chamados" className="font-medium hover:text-primary">chamado</Link>.
                  </li>
                  <li>
                    O andamento de um projeto fica em <Link href="/projetos" className="font-medium hover:text-primary">Projetos</Link>.
                  </li>
                  <li>
                    <Link href="/como-trabalhamos" className="font-medium hover:text-primary">Como trabalhamos</Link> mostra os prazos e o que ajuda a equipe.
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <SectionTitle
                title="Assinaturas"
                description={
                  c.status === "signed"
                    ? "Assinado pelas duas partes."
                    : c.status === "sent"
                      ? "Cada parte assina com o próprio acesso ao Console."
                      : c.status === "in_review"
                        ? "Disponíveis quando a nova versão chegar."
                        : "Disponíveis depois do envio."
                }
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Party
                label="Contratante"
                who={`${c.company} · ${formatDocument(c.companyDocument)}`}
                signature={signed("client")}
                pending={c.status === "sent"}
              />
              <Party label="Contratada" who="Anuntech" signature={signed("anuntech")} pending={c.status === "sent"} />
              {canSign && (
                <ServerForm action={signContract} className="flex flex-col gap-3 border-t pt-5">
                  <input type="hidden" name="id" value={c.id} />
                  <FormError />
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <Checkbox
                      name="consent"
                      checked={consent}
                      onCheckedChange={(value) => setConsent(value === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Li o {noun} e concordo com todos os termos, assinando como{" "}
                      <span className="font-medium">{viewer.name}</span>
                      {viewer.party === "client" ? ` por ${c.company}` : " pela Anuntech"}.
                    </span>
                  </label>
                  <SubmitButton disabled={!consent} pendingLabel="Assinando…">
                    <FileSignatureIcon />
                    {amendment ? "Assinar aditivo" : "Assinar contrato"}
                  </SubmitButton>
                  <p className="text-xs text-muted-foreground">
                    Ficam registrados seu nome, e-mail, data, IP e o hash do texto.
                    {clientReview.drafts > 0 &&
                      ` Assinar descarta ${clientReview.drafts === 1 ? "o pedido de alteração não enviado" : `os ${clientReview.drafts} pedidos de alteração não enviados`}.`}
                  </p>
                </ServerForm>
              )}
            </CardContent>
          </Card>

          {c.status !== "draft" && c.status !== "cancelled" && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Vigência"
                  description={
                    amendment
                      ? c.startsAt || c.endsAt
                        ? "Ao ser assinado, passa a valer para o contrato original."
                        : "Este aditivo não muda o prazo do contrato."
                      : c.endsAt
                        ? undefined
                        : "Sem prazo definido."
                  }
                />
              </CardHeader>
              {(c.startsAt || c.endsAt || viewer.admin) && (
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4">
                    <Fact label="Início">{c.startsAt ? dateLabel(c.startsAt) : "—"}</Fact>
                    <Fact label="Fim">
                      {c.endsAt ? (
                        <span className={cn(term?.state === "expired" && "text-destructive")}>{dateLabel(c.endsAt)}</span>
                      ) : (
                        "—"
                      )}
                    </Fact>
                    {termLabel && (
                      <Fact label="Situação" className="col-span-2">
                        <span
                          className={cn(
                            "font-medium",
                            term?.state === "expired" ? "text-destructive" : term?.state === "expiring" ? "text-warning" : "",
                          )}
                        >
                          {termLabel}
                        </span>
                      </Fact>
                    )}
                  </dl>
                  {viewer.admin && !c.endsAt && !amendment && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Defina o fim para receber o alerta de vencimento.{" "}
                      <button type="button" className="font-medium text-primary hover:underline" onClick={() => setEditingTerm(true)}>
                        Editar vigência
                      </button>
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {!amendment && (amendments.length > 0 || canAmend) && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Aditivos"
                  description={amendments.length ? undefined : "Prorrogações, reajustes e mudanças de escopo, assinados à parte."}
                />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {amendments.length > 0 && (
                  <ol className="flex flex-col gap-3">
                    {amendments.map((item) => (
                      <li key={item.id} className="min-w-0 text-sm">
                        <Link href={`/contratos/${item.id}`} className="block truncate font-medium text-foreground hover:text-primary">
                          {item.title}
                        </Link>
                        <span
                          className={cn("block text-xs", item.status === "sent" ? "text-warning" : "text-muted-foreground")}
                        >
                          {item.signedAt ? `Assinado em ${dateLabel(new Date(item.signedAt))}` : contractStatusLabels[item.status]}
                          {item.endsAt && ` · vigência até ${dateLabel(item.endsAt)}`}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                {canAmend && readjust && (
                  <div className="flex flex-col gap-2 rounded-lg border bg-field/60 px-3 py-2.5 text-sm">
                    <span>
                      {`Reajuste pelo IPCA ${readjust.anniversary < today ? "desde" : "em"} ${dateLabel(readjust.anniversary)}: ${currency(readjust.currentCents)} passa a ${currency(readjust.newCents)} (${String(readjust.percent).replace(".", ",")}%).`}
                    </span>
                    <Button size="sm" className="self-start" asChild>
                      <Link href={`/contratos/novo?parentId=${c.id}&reajuste=1`}>
                        <FilePlusIcon />
                        Preparar reajuste
                      </Link>
                    </Button>
                  </div>
                )}
                {canAmend && (
                  <Button variant="outline" size="sm" className="self-start" asChild>
                    <Link href={`/contratos/novo?parentId=${c.id}`}>
                      <FilePlusIcon />
                      Criar aditivo
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {parent && (
            <Card>
              <CardHeader>
                <SectionTitle title="Contrato original" />
              </CardHeader>
              <CardContent>
                <Link href={`/contratos/${parent.id}`} className="block text-sm font-medium text-foreground hover:text-primary">
                  {parent.title}
                </Link>
                <ContractStatusBadge status={parent.status} className="mt-2" />
              </CardContent>
            </Card>
          )}

          {c.documentHash && (
            <Card>
              <CardHeader>
                <SectionTitle title="Documento" />
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4">
                  {c.sentAt && <Fact label="Enviado em">{dateTimeLabel(c.sentAt)}</Fact>}
                  {c.signedAt && <Fact label="Concluído em">{dateTimeLabel(c.signedAt)}</Fact>}
                  {c.version > 1 && <Fact label="Versão">{c.version}ª</Fact>}
                  <Fact label="Hash SHA-256">
                    <span className="flex items-start gap-1">
                      <code className="min-w-0 break-all text-xs">{c.documentHash}</code>
                      <CopyButton value={c.documentHash} label="Copiar hash" />
                    </span>
                  </Fact>
                  {c.template && <Fact label="Modelo">{c.template}</Fact>}
                </dl>
              </CardContent>
            </Card>
          )}

          {versions.some((v) => !v.current) && (
            <Card>
              <CardHeader>
                <SectionTitle
                  title="Versões"
                  description="Cada envio congela um texto. As anteriores ficam para consulta, sem efeito."
                />
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-3">
                  {versions.map((v) => (
                    <li key={v.version} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          Versão {v.version}
                          {v.current && <span className="ml-2 text-xs font-normal text-success">atual</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Enviada em {dateLabel(new Date(v.sentAt))}
                          {v.signedBy.length > 0 &&
                            ` · assinada por ${v.signedBy.map((p) => (p === "client" ? "cliente" : "Anuntech")).join(" e ")}`}
                        </p>
                      </div>
                      {(viewer.admin || !v.current) && (
                        <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" asChild>
                          <DownloadLink
                            href={v.current ? pdfHref : `${pdfHref}?versao=${v.version}`}
                            filename={`${c.title} v${v.version}.pdf`}
                            aria-label={`Baixar versão ${v.version}`}
                          >
                            <DownloadIcon />
                          </DownloadLink>
                        </Button>
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {events.length > 0 && (
            <Card>
              <CardHeader>
                <SectionTitle title="Histórico" />
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-3">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-foreground">{auditLabels[event.action] ?? event.action}</span>
                      <time
                        dateTime={event.createdAt}
                        title={dateTimeLabel(event.createdAt)}
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {relativeLabel(event.createdAt, now)}
                      </time>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={sending}
        onOpenChange={setSending}
        action={sendContract}
        fields={{ id: c.id }}
        extra={data.invite ? (formId) => <InviteManagerField formId={formId} suggestion={data.invite!.suggestion} /> : undefined}
        title={c.status === "in_review" ? `Enviar a versão ${c.version + 1}?` : "Enviar para assinatura?"}
        description={
          // What goes out is the saved text, never the edits still open on the page.
          (editorDirty ? "Há alterações no texto que ainda não foram salvas e não entram no envio. " : "") +
          (c.billingProblems ? `Atenção: ${c.billingProblems} no cadastro da empresa. Sem isso, as cobranças deste contrato não saem no Inter. ` : "") +
          (c.status === "in_review"
            ? `O texto vira a versão ${c.version + 1}. O cliente recebe um aviso por e-mail, vê o que mudou e a resposta a cada pedido, e assina ou pede novas alterações.`
            : c.version > 0
              ? `O texto vira a versão ${c.version + 1}. O cliente recebe um aviso por e-mail, e as assinaturas da versão anterior deixam de valer.`
              : "O texto é congelado e o cliente recebe um aviso por e-mail para ler e assinar no Console. Depois disso, o texto não muda mais.")
        }
        confirmLabel="Enviar"
      />
      {clientReview.dialogs}
      <ConfirmDialog
        open={reverting}
        onOpenChange={setReverting}
        action={revertContract}
        fields={{ id: c.id }}
        title="Voltar para rascunho?"
        description={
          signatures.length
            ? "A assinatura já dada fica no histórico desta versão, mas deixa de valer. Depois de editar, o novo envio pede as duas assinaturas de novo."
            : "Você volta a editar o texto. O envio atual fica registrado como versão anterior."
        }
        confirmLabel="Voltar para rascunho"
      />
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        action={cancelContract}
        fields={{ id: c.id }}
        title={amendment ? "Cancelar aditivo?" : "Cancelar contrato?"}
        description="Ele deixa de aparecer para o cliente. Assinaturas já dadas continuam registradas."
        confirmLabel={amendment ? "Cancelar aditivo" : "Cancelar contrato"}
        destructive
      />
      {deletable && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          action={deleteContract}
          fields={{ id: c.id }}
          title={amendment ? "Excluir aditivo?" : "Excluir contrato?"}
          description={`O ${noun} sai do Console${
            versions.length ? `, com ${versions.length === 1 ? "a versão enviada" : `as ${versions.length} versões enviadas`}` : ""
          }. Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          destructive
        />
      )}
      <Dialog open={editingTerm} onOpenChange={setEditingTerm}>
        <DialogContent className="sm:max-w-md">
          <ServerForm key={editingTerm ? "open" : "closed"} action={setContractTerm} onSuccess={() => setEditingTerm(false)} className="flex flex-col gap-5">
            <input type="hidden" name="id" value={c.id} />
            <DialogHeader>
              <DialogTitle>Vigência</DialogTitle>
              <DialogDescription>
                Datas para o alerta de vencimento. O que vale entre as partes é o texto {c.status === "signed" ? "assinado" : "enviado"}.
              </DialogDescription>
            </DialogHeader>
            <FormError />
            <TermFields idPrefix="term" startsAt={c.startsAt} endsAt={c.endsAt} />
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
    </>
  );
}
