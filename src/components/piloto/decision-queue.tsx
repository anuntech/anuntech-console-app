"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRightIcon, CheckIcon, XIcon } from "lucide-react";
import type { DecisionStep } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopyButton } from "@/components/console/copy-button";
import { EmptyState } from "@/components/console/page-header";
import { FormField } from "@/components/console/form-field";
import { ConfirmAction, FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { dismissDecision, runDecisionStep } from "@/lib/decisions/decision-actions";
import { dateLabel } from "@/lib/format";

export type QueueItem = {
  id: string;
  kind: string;
  title: string;
  reason: string;
  company: string | null;
  companyId: string | null;
  details: { label: string; value: string }[];
  steps: DecisionStep[];
  draft: string | null;
  createdAt: string;
  expiresAt: string;
};

/** What each "Fazer agora" confirms before running: it reaches the client. */
const CONFIRM: Record<string, { title: string; description: string; label: string }> = {
  "quote.start:project": {
    title: "Criar o projeto?",
    description: "O cliente vê o projeto e o quadro assim que ele é criado, mesmo antes de o contrato ser assinado. Os cartões saem das fases e tarefas do orçamento.",
    label: "Criar projeto",
  },
};

function DismissDialog({ item, open, onOpenChange }: { item: QueueItem; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ServerForm action={dismissDecision} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={item.id} />
          <DialogHeader>
            <DialogTitle>Dispensar esta decisão</DialogTitle>
            <DialogDescription>{item.title}</DialogDescription>
          </DialogHeader>
          <FormError />
          <FormField label="Por que não se aplica" htmlFor={`reason-${item.id}`}>
            <Textarea id={`reason-${item.id}`} name="reason" required minLength={3} maxLength={300} rows={3} placeholder="Ex.: o cliente pediu para começar só em janeiro" />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <SubmitButton pendingLabel="Salvando…">Dispensar</SubmitButton>
          </DialogFooter>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}

/** One card per decision: why it showed up, what it is about, its steps in order and the draft to use. */
export function DecisionQueue({ items }: { items: QueueItem[] }) {
  const [dismissing, setDismissing] = useState<QueueItem | null>(null);
  if (!items.length)
    return (
      <Card className="reveal-fade py-0 [--i:1]">
        <EmptyState
          size="compact"
          title="Nada esperando aprovação"
          description="Quando um orçamento for aceito, um contrato assinado ou uma fatura passar do vencimento, os próximos passos aparecem aqui, já preparados."
        />
      </Card>
    );
  return (
    <div className="stagger flex flex-col gap-4">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-body font-medium text-foreground">{item.title}</p>
              <p className="m-0 mt-1 text-sm text-muted-foreground">
                {item.reason} Vale até {dateLabel(new Date(item.expiresAt))}.
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDismissing(item)}>
              <XIcon />
              Dispensar
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-4 text-sm">
            {item.details.length > 0 && (
              <dl className="m-0 grid gap-1 sm:grid-cols-[max-content_1fr] sm:gap-x-6">
                {item.details.map((detail) => (
                  <div key={detail.label} className="contents">
                    <dt className="text-muted-foreground">{detail.label}</dt>
                    <dd className="m-0 text-foreground [overflow-wrap:anywhere]">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <ol className="m-0 grid list-none gap-2 border-t p-0 pt-3">
              {item.steps.map((step, index) => {
                const confirm = CONFIRM[`${item.kind}:${step.key}`];
                return (
                  <li key={step.key} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={
                          step.done
                            ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success [&_svg]:size-3.5"
                            : "flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground tabular-nums"
                        }
                      >
                        {step.done ? <CheckIcon /> : index + 1}
                      </span>
                      <span className={step.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground"}>{step.label}</span>
                    </span>
                    {!step.done &&
                      (step.kind === "action" && confirm ? (
                        <ConfirmAction action={runDecisionStep} fields={{ id: item.id, step: step.key }} title={confirm.title} description={confirm.description} confirmLabel={confirm.label}>
                          <Button size="sm">Fazer agora</Button>
                        </ConfirmAction>
                      ) : (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={step.href}>
                            Abrir
                            <ArrowUpRightIcon />
                          </Link>
                        </Button>
                      ))}
                  </li>
                );
              })}
            </ol>
            {item.draft && (
              <div className="grid gap-2 rounded-lg border bg-field/60 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Texto preparado para enviar. Leia e ajuste antes.</span>
                  <CopyButton value={item.draft} variant="outline" size="sm" label="Texto copiado">
                    Copiar texto
                  </CopyButton>
                </div>
                <p className="m-0 text-sm whitespace-pre-line [overflow-wrap:anywhere] text-foreground">{item.draft}</p>
              </div>
            )}
            {item.companyId && item.company && (
              <Link href={`/empresas/${item.companyId}`} className="justify-self-start text-xs text-muted-foreground transition-colors hover:text-primary">
                {item.company}
              </Link>
            )}
          </CardContent>
        </Card>
      ))}
      {dismissing && <DismissDialog key={dismissing.id} item={dismissing} open onOpenChange={(open) => !open && setDismissing(null)} />}
    </div>
  );
}
