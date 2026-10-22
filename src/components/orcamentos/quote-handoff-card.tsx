"use client";
import Link from "next/link";
import type { ComponentType } from "react";
import { CheckCircle2Icon, FolderKanbanIcon, FoldersIcon, HeadsetIcon, PackageIcon, ReceiptTextIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { ConfirmAction } from "@/components/console/server-form";
import { createProjectFromQuote } from "@/lib/quotes/quote-actions";
import type { QuoteStatus } from "@/lib/quotes/quote-model";

/** Staff: what an accepted proposal already became, and the request it answers. */
export type QuoteHandoff = {
  contract: { id: string; title: string; status: string } | null;
  project: { id: string; name: string } | null;
  upfrontInvoiceId: string | null;
  balanceInvoiceId: string | null;
  ticket: { id: string; subject: string; open: boolean } | null;
  /** Cards the project's first board would get, and whether the proposal had more. */
  cards: number;
  cut: boolean;
};

type Quote = { id: string; number: string; title: string; status: QuoteStatus; companyId: string };

const row = "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent";

function Step({ href, icon: Icon, label, done }: { href: string; icon: ComponentType<{ className?: string }>; label: string; done?: string }) {
  return (
    <Link href={href} className={row}>
      {done ? <CheckCircle2Icon className="size-4 shrink-0 text-success" /> : <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {done && <span className="block truncate text-xs text-muted-foreground">{done}</span>}
      </span>
    </Link>
  );
}

/** The reply the team can send in the client's request, ready in the ticket's box. */
function replyFor(quote: Quote, upfront: boolean) {
  switch (quote.status) {
    case "sent":
      return `Enviamos o orçamento ${quote.number}, ${quote.title}. Os Administradores da empresa recebem o aviso e respondem em Orçamentos, no Console. Se tiver alguma dúvida, responda por aqui.`;
    case "accepted":
      return `Recebemos o aceite do orçamento ${quote.number}. Agora preparamos o contrato${upfront ? " e a cobrança da entrada" : ""}; os próximos passos aparecem em Contratos${upfront ? " e Financeiro" : ""}.`;
    case "declined":
      return `Registramos a recusa do orçamento ${quote.number}. Se quiser ajustar o escopo ou o valor, responda por aqui e preparamos outra proposta.`;
    default:
      return null;
  }
}

export function QuoteHandoffCard({ quote, handoff, upfrontCents, balanceCents }: { quote: Quote; handoff: QuoteHandoff; upfrontCents: number; balanceCents: number }) {
  const accepted = quote.status === "accepted";
  const reply = handoff.ticket?.open ? replyFor(quote, upfrontCents > 0) : null;
  if (!accepted && !handoff.ticket) return null;
  return (
    <Card>
      <CardHeader>
        <SectionTitle
          title="Próximos passos"
          description={accepted ? "Cada passo abre preenchido, como rascunho." : undefined}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {handoff.ticket && (
          <Step href={`/chamados/${handoff.ticket.id}`} icon={HeadsetIcon} label="Pedido no chamado" done={handoff.ticket.subject} />
        )}
        {reply && (
          <Step href={`/chamados/${handoff.ticket!.id}?resposta=${encodeURIComponent(reply)}`} icon={HeadsetIcon} label="Responder no chamado com o texto pronto" />
        )}
        {accepted &&
          (handoff.contract ? (
            <Step href={`/contratos/${handoff.contract.id}`} icon={FoldersIcon} label="Contrato" done={handoff.contract.title} />
          ) : (
            <Step href={`/contratos/novo?orcamento=${quote.id}`} icon={FoldersIcon} label="Criar contrato deste orçamento" />
          ))}
        {accepted &&
          (handoff.project ? (
            // The project usually has the proposal's name, already the page title.
            <Step href={`/projetos/${handoff.project.id}`} icon={FolderKanbanIcon} label="Projeto" done={handoff.project.name === quote.title ? "Criado" : handoff.project.name} />
          ) : (
            <ConfirmAction
              action={createProjectFromQuote}
              fields={{ id: quote.id }}
              title="Criar o projeto deste orçamento?"
              description={`Cria o projeto "${quote.title}" com ${handoff.cards} cartões em A fazer: Acessos, Reunião de início e uma tarefa por item das fases, com o código e a fase como etiqueta.${handoff.cut ? " O orçamento tem mais tarefas do que cabem; as últimas ficam de fora." : ""} O cliente vê o projeto assim que ele é criado.`}
              confirmLabel="Criar projeto"
            >
              <button type="button" className={`${row} w-full text-left`}>
                <FolderKanbanIcon className="size-4 shrink-0 text-muted-foreground" />
                Criar projeto com o quadro das fases
              </button>
            </ConfirmAction>
          ))}
        {accepted &&
          upfrontCents > 0 &&
          (handoff.upfrontInvoiceId ? (
            <Step href={`/financeiro/${handoff.upfrontInvoiceId}`} icon={ReceiptTextIcon} label="Cobrança da entrada" done="Preparada" />
          ) : (
            <Step href={`/financeiro/nova?orcamento=${quote.id}&parte=entrada`} icon={ReceiptTextIcon} label="Preparar cobrança da entrada" />
          ))}
        {accepted &&
          balanceCents > 0 &&
          (handoff.balanceInvoiceId ? (
            <Step href={`/financeiro/${handoff.balanceInvoiceId}`} icon={ReceiptTextIcon} label="Cobrança do saldo" done="Preparada" />
          ) : (
            <Step href={`/financeiro/nova?orcamento=${quote.id}&parte=saldo`} icon={ReceiptTextIcon} label="Preparar cobrança do saldo" />
          ))}
        {accepted && <Step href={`/produtos/novo?companyId=${quote.companyId}`} icon={PackageIcon} label="Vincular produto ou serviço" />}
      </CardContent>
    </Card>
  );
}
