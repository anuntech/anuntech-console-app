"use client";
import { useState, type ReactNode } from "react";
import { CheckIcon, MessageSquarePlusIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle } from "@/components/console/page-header";
import { ConfirmDialog, FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import {
  decideChangeRequest,
  deleteChangeRequest,
  saveChangeRequest,
  submitChangeRequests,
} from "@/lib/contracts/contract-review-actions";
import { blockLabel, diffWords, requestable, type ContractBlock } from "@/lib/contracts/contract-text";
import { dateLabel, dateTimeLabel, relativeLabel } from "@/lib/format";
import type { BlockExtras } from "./contract-text";

export type ChangeRequestView = {
  id: string;
  version: number;
  blockIndex: number;
  label: string;
  excerpt: string;
  comment: string;
  proposedText: string | null;
  status: "draft" | "pending" | "accepted" | "declined";
  applied: boolean;
  response: string | null;
  author: string;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
};

const statusLabels: Record<ChangeRequestView["status"], string> = {
  draft: "Não enviado",
  pending: "Aguardando a Anuntech",
  accepted: "Aceito",
  declined: "Recusado",
};
const statusTones: Record<ChangeRequestView["status"], string> = {
  draft: "bg-secondary text-secondary-foreground",
  pending: "bg-warning-soft text-warning",
  accepted: "bg-success-soft text-success",
  declined: "bg-destructive-soft text-destructive",
};

/** What the proposed text keeps, drops and adds, word by word. */
function ProposalDiff({ before, after }: { before: string; after: string }) {
  return (
    <p className="m-0 text-sm leading-6 whitespace-pre-wrap text-foreground">
      {diffWords(before, after).map((part, index) =>
        part.change === "removed" ? (
          <del key={index} className="rounded-sm bg-destructive-soft text-destructive decoration-destructive/60">
            {part.text}
          </del>
        ) : part.change === "added" ? (
          <ins key={index} className="rounded-sm bg-success-soft text-success no-underline">
            {part.text}
          </ins>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

/** One request: where, why, the text proposed, and the team's answer once there is one. */
export function RequestCard({
  request,
  now,
  showLabel = false,
  actions,
  children,
}: {
  request: ChangeRequestView;
  now: string;
  /** The block's name; left out under the block itself, where it is obvious. */
  showLabel?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-card">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {showLabel && <span className="font-medium text-foreground">{request.label}</span>}
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusTones[request.status])}>
          {statusLabels[request.status]}
        </span>
        <span className="text-xs text-muted-foreground" title={dateTimeLabel(request.submittedAt ?? request.createdAt)}>
          {request.author} · {relativeLabel(request.submittedAt ?? request.createdAt, now)}
        </span>
        {actions && <span className="ml-auto flex items-center gap-1">{actions}</span>}
      </div>
      <p className="m-0 mt-2 leading-6 whitespace-pre-wrap text-foreground">{request.comment}</p>
      {request.proposedText && (
        <div className="mt-2 rounded-md bg-secondary/60 px-3 py-2">
          <p className="m-0 mb-1 text-xs text-muted-foreground">Texto proposto</p>
          <ProposalDiff before={request.excerpt} after={request.proposedText} />
        </div>
      )}
      {(request.response || request.applied) && (
        <div className="mt-2 border-l-2 border-primary/40 pl-3">
          <p className="m-0 text-xs text-muted-foreground">
            Resposta da Anuntech{request.applied ? " · texto aplicado na versão seguinte" : ""}
          </p>
          {request.response && <p className="m-0 mt-0.5 leading-6 whitespace-pre-wrap text-foreground">{request.response}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/** The client's form under a block: why, and optionally the text it should read. */
function RequestForm({
  contractId,
  blockIndex,
  block,
  request,
  onDone,
}: {
  contractId: string;
  blockIndex: number;
  block: ContractBlock;
  request?: ChangeRequestView;
  onDone: () => void;
}) {
  const field = `request-${request?.id ?? blockIndex}`;
  return (
    <ServerForm
      action={saveChangeRequest}
      onSuccess={onDone}
      className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-3 text-sm shadow-card"
    >
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="blockIndex" value={blockIndex} />
      <input type="hidden" name="requestId" value={request?.id ?? ""} />
      <p className="m-0 text-caption font-medium text-muted-foreground">
        Pedido de alteração: {blockLabel(block)}
      </p>
      <FormError />
      <div>
        <Label htmlFor={`${field}-comment`} className="mb-1.5">
          O que precisa mudar
        </Label>
        <Textarea
          id={`${field}-comment`}
          name="comment"
          required
          rows={2}
          maxLength={2000}
          defaultValue={request?.comment}
          autoFocus
          placeholder="Ex.: o prazo de pagamento precisa ser de 15 dias."
          onKeyDown={(event) => event.key === "Escape" && onDone()}
        />
      </div>
      <div>
        <Label htmlFor={`${field}-proposal`} className="mb-1.5">
          Texto proposto <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id={`${field}-proposal`}
          name="proposedText"
          rows={3}
          maxLength={8000}
          defaultValue={request?.proposedText ?? block.text}
          className="font-serif text-[15px] leading-7"
          onKeyDown={(event) => event.key === "Escape" && onDone()}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Reescreva a cláusula como ela deveria ficar, ou deixe como está para só comentar.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton pendingLabel="Salvando…">{request ? "Salvar pedido" : "Adicionar pedido"}</SubmitButton>
      </div>
    </ServerForm>
  );
}

/**
 * The client's side of a review, wired into the contract text: a "pedir
 * alteração" button beside each clause while the contract waits for
 * signatures, and the requests of this version under their clauses.
 */
export function useClientReview({
  contractId,
  version,
  requests,
  canRequest,
  now,
}: {
  contractId: string;
  version: number;
  requests: ChangeRequestView[];
  canRequest: boolean;
  now: string;
}) {
  const [open, setOpen] = useState<{ blockIndex: number; requestId?: string } | null>(null);
  const [removing, setRemoving] = useState<ChangeRequestView | null>(null);
  const current = requests.filter((r) => r.version === version);
  const extras = (index: number, block: ContractBlock): BlockExtras | null => {
    const here = current.filter((r) => r.blockIndex === index);
    const editing = open?.blockIndex === index;
    const canAsk = canRequest && requestable(block);
    if (!here.length && !canAsk) return null;
    return {
      active: editing,
      action:
        canAsk && !editing ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Pedir alteração em ${blockLabel(block)}`}
            title="Pedir alteração"
            onClick={() => setOpen({ blockIndex: index })}
            className="text-muted-foreground opacity-60 group-hover/block:opacity-100 hover:text-primary focus-visible:opacity-100"
          >
            <MessageSquarePlusIcon />
          </Button>
        ) : undefined,
      after:
        here.length || editing ? (
          <>
            {here.map((request) =>
              open?.requestId === request.id ? (
                <RequestForm
                  key={request.id}
                  contractId={contractId}
                  blockIndex={index}
                  block={block}
                  request={request}
                  onDone={() => setOpen(null)}
                />
              ) : (
                <RequestCard
                  key={request.id}
                  request={request}
                  now={now}
                  actions={
                    request.status === "draft" && canRequest ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Editar pedido em ${request.label}`}
                          onClick={() => setOpen({ blockIndex: index, requestId: request.id })}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Descartar pedido em ${request.label}`}
                          onClick={() => setRemoving(request)}
                        >
                          <Trash2Icon />
                        </Button>
                      </>
                    ) : undefined
                  }
                />
              ),
            )}
            {editing && !open?.requestId && (
              <RequestForm contractId={contractId} blockIndex={index} block={block} onDone={() => setOpen(null)} />
            )}
          </>
        ) : undefined,
    };
  };
  const dialogs = (
    <ConfirmDialog
      open={removing !== null}
      onOpenChange={(value) => !value && setRemoving(null)}
      action={deleteChangeRequest}
      fields={{ id: removing?.id ?? "" }}
      title="Descartar este pedido?"
      description={removing ? `O pedido em ${removing.label} ainda não foi enviado e sai da sua lista.` : undefined}
      confirmLabel="Descartar"
      destructive
    />
  );
  return { extras, dialogs, drafts: current.filter((r) => r.status === "draft").length };
}

/** The client's round, beside the text: what is ready to send, or what the team is reviewing. */
export function ClientRoundCard({
  contractId,
  status,
  version,
  requests,
  drafts,
  amendment,
}: {
  contractId: string;
  status: "sent" | "in_review";
  version: number;
  requests: ChangeRequestView[];
  drafts: number;
  amendment: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const noun = amendment ? "aditivo" : "contrato";
  const sent = requests.filter((r) => r.version === version && r.status !== "draft");
  const at = sent.map((r) => r.submittedAt).filter(Boolean).sort().at(-1);
  if (status === "in_review")
    return (
      <Card>
        <CardHeader>
          <SectionTitle
            title="Em revisão pela Anuntech"
            description={`Você enviou ${sent.length === 1 ? "1 pedido" : `${sent.length} pedidos`} de alteração${at ? ` em ${dateLabel(new Date(at))}` : ""}. A nova versão chega por e-mail, com a resposta a cada pedido.`}
          />
        </CardHeader>
      </Card>
    );
  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title="Pedir alterações"
          description={
            drafts
              ? `${drafts === 1 ? "1 pedido pronto" : `${drafts} pedidos prontos`} para enviar. A Anuntech responde cada um e manda uma nova versão.`
              : `Algo para mudar no ${noun}? Use o botão ao lado da cláusula. Os pedidos ficam aqui até você enviar.`
          }
        />
      </CardHeader>
      {drafts > 0 && (
        <CardContent>
          <Button className="w-full" onClick={() => setConfirming(true)}>
            Enviar {drafts === 1 ? "pedido" : `${drafts} pedidos`} à Anuntech
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            action={submitChangeRequests}
            fields={{ contractId }}
            title={drafts === 1 ? "Enviar o pedido à Anuntech?" : `Enviar os ${drafts} pedidos à Anuntech?`}
            description={`A Anuntech responde cada pedido e manda uma nova versão do ${noun}. Até lá, esta versão não pode ser assinada.`}
            confirmLabel="Enviar pedidos"
          />
        </CardContent>
      )}
    </Card>
  );
}

/** The team's answer form for one request: a note, and accept or decline. */
function DecisionForm({
  request,
  editorDirty,
  onDone,
}: {
  request: ChangeRequestView;
  editorDirty: boolean;
  onDone?: () => void;
}) {
  // Accepting rewrites the saved draft, which would drop edits not saved yet.
  const blockedByEditor = editorDirty && !!request.proposedText;
  return (
    <ServerForm data-assistant-ignore="" action={decideChangeRequest} onSuccess={onDone} className="mt-3 flex flex-col gap-2 border-t pt-3">
      <input type="hidden" name="id" value={request.id} />
      <FormError />
      <Label htmlFor={`decision-${request.id}`} className="text-xs text-muted-foreground">
        Resposta ao cliente <span className="font-normal">(obrigatória para recusar)</span>
      </Label>
      <Textarea
        id={`decision-${request.id}`}
        name="response"
        rows={2}
        maxLength={2000}
        defaultValue={request.response ?? ""}
        placeholder="Ex.: ajustamos para 20 dias, como meio-termo."
      />
      {blockedByEditor && (
        <p className="m-0 text-xs text-warning">Salve o rascunho antes de aceitar: o texto proposto entra no rascunho salvo.</p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <SubmitButton name="decision" value="decline" variant="outline">
          <XIcon />
          Recusar
        </SubmitButton>
        <SubmitButton name="decision" value="accept" disabled={blockedByEditor}>
          <CheckIcon />
          {request.proposedText ? "Aceitar e aplicar" : "Aceitar"}
        </SubmitButton>
      </div>
    </ServerForm>
  );
}

/** The team's review of a round: every request of the version in review, decided one by one. */
export function TeamReviewPanel({
  version,
  requests,
  editorDirty,
  now,
}: {
  version: number;
  requests: ChangeRequestView[];
  editorDirty: boolean;
  now: string;
}) {
  const [changing, setChanging] = useState<string | null>(null);
  const round = requests
    .filter((r) => r.version === version && r.status !== "draft")
    .sort((a, b) => a.blockIndex - b.blockIndex || a.createdAt.localeCompare(b.createdAt));
  const answered = round.filter((r) => r.status !== "pending").length;
  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title="Pedidos do cliente"
          description={`${answered} de ${round.length} respondidos na versão ${version}. Aceitos com texto proposto entram no rascunho abaixo; recusados levam uma resposta. Com todos respondidos, envie a versão ${version + 1}.`}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {round.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            now={now}
            showLabel
            actions={
              request.status !== "pending" && !request.applied && changing !== request.id ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setChanging(request.id)}>
                  Mudar decisão
                </Button>
              ) : undefined
            }
          >
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Texto enviado na versão {version}</summary>
              <p className="m-0 mt-1.5 font-serif text-sm leading-6 whitespace-pre-wrap text-foreground">{request.excerpt}</p>
            </details>
            {(request.status === "pending" || changing === request.id) && (
              <DecisionForm
                request={request}
                editorDirty={editorDirty}
                onDone={changing === request.id ? () => setChanging(null) : undefined}
              />
            )}
          </RequestCard>
        ))}
      </CardContent>
    </Card>
  );
}

/** Earlier rounds, newest first: what was asked on each version and how the team answered. */
export function ReviewHistory({
  requests,
  before,
  now,
  audience,
}: {
  requests: ChangeRequestView[];
  before: number;
  now: string;
  /** The client reads about its own requests; the team about the client's. */
  audience: "client" | "team";
}) {
  const rounds = new Map<number, ChangeRequestView[]>();
  for (const request of requests)
    if (request.version < before && request.status !== "draft")
      rounds.set(request.version, [...(rounds.get(request.version) ?? []), request]);
  if (!rounds.size) return null;
  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title="Revisões"
          description={
            audience === "client"
              ? "O que você pediu em cada versão e a resposta da Anuntech."
              : "O que o cliente pediu em cada versão e a resposta da Anuntech."
          }
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {[...rounds.entries()]
          .sort(([a], [b]) => b - a)
          .map(([version, items]) => (
            <section key={version} className="flex flex-col gap-2">
              <h3 className="m-0 flex gap-x-3 text-caption font-medium text-muted-foreground">
                <span>Versão {version}</span>
                <span className="font-normal">{items.length === 1 ? "1 pedido" : `${items.length} pedidos`}</span>
              </h3>
              {items
                .sort((a, b) => a.blockIndex - b.blockIndex)
                .map((request) => (
                  <RequestCard key={request.id} request={request} now={now} showLabel />
                ))}
            </section>
          ))}
      </CardContent>
    </Card>
  );
}
