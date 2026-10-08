"use client";
import Link from "next/link";
import type { ComponentType } from "react";
import { CalculatorIcon, CheckCircle2Icon, ClockIcon, FilePlusIcon, ReceiptTextIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { ConfirmAction } from "@/components/console/server-form";
import { prepareServiceTerms } from "@/lib/service-terms/terms-actions";

/** Staff, on a signed contract: the proposal behind it and what is ready to prepare from it. */
export type ContractHandoff = {
  quote: { id: string; label: string } | null;
  /** The item's recurrence: running, prepared as a draft, or ready to prepare (null: nothing to bill). */
  recurrence: { state: "active" | "prepared"; href: string | null } | { state: "ready" } | null;
  /** Conditions of service: already there, or ready from the template's ficha (null: no ficha). */
  terms: { state: "exists"; href: string; confirmed: boolean } | { state: "ready"; label: string } | null;
  /** Within 30 days of the end: an extension in progress, or ready to prepare. */
  renewal: { state: "pending"; href: string } | { state: "ready" } | null;
};

const row = "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent";

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

export function ContractHandoffCard({ contractId, handoff }: { contractId: string; handoff: ContractHandoff }) {
  const { quote, recurrence, terms, renewal } = handoff;
  if (!quote && !recurrence && !terms && !renewal) return null;
  return (
    <Card>
      <CardHeader>
        <SectionTitle title="A partir deste contrato" description="Cada passo sai preenchido e nasce como rascunho para você conferir." />
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {quote && <Step href={`/orcamentos/${quote.id}`} icon={CalculatorIcon} label="Orçamento de origem" done={quote.label} />}
        {recurrence &&
          (recurrence.state === "ready" ? (
            <Step href={`/financeiro/nova?contrato=${contractId}`} icon={ReceiptTextIcon} label="Preparar a cobrança recorrente" />
          ) : recurrence.href ? (
            <Step
              href={recurrence.href}
              icon={ReceiptTextIcon}
              label="Cobrança recorrente"
              done={recurrence.state === "active" ? "Já existe para este item" : "Preparada como rascunho"}
            />
          ) : (
            <p className={`${row} text-muted-foreground hover:bg-transparent`}>
              <CheckCircle2Icon className="size-4 shrink-0 text-success" />
              Cobrança recorrente já existe para este item
            </p>
          ))}
        {terms &&
          (terms.state === "exists" ? (
            terms.confirmed ? (
              <Step href={terms.href} icon={ClockIcon} label="Condições de atendimento" done="Conferidas a partir deste contrato" />
            ) : (
              <Link href={terms.href} className={row}>
                <ClockIcon className="size-4 shrink-0 text-warning" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">Condições de atendimento</span>
                  <span className="block truncate text-xs text-muted-foreground">Rascunho: conferir com o contrato assinado</span>
                </span>
              </Link>
            )
          ) : (
            <ConfirmAction
              action={prepareServiceTerms}
              fields={{ contractId }}
              title="Preparar as condições de atendimento?"
              description={`Cria as condições em rascunho com a ficha ${terms.label}, ligadas a este contrato. Ajuste o que foi negociado e confira com o texto assinado: só depois elas valem para os chamados.`}
              confirmLabel="Preparar condições"
            >
              <button type="button" className={row}>
                <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
                Preparar condições de atendimento
              </button>
            </ConfirmAction>
          ))}
        {renewal &&
          (renewal.state === "pending" ? (
            <Step href={renewal.href} icon={FilePlusIcon} label="Prorrogação" done="Aditivo em andamento" />
          ) : (
            <Step href={`/contratos/novo?parentId=${contractId}&prorrogar=1`} icon={FilePlusIcon} label="Preparar prorrogação" />
          ))}
      </CardContent>
    </Card>
  );
}
