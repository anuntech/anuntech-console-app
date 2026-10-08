import "server-only";
import { and, count, eq, gte, inArray, lt, sql, sum } from "drizzle-orm";
import { auditEvents, automationEvents, companies, contracts, invoices, quotes, subscriptions, tickets } from "@/db/schema";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { currency } from "../format";
import { loadCalendar } from "../service-terms/terms";
import { nextMonth, previousMonth } from "../service-terms/hours-bank";
import { expiredDebts } from "../billing/billing-watch";
import { sendOpsMail } from "./ops-alerts";

/*
 * The month's close, for Kauan and the team: on the 1st business day, the
 * month that ended in numbers (by due date, as the Painel counts), once.
 */

const monthName = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

export async function monthCloseText(month: string) {
  const from = `${month}-01`;
  const to = `${nextMonth(month)}-01`;
  const start = new Date(`${from}T00:00:00-03:00`);
  const end = new Date(`${to}T00:00:00-03:00`);
  const [[paid], [open], [mrr], [newClients], [archived], [signed], [accepted], [opened], [resolved], debts] = await Promise.all([
    db.select({ n: count(), cents: sum(invoices.amountCents) }).from(invoices).where(and(eq(invoices.status, "paid"), gte(invoices.dueDate, from), lt(invoices.dueDate, to))),
    db.select({ n: count(), cents: sum(invoices.amountCents) }).from(invoices).where(and(eq(invoices.status, "issued"), gte(invoices.dueDate, from), lt(invoices.dueDate, to))),
    db
      .select({ cents: sql<number>`coalesce(sum(case when ${subscriptions.interval} = 'yearly' then ${subscriptions.amountCents} / 12.0 else ${subscriptions.amountCents} end), 0)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),
    db.select({ n: count() }).from(companies).where(and(gte(companies.createdAt, start), lt(companies.createdAt, end))),
    db.select({ n: count() }).from(auditEvents).where(and(eq(auditEvents.action, "company.archived"), gte(auditEvents.createdAt, start), lt(auditEvents.createdAt, end))),
    db.select({ n: count() }).from(contracts).where(and(eq(contracts.status, "signed"), gte(contracts.signedAt, start), lt(contracts.signedAt, end))),
    db.select({ n: count() }).from(quotes).where(and(eq(quotes.status, "accepted"), gte(quotes.decidedAt, start), lt(quotes.decidedAt, end))),
    db.select({ n: count() }).from(tickets).where(and(gte(tickets.createdAt, start), lt(tickets.createdAt, end))),
    db.select({ n: count() }).from(tickets).where(and(inArray(tickets.status, ["resolved", "closed"]), gte(tickets.updatedAt, start), lt(tickets.updatedAt, end))),
    expiredDebts(),
  ]);
  const received = Number(paid?.cents ?? 0);
  const pending = Number(open?.cents ?? 0);
  const lines = [
    `Fechamento de ${monthName(month)}, pelas datas de vencimento.`,
    `Recebido: ${currency(received)} em ${paid?.n ?? 0} ${paid?.n === 1 ? "fatura" : "faturas"}.`,
    `Em aberto: ${currency(pending)} em ${open?.n ?? 0} ${open?.n === 1 ? "fatura" : "faturas"}${received + pending ? ` (${Math.round((received / (received + pending)) * 100)}% recebido)` : ""}.`,
    `Recorrências ativas hoje: ${currency(Math.round(Number(mrr?.cents ?? 0)))} por mês.`,
    debts.length ? `Dívidas que o Inter expirou e ninguém decidiu: ${debts.length}, ${currency(debts.reduce((total, d) => total + d.amountCents, 0))}.` : null,
    `Clientes novos: ${newClients?.n ?? 0} · arquivados: ${archived?.n ?? 0}.`,
    `Contratos assinados: ${signed?.n ?? 0} · orçamentos aceitos: ${accepted?.n ?? 0}.`,
    `Chamados abertos: ${opened?.n ?? 0} · resolvidos: ${resolved?.n ?? 0}.`,
  ].filter(Boolean);
  return { subject: `[Console] Fechamento de ${monthName(month)}`, text: `${lines.join("\n")}\n\nDetalhes no Console: ${process.env.BETTER_AUTH_URL || "https://console.anuntech.com"}/financeiro\n\nConsole da Anuntech` };
}

/** From the daily digest: on (or after) the 1st business day, last month's close, once. */
export async function sendMonthClose(today = saoPauloDate()) {
  const cal = await loadCalendar();
  const month = today.slice(0, 7);
  let first = `${month}-01`;
  for (let day = 1; day <= 10; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    if (cal.isBusinessDay(date)) {
      first = date;
      break;
    }
  }
  if (today < first) return false;
  const closed = previousMonth(month);
  const [claimed] = await db
    .insert(automationEvents)
    .values({ kind: "month.close", entityId: closed })
    .onConflictDoNothing()
    .returning({ id: automationEvents.id });
  if (!claimed) return false;
  const { subject, text } = await monthCloseText(closed);
  const delivered = await sendOpsMail(subject, text);
  if (!delivered) await db.delete(automationEvents).where(eq(automationEvents.id, claimed.id));
  return delivered > 0;
}
