import "server-only";
import { eq } from "drizzle-orm";
import { invoices } from "@/db/schema";
import { db } from "../../db";
import { allowedIds, type Actor } from "../../access/access";
import { saoPauloDate } from "../../dates";
import { listInvoices } from "../../billing/invoice-list";
import { findInvoice } from "../../billing/invoice-access";
import { invoiceDebt } from "../../billing/invoice-debt";
import { invoiceDisplayStatus, invoiceQuery, invoiceStatusLabels, type InvoiceDisplayStatus } from "../../billing/invoice-table";
import { api } from "../server";
import { guard, missing } from "../access";

type ListRow = Awaited<ReturnType<typeof listInvoices>>["list"][number];
/** The public payment page, as a path: the app adds the Console it talks to. */
const payPath = (i: { publicId: string | null; publicEnabled: boolean; status: string }) =>
  i.publicId && i.publicEnabled && ["issued", "paid"].includes(i.status) ? `/pagar/${i.publicId}` : null;

export function invoiceRow(row: ListRow) {
  const display = row.display as InvoiceDisplayStatus;
  return {
    id: row.id,
    description: row.description,
    company: row.company,
    amountCents: row.amountCents,
    display,
    statusLabel: invoiceStatusLabels[display] ?? row.status,
    dueDate: row.dueDate,
    payPath: payPath(row),
  };
}

/** The same list the web shows, for the app. */
export async function invoicePage(actor: Actor, status: "all" | "issued" | "overdue" | "paid", page: number, pageSize = 25) {
  const query = { ...invoiceQuery({ status }), page, pageSize };
  return listInvoices(actor, query, saoPauloDate());
}

const invoiceCompany = async ({ id }: { id: string }) =>
  (await db.select({ companyId: invoices.companyId }).from(invoices).where(eq(invoices.id, id)))[0]?.companyId;

export const finance = {
  list: api.finance.list
    // listInvoices keeps a client to their finance companies; a Membro gets none.
    .use(guard({ self: true }))
    .handler(async ({ input, context }) => {
      const { actor } = context;
      const result = await invoicePage(actor, input.status, input.page);
      const pick = (k: "all" | "issued" | "overdue" | "paid") => result.totals[k];
      return {
        rows: result.list.map(invoiceRow),
        totals: { all: pick("all"), issued: pick("issued"), overdue: pick("overdue"), paid: pick("paid") },
        page: result.query.page,
        pageCount: result.pageCount,
        showCompany: actor.admin || allowedIds(actor, "finance").length > 1,
      };
    }),
  get: api.finance.get
    .use(guard({ area: "finance", company: invoiceCompany }))
    .handler(async ({ input, context }) => {
      const row = await findInvoice(context.actor, input.id);
      if (!row) throw missing();
      const i = row.invoice;
      const today = saoPauloDate();
      const debt = context.actor.admin ? await invoiceDebt(i) : null;
      const display = invoiceDisplayStatus(
        { status: i.status, dueDate: i.dueDate, expired: debt?.state === "open" },
        today,
      );
      const path = payPath(i);
      return {
        id: i.id,
        description: i.description,
        company: row.company.name,
        engagement: row.engagement,
        amountCents: i.amountCents,
        display,
        statusLabel: invoiceStatusLabels[display] ?? i.status,
        dueDate: i.dueDate,
        payPath: path,
        // Only while it can still be paid; a paid invoice keeps no payment codes on screen.
        pix: i.status === "issued" ? i.pixCopyPaste : null,
        boletoLine: i.status === "issued" ? i.boletoLine : null,
        boletoPath: path && i.status === "issued" && i.boletoLine ? `${path}/boleto` : null,
      };
    }),
};
