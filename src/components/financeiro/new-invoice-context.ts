import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { engagements, invoices } from "@/db/schema";
import { db } from "@/lib/db";
import { accessibleCompanies, requireAdmin } from "@/lib/access/access";
import { saoPauloDate } from "@/lib/dates";
import { dateLabel } from "@/lib/format";
import { expiredDebtCondition } from "@/lib/billing/billing-watch";
import { addDays } from "@/lib/billing/recurrence";
import type {
  InvoiceCompanyOption,
  InvoiceEngagementOption,
  InvoicePrefill,
} from "./invoice-form";

export type NewInvoiceSearchParams = Promise<{ companyId?: string; de?: string }>;

/** A debt Inter closed unpaid, billed again as a one-time charge with a new date to pay. */
async function rebillPrefill(invoiceId: string): Promise<InvoicePrefill | null> {
  if (!/^[0-9a-f-]{36}$/.test(invoiceId)) return null;
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
  const { companyId, de } = await searchParams;
  const prefill = de ? await rebillPrefill(de) : null;
  const usable = prefill && companies.some((c) => c.id === prefill.companyId) ? prefill : null;
  return {
    companies,
    engagements: items,
    companyId: usable?.companyId ?? (companies.some((c) => c.id === companyId) ? companyId : undefined),
    prefill: usable,
  };
}
