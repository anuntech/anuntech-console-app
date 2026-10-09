import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
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
  // The latest request is the one this bankRequest came from (a reissue asks again, with a new reference).
  const [requested] = await db
    .select({ at: auditEvents.createdAt })
    .from(auditEvents)
    .where(and(eq(auditEvents.entityId, invoiceId), eq(auditEvents.action, "invoice.bank_requested")))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1);
  const day = (requested?.at ?? invoice.createdAt).toISOString().slice(0, 10);
  const reference = typeof invoice.bankRequest.seuNumero === "string" ? invoice.bankRequest.seuNumero : bankReference(invoice.id);
  const matches: { codigoSolicitacao?: string; seuNumero?: string }[] = [];
  let pages = 1;
  // A busy day can take more than one page; a few pages cover it.
  for (let page = 0; page < Math.min(pages, 5); page++) {
    const params = new URLSearchParams({
      dataInicial: addDays(day, -1),
      dataFinal: addDays(day, 1),
      filtrarDataPor: "EMISSAO",
      itensPorPagina: "100",
      paginaAtual: String(page),
    });
    const result = (await interApi(`/cobranca/v3/cobrancas?${params}`)) as { cobrancas?: Listed[]; totalPaginas?: number } | null;
    pages = typeof result?.totalPaginas === "number" ? result.totalPaginas : 1;
    matches.push(
      ...(result?.cobrancas ?? []).map((item) => item.cobranca ?? item).filter((c) => c.seuNumero === reference && typeof c.codigoSolicitacao === "string"),
    );
  }
  if (matches.length !== 1)
    return {
      found: false,
      reason: matches.length
        ? "O Inter tem mais de uma cobrança com esta referência. Confira no Internet Banking."
        : "Não encontrada nesta busca, nas cobranças emitidas perto do dia do pedido. Confira no Internet Banking antes de cobrar de novo.",
    };
  await reconcileCharge(invoiceId, actorId, matches[0].codigoSolicitacao);
  return { found: true };
}

/**
 * From the 5-minute routine: up to 3 issues without an answer for 10+
 * minutes and from the last 7 days, each tried once an hour. Those already
 * tried this hour step aside, so a few that never reached the bank do not
 * keep the others waiting; older ones stay with the team's button.
 */
export async function locateUncertainCharges() {
  const hour = new Date().toISOString().slice(0, 13);
  const requestedAt = sql`coalesce((select max(a.created_at) from ${auditEvents} a where a.entity_id = ${invoices.id} and a.action = 'invoice.bank_requested'), ${invoices.createdAt})`;
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.bankStatus, "RESPOSTA_INDEFINIDA"),
        isNull(invoices.providerId),
        isNotNull(invoices.bankRequest),
        eq(invoices.bankBase, interBase()),
        sql`${requestedAt} < now() - interval '10 minutes'`,
        sql`${requestedAt} > now() - interval '7 days'`,
        sql`not exists (select 1 from ${automationEvents} ae where ae.kind = 'invoice.locate' and ae.entity_id = ${invoices.id} || ${`:${hour}`})`,
      ),
    )
    .orderBy(asc(requestedAt))
    .limit(3);
  let found = 0;
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
