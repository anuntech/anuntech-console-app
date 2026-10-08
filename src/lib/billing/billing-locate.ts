import "server-only";
import { and, asc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { auditEvents, automationEvents, invoices } from "@/db/schema";
import { db } from "../db";
import { addDays } from "./recurrence";
import { interApi, interBase } from "../integrations/integrations";
import { bankReference } from "./billing-rules";
import { reconcileCharge } from "./billing-sync";

/*
 * An issue whose answer never came ("Sem resposta do banco"): the request
 * may or may not have become a charge. This only reads the bank: it lists
 * the charges issued around that day, looks for the one with this invoice's
 * reference, and hands its id to the usual reconciliation, which checks
 * reference, amount and payer before linking. Nothing is issued here.
 */

type Listed = { cobranca?: { codigoSolicitacao?: string; seuNumero?: string }; codigoSolicitacao?: string; seuNumero?: string };

export async function locateUncertainCharge(invoiceId: string, actorId?: string): Promise<{ found: boolean; reason?: string }> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice?.bankRequest || invoice.providerId || invoice.bankStatus !== "RESPOSTA_INDEFINIDA" || invoice.bankBase !== interBase())
    return { found: false, reason: "Esta fatura não está esperando resposta do banco." };
  const [requested] = await db
    .select({ at: auditEvents.createdAt })
    .from(auditEvents)
    .where(and(eq(auditEvents.entityId, invoiceId), eq(auditEvents.action, "invoice.bank_requested")))
    .orderBy(asc(auditEvents.createdAt))
    .limit(1);
  const day = (requested?.at ?? invoice.createdAt).toISOString().slice(0, 10);
  const reference = typeof invoice.bankRequest.seuNumero === "string" ? invoice.bankRequest.seuNumero : bankReference(invoice.id);
  const params = new URLSearchParams({
    dataInicial: addDays(day, -1),
    dataFinal: addDays(day, 1),
    filtrarDataPor: "EMISSAO",
    itensPorPagina: "100",
    paginaAtual: "0",
  });
  const result = (await interApi(`/cobranca/v3/cobrancas?${params}`)) as { cobrancas?: Listed[] } | null;
  const matches = (result?.cobrancas ?? [])
    .map((item) => item.cobranca ?? item)
    .filter((c) => c.seuNumero === reference && typeof c.codigoSolicitacao === "string");
  if (matches.length !== 1)
    return { found: false, reason: matches.length ? "O Inter tem mais de uma cobrança com esta referência. Confira no Internet Banking." : "O Inter não tem cobrança com esta referência nesses dias." };
  await reconcileCharge(invoiceId, actorId, matches[0].codigoSolicitacao);
  return { found: true };
}

/** From the 5-minute routine: up to 3 issues without an answer for 10+ minutes, each tried once an hour. */
export async function locateUncertainCharges() {
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.bankStatus, "RESPOSTA_INDEFINIDA"),
        isNull(invoices.providerId),
        isNotNull(invoices.bankRequest),
        eq(invoices.bankBase, interBase()),
        lt(invoices.createdAt, sql`now() - interval '10 minutes'`),
      ),
    )
    .limit(3);
  let found = 0;
  const hour = new Date().toISOString().slice(0, 13);
  for (const row of rows) {
    const [claimed] = await db
      .insert(automationEvents)
      .values({ kind: "invoice.locate", entityId: `${row.id}:${hour}` })
      .onConflictDoNothing()
      .returning({ id: automationEvents.id });
    if (!claimed) continue;
    try {
      if ((await locateUncertainCharge(row.id)).found) found += 1;
    } catch (error) {
      console.warn("[billing-locate] skipped", error instanceof Error ? error.message : error);
    }
  }
  return found;
}
