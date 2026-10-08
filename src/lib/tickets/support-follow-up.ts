import "server-only";
import type { FollowUpGroup } from "../commercial/follow-up";
import { hoursPending, overagesToBill } from "../service-terms/hours-delivery";
import { currency } from "../format";
import { ticketWatch } from "./ticket-watch";

const monthName = (month: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

/** Support and hours-bank work waiting on someone, in the same shape as the sales follow-up. */
export async function supportFollowUp(now = new Date()): Promise<FollowUpGroup[]> {
  const [tickets, hours, overages] = await Promise.all([ticketWatch(now), hoursPending(), overagesToBill(now)]);
  const groups: FollowUpGroup[] = [
    {
      key: "hours-alerts",
      title: "Bancos de horas no limite sem aviso ao cliente",
      items: hours.alerts.map((b) => ({ line: `${b.company} · ${b.percent}% do banco`, href: `/empresas/${b.companyId}` })),
    },
    {
      key: "hours-reports",
      title: "Relatórios de horas a enviar",
      items: hours.reports.map((r) => ({
        line: `${r.company} · ${monthName(r.month)}${r.again ? " · reenviar: o relatório saiu antes do fim do mês ou de horas registradas depois" : ""}`,
        href: `/empresas/${r.companyId}`,
      })),
    },
    {
      key: "hours-overage",
      title: "Horas além do banco prontas para cobrar",
      items: overages.map((o) => ({
        line: `${o.company} · ${monthName(o.month)} · ${currency(o.amountCents)}`,
        href: `/financeiro/nova?excedente=${o.companyId}&mes=${o.month}`,
      })),
    },
    { key: "tickets-waiting", title: "Chamados esperando o cliente além do prazo", items: tickets.waiting },
    { key: "estimates-waiting", title: "Estimativas sem resposta do cliente", items: tickets.estimates },
    { key: "tickets-no-hours", title: "Chamados terminados sem horas, em empresas com banco", items: tickets.noHours },
  ];
  return groups.filter((group) => group.items.length);
}
