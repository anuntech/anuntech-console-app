"use client";
import Link from "next/link";
import { useState } from "react";
import { BanIcon, PhoneCallIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopyButton } from "@/components/console/copy-button";
import { EmptyState, SectionTitle } from "@/components/console/page-header";
import { DateField } from "@/components/console/date-field";
import { FormField } from "@/components/console/form-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { registerCollectionContact } from "@/lib/billing/collection-actions";
import type { CollectionCase } from "@/lib/billing/collections";
import { currency, dateLabel, dateTimeLabel } from "@/lib/format";
import { EngagementStatusBadge } from "@/components/projetos/project-badges";
import { SuspensionStageBadge, useSuspension } from "@/components/produtos/suspension";
import type { SuspensionView } from "@/lib/suspensions/suspension-view";

/** An overdue client's product, to suspend from here (lib/suspensions). */
export type CollectionProduct = { id: string; name: string; status: string; companyId: string; appPage: string | null; suspension?: SuspensionView };

const channel: Record<string, string> = { email: "e-mail", whatsapp: "WhatsApp" };

function ContactDialog({ item, open, onOpenChange }: { item: CollectionCase; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [promise, setPromise] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ServerForm action={registerCollectionContact} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5">
          <input type="hidden" name="companyId" value={item.companyId} />
          <DialogHeader>
            <DialogTitle>Registrar contato</DialogTitle>
            <DialogDescription>{item.company}</DialogDescription>
          </DialogHeader>
          <FormError />
          <FormField label="O que foi combinado" htmlFor={`note-${item.companyId}`}>
            <Textarea id={`note-${item.companyId}`} name="note" required maxLength={1000} rows={3} placeholder="Ex.: falou com o financeiro, paga na sexta por Pix" />
          </FormField>
          <FormField label="Data combinada para o pagamento" htmlFor={`promise-${item.companyId}`} hint="Até essa data a empresa fica em Aguardando a data e sai do resumo e do painel. Vazio: sem data.">
            <DateField id={`promise-${item.companyId}`} name="promiseDate" value={promise} onChange={setPromise} placeholder="Sem data" />
          </FormField>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <SubmitButton pendingLabel="Salvando…">Registrar</SubmitButton>
          </DialogFooter>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}

type Marked = { id: string; description: string; company: string; amountCents: number; dueDate: string };

/** One card per overdue client: what is owed, what the contract allows, what was agreed, and a text to adapt. */
export function CollectionsList({
  cases,
  products,
  marked,
  expired,
}: {
  cases: CollectionCase[];
  products: CollectionProduct[];
  marked: Marked[];
  expired: { n: number; cents: number };
}) {
  const [contact, setContact] = useState<CollectionCase | null>(null);
  const suspension = useSuspension(products);
  const cards = (list: CollectionCase[]) => <CaseCards cases={list} products={products} onContact={setContact} onSuspend={suspension.open} />;
  const open = cases.filter((item) => !item.waitingPromise);
  const waiting = cases.filter((item) => item.waitingPromise);
  return (
    <div className="flex flex-col gap-6">
      {expired.n > 0 && (
        <p className="m-0 rounded-lg border border-warning-edge bg-warning-soft px-3 py-2 text-sm text-warning">
          {expired.n === 1 ? "1 fatura expirou" : `${expired.n} faturas expiraram`} no Inter sem pagamento ({currency(expired.cents)}) e {expired.n === 1 ? "não aparece" : "não aparecem"} aqui.{" "}
          <Link href="/financeiro?status=expired" className="font-medium underline underline-offset-2">
            Cobrar de novo pela fatura
          </Link>
        </p>
      )}
      {!open.length && !waiting.length && (
        <Card className="reveal-fade py-0 [--i:1]">
          <EmptyState
            art="faturas"
            title="Nenhum cliente com boleto vencido"
            description="Quem passar do vencimento sem pagar aparece aqui, com o que foi combinado e um texto para cobrar."
          />
        </Card>
      )}
      {open.length > 0 && cards(open)}
      {waiting.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle title="Aguardando a data combinada" />
          {cards(waiting)}
        </section>
      )}
      {marked.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle
            title="Marcadas como recebidas no Inter"
            description="Alguém deu baixa fora do boleto. Confirme o recebimento na fatura; se o dinheiro não entrou, cancele e cobre de novo."
          />
          <Card className="py-2">
            <CardContent className="px-0">
              <ul className="m-0 grid list-none p-0">
                {marked.map((invoice) => (
                  <li key={invoice.id}>
                    <Link href={`/financeiro/${invoice.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-6 py-2.5 text-sm transition-colors hover:bg-accent">
                      <span className="min-w-0">
                        <span className="block text-foreground">{invoice.description}</span>
                        <span className="block text-xs text-muted-foreground">{invoice.company}</span>
                      </span>
                      <span className="flex gap-x-3 text-muted-foreground tabular-nums">
                        <span className="font-medium text-foreground">{currency(invoice.amountCents)}</span>
                        <span>venceu em {dateLabel(invoice.dueDate)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
      {contact && <ContactDialog key={contact.companyId} item={contact} open onOpenChange={(open) => !open && setContact(null)} />}
      {suspension.element}
    </div>
  );
}

function CaseCards({
  cases,
  products,
  onContact,
  onSuspend,
}: {
  cases: CollectionCase[];
  products: CollectionProduct[];
  onContact: (item: CollectionCase) => void;
  onSuspend: (product: CollectionProduct) => void;
}) {
  return (
    // One card per client, arriving in turn on the first load.
    <div className="stagger flex flex-col gap-4">
      {cases.map((item) => (
        <Card key={item.companyId}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/empresas/${item.companyId}`} className="text-body font-medium text-foreground transition-colors hover:text-primary">
                {item.company}
              </Link>
              {/* Separate items, not "a · b": a wrapped line never starts with a dot. */}
              <p className="m-0 mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                <span className="text-title-sm text-foreground tabular-nums">{currency(item.totalCents)}</span>
                <span className="text-destructive">{item.oldestDays === 1 ? "1 dia" : `${item.oldestDays} dias`} de atraso</span>
                {item.archived ? <span>Cliente arquivado</span> : item.oldestDays > 25 ? <span>Lembretes automáticos encerrados</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={item.message} variant="outline" size="sm" label="Texto copiado">
                Copiar texto
              </CopyButton>
              <Button size="sm" onClick={() => onContact(item)}>
                <PhoneCallIcon />
                Registrar contato
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-3 text-sm">
            <ul className="m-0 grid list-none gap-1 p-0">
              {item.invoices.map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                  <Link href={`/financeiro/${invoice.id}`} className="min-w-0 truncate text-foreground transition-colors hover:text-primary">
                    {invoice.description}
                  </Link>
                  <span className="flex gap-x-3 text-muted-foreground tabular-nums">
                    <span className="text-foreground">{currency(invoice.amountCents)}</span>
                    <span>venceu em {dateLabel(invoice.dueDate)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid gap-1 text-xs text-muted-foreground">
              <span>
                {item.suspension
                  ? `Contrato: suspensão depois de ${item.suspension.days} dias de atraso${item.suspension.notice ? ", com aviso" : ""}${item.suspension.clause ? ` (cláusula ${item.suspension.clause})` : ""}.${item.canSuspend ? " Já passou desse prazo." : ""}`
                  : "Sem condições publicadas sobre suspensão."}
              </span>
              <span>{item.lastNotice ? `Último aviso por ${channel[item.lastNotice.channel] ?? item.lastNotice.channel} em ${dateTimeLabel(item.lastNotice.at)}.` : "Nenhum aviso entregue."}</span>
              {item.contact && (
                <span className="text-foreground">
                  {`Último contato: ${dateTimeLabel(item.contact.at)}, ${item.contact.who}. ${item.contact.note}`}
                  {item.contact.promiseDate ? ` Pagamento combinado para ${dateLabel(item.contact.promiseDate)}.` : ""}
                </span>
              )}
            </div>
            {!item.archived && products.some((p) => p.companyId === item.companyId) && (
              <ul className="m-0 grid list-none gap-1.5 border-t p-0 pt-3">
                {products
                  .filter((p) => p.companyId === item.companyId)
                  .map((product) => (
                    <li key={product.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="truncate text-foreground">{product.name}</span>
                        {product.status !== "active" && <EngagementStatusBadge status={product.status} />}
                        <SuspensionStageBadge suspension={product.suspension} />
                      </span>
                      <Button size="sm" variant="outline" onClick={() => onSuspend(product)}>
                        <BanIcon />
                        {product.suspension ? "Ver suspensão" : "Suspender…"}
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
            <details className="rounded-lg border bg-field/60 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Texto sugerido para enviar</summary>
              <p className="m-0 mt-2 text-sm whitespace-pre-line [overflow-wrap:anywhere] text-foreground">{item.message}</p>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
