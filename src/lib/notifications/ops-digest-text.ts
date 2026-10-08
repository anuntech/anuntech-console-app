import { currency, dateLabel, dueLabel } from "../format";
import { noticeChannelLabels, noticeKindLabel, noticeStatusLabels } from "../billing/billing-notice-rules";

/** Everything the morning summary reports; pure data so the text can be tested. */
/** Why a staff alert did not arrive, from Resend's last event. */
const DELIVERY_EVENTS: Record<string, string> = {
  suppressed: "suprimido no Resend",
  bounced: "e-mail voltou",
  complained: "marcado como spam",
  failed: "falha no envio",
};
export function deliveryEventLabel(event: string) {
  return DELIVERY_EVENTS[event] ?? event;
}

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
  /** Unanswered tickets whose first response is due by tonight or already late. */
  tickets?: { id: string; company: string; subject: string; dueAt: string }[];
  /** Active recurrences that will fail when they issue: an incomplete record or an early issue that failed. */
  failing?: { companyId: string; company: string; description: string; issueDate: string; reason: string }[];
  /** Charges Inter closed unpaid ("Expirada") that nobody has billed again or written off. */
  expired?: { id: string; company: string; description: string; amountCents: number; dueDate: string }[];
  /** Open charges Inter closes within a week. */
  expiring?: { id: string; company: string; description: string; amountCents: number; expiresOn: string }[];
  /** Recurrences still billing a service that stopped or a contract that ended. */
  leaving?: { company: string; description: string; issueDate: string; reason: string }[];
  /** Scheduled routines with no run within their window, or none finished at all. */
  routines?: { label: string; quiet: string; lastError: string | null }[];
  /** Staff addresses whose latest alert did not arrive (suppressed or bounced at Resend). */
  unreachable?: { email: string; event: string; since: string }[];
  /** The Inter certificate, when it ends within 30 days (or already ended). */
  certificate?: { expiresOn: string; days: number } | null;
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
  const tickets = d.tickets ?? [];
  const failing = d.failing ?? [];
  const expired = d.expired ?? [];
  const expiring = d.expiring ?? [];
  const leaving = d.leaving ?? [];
  const routines = d.routines ?? [];
  const unreachable = d.unreachable ?? [];
  const problems = unreachable.length +
    d.paused.length + d.noticeProblems.length + d.overdue.length + d.contracts.length + tickets.length +
    failing.length + expired.length + expiring.length + leaving.length + routines.length + (d.certificate ? 1 : 0);
  const date = dateLabel(d.today);
  const sections: string[] = [
    `Resumo do Console de ${date}`,
    `Emitidas nas últimas 24 h: ${d.issued24h} · Recebidas: ${d.paid24h}`,
  ];
  if (d.certificate)
    sections.push(
      d.certificate.days < 0
        ? `O certificado do Inter venceu em ${dateLabel(d.certificate.expiresOn)}: emissão, conciliação e confirmação de pagamento estão paradas. Troque o certificado na Vercel (INTER_CERTIFICATE_BASE64 e INTER_PRIVATE_KEY_BASE64).`
        : `O certificado do Inter vence em ${dateLabel(d.certificate.expiresOn)} (${d.certificate.days === 1 ? "1 dia" : `${d.certificate.days} dias`}). Gere um novo no Internet Banking PJ e troque na Vercel antes disso, ou emissão e conciliação param.`,
    );
  if (unreachable.length)
    sections.push(
      `Alertas que não chegam (${unreachable.length}):\n${list(unreachable, (u) => `${u.email} · ${deliveryEventLabel(u.event)} desde ${dateLabel(new Date(u.since))}. Tire o endereço da lista de supressão no Resend ou corrija o e-mail em Membros.`)}`,
    );
  if (routines.length)
    sections.push(
      `Rotinas paradas (${routines.length}):\n${list(routines, (r) => `${r.label} · ${r.quiet}${r.lastError ? ` · último erro: ${r.lastError}` : ""}`)}`,
    );
  if (failing.length)
    sections.push(
      `Emissões que vão falhar se ninguém mexer (${failing.length}):\n${list(failing, (f) => `${f.company} · ${f.description} · emite até ${dateLabel(f.issueDate)} · ${f.reason} · ${d.url}/empresas/${f.companyId}?editar=1`)}`,
    );
  if (expired.length)
    sections.push(
      `Expiradas no Inter sem pagamento (${expired.length}):\n${list(expired, (i) => `${i.company} · ${i.description} · ${currency(i.amountCents)} · venceu em ${dateLabel(i.dueDate)} · ${d.url}/financeiro/${i.id}`)}`,
    );
  if (expiring.length)
    sections.push(
      `Expiram no Inter em até 7 dias (${expiring.length}):\n${list(expiring, (i) => `${i.company} · ${i.description} · ${currency(i.amountCents)} · expira em ${dateLabel(i.expiresOn)} · ${d.url}/financeiro/${i.id}`)}`,
    );
  if (leaving.length)
    sections.push(
      `Cobranças de quem encerrou (${leaving.length}):\n${list(leaving, (l) => `${l.company} · ${l.description} · ${l.reason} · próxima sai até ${dateLabel(l.issueDate)}`)}`,
    );
  if (tickets.length)
    sections.push(
      `Chamados sem primeira resposta, com prazo até hoje (${tickets.length}):\n${list(tickets, (t) => `${t.company} · ${t.subject} · ${new Date(t.dueAt) < new Date() ? "atrasado desde" : "até"} ${dueLabel(t.dueAt)} · ${d.url}/chamados/${t.id}`)}`,
    );
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
    sections.push("Tudo em dia: nenhuma recorrência pausada ou com cadastro incompleto, nenhum aviso com problema, nenhuma fatura vencida ou expirada, nenhum chamado perto do prazo, rotinas rodando.");
  sections.push(`Abrir o Console: ${d.url}/financeiro`);
  return {
    subject: problems
      ? `[Console] ${date}: ${problems === 1 ? "1 ponto" : `${problems} pontos`} para olhar`
      : `[Console] ${date}: tudo em dia`,
    text: sections.join("\n\n"),
  };
}
