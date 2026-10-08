import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { catalogItems, companies, contracts, engagements, environmentProfile, memberships, quotes, subscriptions, user } from "@/db/schema";
import { db } from "../db";
import { addressLabel } from "../companies/company-billing";
import { formatDocument } from "../companies/company-input";
import { currency, longDateLabel } from "../format";
import { quoteNumberLabel, quoteTotals } from "../quotes/quote-model";

/**
 * What the Console already knows for a contract's open fields, offered as
 * one-tap suggestions in the draft editor (never written on its own): the
 * company and its item, the latest proposal it accepted, and who answers
 * for each side.
 */
export type FieldSuggestion = { value: string; source: string };

type Draft = Pick<typeof contracts.$inferSelect, "companyId" | "engagementId" | "startsAt" | "endsAt" | "parentId">;

export async function contractFieldSuggestions(
  contract: Draft,
  author: { name: string; email: string },
  keys: string[],
): Promise<Record<string, FieldSuggestion>> {
  if (!keys.length) return {};
  const wanted = new Set(keys);
  const [[company], [anuntech], [item], [quote], managers, [parent]] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, contract.companyId)),
    db.select().from(environmentProfile).limit(1),
    contract.engagementId
      ? db
          .select({
            name: engagements.name,
            amountCents: engagements.amountCents,
            interval: subscriptions.interval,
            catalogInterval: catalogItems.interval,
          })
          .from(engagements)
          .leftJoin(subscriptions, eq(subscriptions.id, engagements.subscriptionId))
          .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
          .where(and(eq(engagements.id, contract.engagementId), eq(engagements.companyId, contract.companyId)))
      : Promise.resolve([]),
    // The proposal behind the contract: the latest accepted, else the latest still open.
    db
      .select()
      .from(quotes)
      .where(and(eq(quotes.companyId, contract.companyId), inArray(quotes.status, ["accepted", "sent"])))
      .orderBy(desc(eq(quotes.status, "accepted")), desc(quotes.decidedAt), desc(quotes.publishedAt))
      .limit(1),
    db
      .select({ email: memberships.email, name: user.name })
      .from(memberships)
      .leftJoin(user, eq(user.email, memberships.email))
      .where(and(eq(memberships.companyId, contract.companyId), eq(memberships.role, "manager"), eq(memberships.active, true)))
      .orderBy(memberships.createdAt)
      .limit(1),
    contract.parentId
      ? db.select({ title: contracts.title, signedAt: contracts.signedAt }).from(contracts).where(eq(contracts.id, contract.parentId))
      : Promise.resolve([]),
  ]);
  const out: Record<string, FieldSuggestion> = {};
  const offer = (key: string, value: string | null | undefined, source: string) => {
    if (wanted.has(key) && value && !out[key]) out[key] = { value, source };
  };
  if (company) {
    offer("empresa", company.name, "Cadastro da empresa");
    offer("cnpj", formatDocument(company.document), "Cadastro da empresa");
    offer("endereco", company.billingAddress ? addressLabel(company.billingAddress) : null, "Cadastro da empresa");
  }
  if (item) {
    offer("produto", item.name, "Produto ou serviço vinculado");
    offer("valor", item.amountCents != null ? currency(item.amountCents) : null, "Produto ou serviço vinculado");
    const interval = item.interval ?? item.catalogInterval;
    offer("ciclo", interval === "yearly" ? "anual" : interval === "monthly" ? "mensal" : null, "Produto ou serviço vinculado");
  }
  offer("inicio", contract.startsAt ? longDateLabel(contract.startsAt) : null, "Início da vigência");
  offer("fim", contract.endsAt ? longDateLabel(contract.endsAt) : null, "Fim da vigência");
  offer("data", longDateLabel(new Date()), "Hoje");
  if (parent) {
    offer("contrato", parent.title, "Contrato original");
    offer("contrato_data", parent.signedAt ? longDateLabel(parent.signedAt) : null, "Contrato original");
  }
  if (anuntech) {
    offer("anuntech", anuntech.name, "Dados da Anuntech");
    offer("anuntech_cnpj", formatDocument(anuntech.document), "Dados da Anuntech");
    offer("anuntech_endereco", anuntech.billingAddress ? addressLabel(anuntech.billingAddress) : null, "Dados da Anuntech");
  }
  if (quote) {
    const source = `Orçamento ${quoteNumberLabel(quote.year, quote.seq)} · ${quote.title}, ${quote.status === "accepted" ? "aceito" : "enviado, sem resposta"}`;
    const totals = quoteTotals(quote.content);
    offer("numero_proposta", quoteNumberLabel(quote.year, quote.seq), source);
    offer("data_proposta", longDateLabel(quote.publishedAt ?? quote.createdAt), source);
    offer("valor", totals.totalCents ? currency(totals.totalCents) : null, source);
    offer("valor_hora", quote.content.hourlyRateCents ? currency(quote.content.hourlyRateCents) : null, source);
    offer(
      "parcela_de_entrada",
      totals.upfrontCents ? `${currency(totals.upfrontCents)} (${quote.content.upfrontPercent}% do total)` : null,
      source,
    );
    offer(
      "estimativa_total",
      totals.hoursMax ? (totals.hoursMin === totals.hoursMax ? `${totals.hoursMax} horas` : `${totals.hoursMin} a ${totals.hoursMax} horas`) : null,
      source,
    );
  }
  offer("responsavel_anuntech", author.name, "Você");
  offer("email_responsavel_anuntech", author.email, "Você");
  const manager = managers[0];
  if (manager) {
    offer("responsavel_cliente", manager.name, "Administrador da empresa no Console");
    offer("email_responsavel_cliente", manager.email, "Administrador da empresa no Console");
  }
  return out;
}
