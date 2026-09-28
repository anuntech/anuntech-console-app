import { currency, dateLabel } from "../format";
import { noticeChannelLabels, noticeKindLabel, noticeStatusLabels } from "../billing/billing-notice-rules";

/** Everything the morning summary reports; pure data so the text can be tested. */
export type OpsDigestData = {
  today: string;
  issued24h: number;
  paid24h: number;
  paused: { company: string; description: string; nextDueDate: string; error: string | null }[];
  noticeProblems: {
    company: string;
    description: string;
    channel: string;
    kind: string;
    status: string;
    error: string | null;
  }[];
  overdue: { company: string; description: string; amountCents: number; days: number }[];
  contracts: { company: string; title: string; label: string }[];
  url: string;
};

const list = <T,>(items: T[], line: (item: T) => string, limit = 25) =>
  items
    .slice(0, limit)
    .map((item) => `- ${line(item)}`)
    .concat(items.length > limit ? [`… e mais ${items.length - limit}`] : [])
    .join("\n");

/** The subject says at a glance whether there is anything to act on. */
export function opsDigestText(d: OpsDigestData): { subject: string; text: string } {
  const problems = d.paused.length + d.noticeProblems.length + d.overdue.length + d.contracts.length;
  const date = dateLabel(d.today);
  const sections: string[] = [
    `Resumo do Console de ${date}`,
    `Emitidas nas últimas 24 h: ${d.issued24h} · Recebidas: ${d.paid24h}`,
  ];
  if (d.paused.length)
    sections.push(
      `Recorrências pausadas (${d.paused.length}):\n${list(d.paused, (p) => `${p.company} · ${p.description} · próximo ${dateLabel(p.nextDueDate)} · ${p.error ?? "sem motivo registrado"}`)}`,
    );
  if (d.noticeProblems.length)
    sections.push(
      `Avisos com problema nas últimas 24 h (${d.noticeProblems.length}):\n${list(d.noticeProblems, (n) => `${n.company} · ${n.description} · ${noticeChannelLabels[n.channel] ?? n.channel} · ${noticeKindLabel(n.kind)} · ${noticeStatusLabels[n.status] ?? n.status}${n.error ? ` · ${n.error}` : ""}`)}`,
    );
  if (d.overdue.length)
    sections.push(
      `Faturas vencidas (${d.overdue.length}):\n${list(d.overdue, (i) => `${i.company} · ${i.description} · ${currency(i.amountCents)} · ${i.days === 1 ? "1 dia" : `${i.days} dias`} de atraso`)}`,
    );
  if (d.contracts.length)
    sections.push(
      `Contratos vencendo ou vencidos (${d.contracts.length}):\n${list(d.contracts, (c) => `${c.company} · ${c.title} · ${c.label}`)}`,
    );
  if (!problems)
    sections.push("Tudo em dia: nenhuma recorrência pausada, nenhum aviso com problema, nenhuma fatura vencida.");
  sections.push(`Abrir o Console: ${d.url}/financeiro`);
  return {
    subject: problems
      ? `[Console] ${date}: ${problems === 1 ? "1 ponto" : `${problems} pontos`} para olhar`
      : `[Console] ${date}: tudo em dia`,
    text: sections.join("\n\n"),
  };
}
