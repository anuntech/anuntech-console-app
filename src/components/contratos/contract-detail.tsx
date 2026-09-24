"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Building2Icon,
  CheckCircle2Icon,
  CircleDashedIcon,
  DownloadIcon,
  FileSignatureIcon,
  MoreHorizontalIcon,
  SendIcon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Fact } from "@/components/console/fact";
import { CopyButton } from "@/components/console/copy-button";
import { DownloadLink } from "@/components/console/download-link";
import {
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { cancelContract, saveContract, sendContract, signContract } from "@/lib/contract-actions";
import { auditLabels, dateTimeLabel, relativeLabel } from "@/lib/format";
import { formatDocument } from "@/lib/company-input";
import type { ContractStatus } from "@/lib/contract-table";
import { ContractStatusBadge } from "./contract-badges";

export type ContractDetailData = {
  contract: {
    id: string;
    title: string;
    body: string;
    status: ContractStatus;
    revision: number;
    companyId: string;
    company: string;
    companyDocument: string;
    engagement: string | null;
    template: string | null;
    documentHash: string | null;
    sentAt: string | null;
    signedAt: string | null;
    createdAt: string;
    pendingVariables: string[];
  };
  signatures: {
    party: "client" | "anuntech";
    name: string;
    email: string;
    signedAt: string;
    ip: string | null;
  }[];
  viewer: { admin: boolean; party: "anuntech" | "client" | null; name: string };
  events: { id: string; action: string; createdAt: string }[];
  now: string;
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

export function ContractDetail({ data }: { data: ContractDetailData }) {
  const { contract: c, signatures, viewer, events, now } = data;
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [consent, setConsent] = useState(false);
  const signed = (party: "client" | "anuntech") => signatures.find((s) => s.party === party);
  const canSign = c.status === "sent" && viewer.party !== null && !signed(viewer.party);
  const editable = viewer.admin && c.status === "draft";
  const pdfHref = `/api/contratos/${c.id}/pdf`;
  const paragraphs = c.body.split("\n\n");
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Contratos", href: "/contratos" }, { label: c.title }]}
        title={c.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ContractStatusBadge status={c.status} />
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
              <Button variant="outline" asChild>
                <DownloadLink href={pdfHref} filename={`${c.title}.pdf`}>
                  <DownloadIcon />
                  {c.status === "signed" ? "Baixar PDF assinado" : "Baixar PDF"}
                </DownloadLink>
              </Button>
            )}
            {viewer.admin && c.status === "draft" && (
              <Button onClick={() => setSending(true)}>
                <SendIcon />
                Enviar para assinatura
              </Button>
            )}
            {viewer.admin && (c.status === "draft" || c.status === "sent") && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Mais ações">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href={`/empresas/${c.companyId}`}>
                      <Building2Icon />
                      Ver empresa
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setTimeout(() => setCancelling(true), 0)}
                  >
                    <XCircleIcon />
                    Cancelar contrato
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {editable ? (
            <Card>
              <ServerForm key={c.revision} action={saveContract} className="contents">
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="revision" value={c.revision} />
                <CardHeader>
                  <SectionTitle
                    title="Texto do contrato"
                    description="Revise o que veio do modelo. Quebras de linha viram parágrafos no PDF."
                  />
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <FormError />
                  {c.pendingVariables.length > 0 && (
                    <div
                      role="status"
                      className="flex items-start gap-3 rounded-lg border border-warning-edge bg-warning-soft px-4 py-3 text-sm text-warning"
                    >
                      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                      <span>
                        Campos sem valor no texto: {c.pendingVariables.join(", ")}. Preencha ou remova antes de enviar.
                      </span>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="contract-title" className="mb-1.5">
                      Título
                    </Label>
                    <Input id="contract-title" name="title" required maxLength={160} defaultValue={c.title} />
                  </div>
                  <div>
                    <Label htmlFor="contract-body" className="mb-1.5">
                      Texto
                    </Label>
                    <Textarea
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
                  title="Texto do contrato"
                  description={
                    c.status === "signed"
                      ? "Versão assinada. O hash abaixo identifica este texto."
                      : c.status === "sent"
                        ? "Texto enviado para assinatura. Não muda mais."
                        : undefined
                  }
                />
              </CardHeader>
              <CardContent>
                <article className="max-w-[72ch] font-serif text-[15px] leading-7 text-foreground">
                  {paragraphs.map((paragraph, index) => (
                    <p key={index} className={cn("whitespace-pre-wrap", index > 0 && "mt-4")}>
                      {paragraph || " "}
                    </p>
                  ))}
                </article>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle
                title="Assinaturas"
                description={
                  c.status === "signed"
                    ? "Assinado pelas duas partes."
                    : c.status === "sent"
                      ? "Cada parte assina com o próprio acesso ao Console."
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
                      Li o contrato e concordo com todos os termos, assinando como{" "}
                      <span className="font-medium">{viewer.name}</span>
                      {viewer.party === "client" ? ` por ${c.company}` : " pela Anuntech"}.
                    </span>
                  </label>
                  <SubmitButton disabled={!consent} pendingLabel="Assinando…">
                    <FileSignatureIcon />
                    Assinar contrato
                  </SubmitButton>
                  <p className="text-xs text-muted-foreground">
                    Ficam registrados seu nome, e-mail, data, IP e o hash do texto.
                  </p>
                </ServerForm>
              )}
            </CardContent>
          </Card>

          {c.documentHash && (
            <Card>
              <CardHeader>
                <SectionTitle title="Documento" />
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4">
                  {c.sentAt && <Fact label="Enviado em">{dateTimeLabel(c.sentAt)}</Fact>}
                  {c.signedAt && <Fact label="Concluído em">{dateTimeLabel(c.signedAt)}</Fact>}
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
        title="Enviar para assinatura?"
        description="O texto é congelado e o cliente recebe um aviso por e-mail para ler e assinar no Console. Depois disso, o texto não muda mais."
        confirmLabel="Enviar"
      />
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        action={cancelContract}
        fields={{ id: c.id }}
        title="Cancelar contrato?"
        description="Ele deixa de aparecer para o cliente. Assinaturas já dadas continuam registradas."
        confirmLabel="Cancelar contrato"
        destructive
      />
    </>
  );
}
