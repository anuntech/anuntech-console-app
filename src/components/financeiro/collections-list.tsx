"use client";
import Link from "next/link";
import { useState } from "react";
import { PhoneCallIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopyButton } from "@/components/console/copy-button";
import { DateField } from "@/components/console/date-field";
import { FormField } from "@/components/console/form-field";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { registerCollectionContact } from "@/lib/billing/collection-actions";
import type { CollectionCase } from "@/lib/billing/collections";
import { currency, dateLabel, dateTimeLabel } from "@/lib/format";

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
export function CollectionsList({ cases, marked, expired }: { cases: CollectionCase[]; marked: Marked[]; expired: { n: number; cents: number } }) {
  const [contact, setContact] = useState<CollectionCase | null>(null);
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
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum cliente com boleto vencido.</CardContent>
        </Card>
      )}
      {open.length > 0 && <CaseCards cases={open} onContact={setContact} />}
      {waiting.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="m-0 text-sm font-semibold text-foreground">Aguardando a data combinada</h2>
          <CaseCards cases={waiting} onContact={setContact} />
        </section>
      )}
      {marked.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="m-0 text-sm font-semibold text-foreground">Marcadas como recebidas no Inter</h2>
            <p className="m-0 text-xs text-muted-foreground">Alguém deu baixa fora do boleto. Confirme o recebimento na fatura; se o dinheiro não entrou, cancele e cobre de novo.</p>
          </div>
          <Card className="py-2">
            <CardContent className="px-0">
              <ul className="m-0 grid list-none p-0">
                {marked.map((invoice) => (
                  <li key={invoice.id}>
                    <Link href={`/financeiro/${invoice.id}`} className="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 text-sm hover:bg-accent">
                      <span className="min-w-0 text-foreground">
                        {invoice.company} · {invoice.description}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {currency(invoice.amountCents)} · venceu em {dateLabel(invoice.dueDate)}
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
    </div>
  );
}

function CaseCards({ cases, onContact }: { cases: CollectionCase[]; onContact: (item: CollectionCase) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {cases.map((item) => (
        <Card key={item.companyId}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/empresas/${item.companyId}`} className="text-base font-semibold text-foreground hover:text-primary">
                {item.company}
              </Link>
              <p className="m-0 text-sm text-muted-foreground">
                {currency(item.totalCents)} · {item.oldestDays === 1 ? "1 dia" : `${item.oldestDays} dias`} de atraso
                {item.archived ? " · cliente arquivado" : item.oldestDays > 25 ? " · lembretes automáticos encerrados" : ""}
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
                <li key={invoice.id} className="flex flex-wrap justify-between gap-2">
                  <Link href={`/financeiro/${invoice.id}`} className="min-w-0 truncate text-foreground hover:text-primary">
                    {invoice.description}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">
                    {currency(invoice.amountCents)} · venceu em {dateLabel(invoice.dueDate)}
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
