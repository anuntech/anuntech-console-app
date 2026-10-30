import "server-only";
import { and, eq } from "drizzle-orm";
import { automationEvents, companies, contracts, quotes, type DecisionStep } from "@/db/schema";
import { db } from "../db";
import { currency } from "../format";
import { quoteNumberLabel, quoteTotals } from "../quotes/quote-model";
import { openDecision } from "../decisions/decisions";
import { collectionDraft } from "../decisions/collection-draft";
import type { PendingEvent } from "./events";

/*
 * What each event does: it opens a decision for the team, never the change
 * itself. A type without a handler is only recorded.
 */

const step = (key: string, label: string, kind: DecisionStep["kind"], href: string): DecisionStep => ({ key, label, kind, href, done: false });

async function quoteAccepted(event: PendingEvent) {
  const [q] = await db
    .select({ quote: quotes, company: companies.name })
    .from(quotes)
    .innerJoin(companies, eq(companies.id, quotes.companyId))
    .where(eq(quotes.id, event.entityId));
  if (!q || q.quote.status !== "accepted") return;
  const accepted = q.quote.publication ?? { ...q.quote.content, title: q.quote.title };
  const totals = quoteTotals(accepted);
  const number = quoteNumberLabel(q.quote.year, q.quote.seq);
  const steps = [
    step("project", "Criar o projeto com as fases do orçamento", "action", `/orcamentos/${q.quote.id}`),
    step("contract", "Preparar o contrato a partir do orçamento", "link", `/contratos/novo?orcamento=${q.quote.id}`),
    ...(totals.upfrontCents > 0 ? [step("upfront", "Preparar a cobrança da entrada", "link", `/financeiro/nova?orcamento=${q.quote.id}&parte=entrada`)] : []),
  ];
  await openDecision({
    kind: "quote.start",
    entityId: q.quote.id,
    companyId: q.quote.companyId,
    eventId: event.id,
    title: `Começar o trabalho com ${q.company}`,
    reason: `O orçamento ${number} foi aceito.`,
    details: [
      { label: "Orçamento", value: `${number} · ${accepted.title}` },
      ...(totals.totalCents ? [{ label: "Total", value: currency(totals.totalCents) }] : []),
      ...(totals.upfrontCents ? [{ label: "Entrada", value: currency(totals.upfrontCents) }] : []),
    ],
    steps,
  });
}

async function contractSigned(event: PendingEvent) {
  const [c] = await db
    .select({ contract: contracts, company: companies.name })
    .from(contracts)
    .innerJoin(companies, eq(companies.id, contracts.companyId))
    .where(eq(contracts.id, event.entityId));
  if (!c?.contract.quoteId || c.contract.kind !== "contract") return;
  const [q] = await db.select().from(quotes).where(eq(quotes.id, c.contract.quoteId));
  if (!q) return;
  const accepted = q.publication ?? { ...q.content, title: q.title };
  const totals = quoteTotals(accepted);
  if (!totals.upfrontCents) return;
  const [prepared] = await db
    .select({ details: automationEvents.details })
    .from(automationEvents)
    .where(and(eq(automationEvents.kind, "quote.upfront"), eq(automationEvents.entityId, q.id)));
  const invoiceId = (prepared?.details as { invoiceId?: string } | null)?.invoiceId;
  await openDecision({
    kind: "contract.upfront",
    entityId: c.contract.id,
    companyId: c.contract.companyId,
    eventId: event.id,
    title: `Emitir a entrada de ${c.company}`,
    reason: `O contrato “${c.contract.title}” foi assinado pelas duas partes.`,
    details: [
      { label: "Orçamento", value: `${quoteNumberLabel(q.year, q.seq)} · ${accepted.title}` },
      { label: "Entrada", value: currency(totals.upfrontCents) },
    ],
    steps: [
      invoiceId
        ? step("issue", "Conferir e emitir a cobrança da entrada", "link", `/financeiro/${invoiceId}`)
        : step("issue", "Preparar e emitir a cobrança da entrada", "link", `/financeiro/nova?orcamento=${q.id}&parte=entrada`),
    ],
  });
}

async function invoiceOverdue(event: PendingEvent) {
  const payload = event.payload as { companyId: string; message: string; oldestDays: number; invoices: number; totalCents: number; contactNote?: string | null; archived?: boolean };
  const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, payload.companyId));
  if (!company) return;
  const draft = await collectionDraft({
    message: payload.message,
    oldestDays: payload.oldestDays,
    invoices: payload.invoices,
    contactNote: payload.contactNote ?? null,
    archived: !!payload.archived,
  });
  await openDecision({
    kind: "invoice.collect",
    entityId: event.entityId,
    companyId: payload.companyId,
    eventId: event.id,
    title: `Cobrar ${company.name}`,
    reason: `${payload.invoices === 1 ? "Uma fatura vencida" : `${payload.invoices} faturas vencidas`} há ${payload.oldestDays} dias, sem contato registrado depois disso.`,
    details: [{ label: "Em aberto", value: currency(payload.totalCents) }],
    steps: [step("contact", "Enviar a mensagem e registrar o contato em Atrasos", "link", "/financeiro/atrasos")],
    draft: draft.text,
  });
}

const HANDLERS: Partial<Record<string, (event: PendingEvent) => Promise<void>>> = {
  "quote.accepted": quoteAccepted,
  "contract.signed": contractSigned,
  "invoice.overdue": invoiceOverdue,
};

export async function handleEvent(event: PendingEvent) {
  await HANDLERS[event.type]?.(event);
}
