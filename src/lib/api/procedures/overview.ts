import "server-only";
import { allowedIds } from "../../access/access";
import { listTickets } from "../../tickets/ticket-list";
import { api } from "../server";
import { guard } from "../access";
import { ticketRow } from "./tickets";
import { invoicePage, invoiceRow } from "./finance";

const ticketsPage = (status: "waiting_customer" | "active") => ({
  status,
  search: "",
  company: "",
  page: 1,
  pageSize: 5,
});

export const overview = {
  // Built from the same lists as Chamados and Financeiro, so the rules stay theirs.
  get: api.overview.get.use(guard({ self: true })).handler(async ({ context }) => {
    const { actor } = context;
    const canFinance = actor.admin || allowedIds(actor, "finance").length > 0;
    const [waiting, recent, overdue, open] = await Promise.all([
      listTickets(actor, ticketsPage("waiting_customer")),
      listTickets(actor, ticketsPage("active")),
      canFinance ? invoicePage(actor, "overdue", 1, 5) : null,
      canFinance ? invoicePage(actor, "issued", 1, 5) : null,
    ]);
    const toPay = [...(overdue?.list ?? []), ...(open?.list ?? [])]
      .map(invoiceRow)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
    return {
      waiting: waiting.rows.map((row) => ticketRow(actor, row)),
      recent: recent.rows.map((row) => ticketRow(actor, row)),
      toPay,
      canFinance,
    };
  }),
};
