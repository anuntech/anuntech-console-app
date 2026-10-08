import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { catalogItems, contracts, engagements, invoices, quotes } from "@/db/schema";
import { db } from "@/lib/db";
import { accessibleCompanies, requireAdmin } from "@/lib/access/access";
import { saoPauloDate } from "@/lib/dates";
import { dateLabel } from "@/lib/format";
import { expiredDebtCondition } from "@/lib/billing/billing-watch";
import { addDays, monthlyDueOnOrAfter } from "@/lib/billing/recurrence";
import { quoteCharge } from "@/lib/quotes/quote-handoff";
import { quoteNumberLabel } from "@/lib/quotes/quote-model";
import { overageCharge } from "@/lib/service-terms/hours-delivery";
import type {
  InvoiceCompanyOption,
  InvoiceEngagementOption,
  InvoicePrefill,
} from "./invoice-form";

export type NewInvoiceSearchParams = Promise<{
  companyId?: string;
  de?: string;
  orcamento?: string;
  parte?: string;
  contrato?: string;
  /** With `mes`: a closed month's hours beyond the bank. */
  excedente?: string;
  mes?: string;
}>;
const UUID = /^[0-9a-f-]{36}$/;

/** A debt Inter closed unpaid, billed again as a one-time charge with a new date to pay. */
async function rebillPrefill(invoiceId: string): Promise<InvoicePrefill | null> {
  if (!UUID.test(invoiceId)) return null;
  const [debt] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), sql`${expiredDebtCondition}`));
  if (!debt) return null;
  return {
    source: { kind: "rebill", id: debt.id, label: `da fatura que o Inter encerrou sem pagamento (venceu em ${dateLabel(debt.dueDate)})` },
    companyId: debt.companyId,
    engagementId: debt.engagementId,
    description: debt.description,
    amountCents: debt.amountCents,
    // The obligation keeps its date; the boleto gets a new one a week from now.
    dueDate: debt.dueDate,
    bankDueDate: addDays(saoPauloDate(), 7),
    billingType: "one_time",
  };
}

/** The entrada or the saldo of an accepted proposal, as it was accepted. */
async function quotePrefill(quoteId: string, part: "upfront" | "balance"): Promise<InvoicePrefill | null> {
  if (!UUID.test(quoteId)) return null;
  const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.status, "accepted")));
  if (!quote) return null;
  const accepted = quote.publication ?? { ...quote.content, title: quote.title };
  const charge = quoteCharge({ ...quote, title: accepted.title, content: accepted }, part, saoPauloDate());
  if (!charge.amountCents) return null;
  // The project built from this proposal, when there is one.
  const [project] = await db
    .select({ id: engagements.id })
    .from(engagements)
    .where(and(eq(engagements.quoteId, quote.id), eq(engagements.companyId, quote.companyId)))
    .orderBy(desc(engagements.createdAt))
    .limit(1);
  return {
    source: {
      kind: part === "upfront" ? "quote_upfront" : "quote_balance",
      id: quote.id,
      label: `do orçamento ${quoteNumberLabel(quote.year, quote.seq)} aceito (${part === "upfront" ? "entrada" : "saldo"})`,
    },
    companyId: quote.companyId,
    engagementId: project?.id ?? null,
    description: charge.description,
    amountCents: charge.amountCents,
    dueDate: charge.dueDate,
    billingType: "one_time",
  };
}

/** The recurrence of a signed contract: its item's price and cycle, due on the contract's day. */
async function contractPrefill(contractId: string): Promise<InvoicePrefill | null> {
  if (!UUID.test(contractId)) return null;
  const [row] = await db
    .select({
      contract: contracts,
      item: engagements.name,
      amountCents: engagements.amountCents,
      interval: catalogItems.interval,
    })
    .from(contracts)
    .innerJoin(engagements, eq(engagements.id, contracts.engagementId))
    .leftJoin(catalogItems, eq(catalogItems.id, engagements.catalogItemId))
    .where(and(eq(contracts.id, contractId), eq(contracts.status, "signed"), eq(contracts.kind, "contract")));
  if (!row?.amountCents) return null;
  const today = saoPauloDate();
  const day = Number((row.contract.startsAt ?? today).slice(8));
  // The first due date from the contract's start, at least 5 days ahead so the boleto goes out in time.
  const earliest = addDays(today, 5);
  const from = row.contract.startsAt && row.contract.startsAt > earliest ? row.contract.startsAt : earliest;
  return {
    source: { kind: "contract", id: row.contract.id, label: `do contrato assinado ${row.contract.title}` },
    companyId: row.contract.companyId,
    engagementId: row.contract.engagementId,
    description: row.item,
    amountCents: row.amountCents,
    dueDate: monthlyDueOnOrAfter(day, from),
    billingType: "recurring",
    interval: row.interval === "yearly" ? "yearly" : "monthly",
  };
}

/** The hours beyond a closed month's bank, at the price in the conditions. */
async function overagePrefill(companyId: string, month: string): Promise<InvoicePrefill | null> {
  if (!UUID.test(companyId) || !/^\d{4}-\d{2}$/.test(month)) return null;
  const charge = await overageCharge(companyId, month);
  if (!charge) return null;
  return {
    source: { kind: "overage", id: `${companyId}:${month}`, label: `do banco de horas de ${month.split("-").reverse().join("/")} (horas além do banco, depois do prazo de contestação)` },
    companyId,
    engagementId: null,
    description: charge.description,
    amountCents: charge.amountCents,
    dueDate: addDays(saoPauloDate(), 7),
    billingType: "one_time",
  };
}

/** Active clients to bill, their products/projects, a preselected client and, when asked, a prepared charge. */
export async function newInvoiceContext(
  searchParams: NewInvoiceSearchParams,
): Promise<{
  companies: InvoiceCompanyOption[];
  engagements: InvoiceEngagementOption[];
  companyId?: string;
  prefill?: InvoicePrefill | null;
}> {
  const actor = await requireAdmin();
  const companies = (await accessibleCompanies(actor))
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: c.name, document: c.document }));
  const items = companies.length
    ? await db
        .select({
          id: engagements.id,
          name: engagements.name,
          companyId: engagements.companyId,
        })
        .from(engagements)
        .where(
          inArray(
            engagements.companyId,
            companies.map((c) => c.id),
          ),
        )
        .orderBy(engagements.name)
    : [];
  const { companyId, de, orcamento, parte, contrato, excedente, mes } = await searchParams;
  const prefill = de
    ? await rebillPrefill(de)
    : orcamento
      ? await quotePrefill(orcamento, parte === "saldo" ? "balance" : "upfront")
      : contrato
        ? await contractPrefill(contrato)
        : excedente && mes
          ? await overagePrefill(excedente, mes)
          : null;
  const usable = prefill && companies.some((c) => c.id === prefill.companyId) ? prefill : null;
  return {
    companies,
    engagements: items,
    companyId: usable?.companyId ?? (companies.some((c) => c.id === companyId) ? companyId : undefined),
    prefill: usable,
  };
}
