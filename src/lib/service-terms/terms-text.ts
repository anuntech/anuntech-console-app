/*
 * The words a client reads about time and process, built from the
 * company's conditions. With no conditions, only what holds for everyone
 * (hours, how to ask) is said: never a number the client did not sign.
 */
import { dueLabel } from "../format";
import { addBusinessMinutes, DAY_START, inBusinessHours, nextBusinessStart, type Calendar } from "./business-calendar";
import { responseRule, businessSpanLabel } from "./ticket-clock";
import type { TermsSnapshot } from "./terms-model";
import { outsideSupportClock, suggestPriority, type TicketImpact, type TicketKind } from "../tickets/ticket-intake";

export const HOURS_LINE = "A equipe atende em dias úteis, das 9h às 18h (Brasília), e responde por aqui.";

/** "1,5 hora", "10 horas": a contract's hours, without rounding a half away. */
const hoursText = (minutes: number) => {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${String(hours).replace(".", ",")} ${hours === 1 ? "hora" : "horas"}`;
};

/** "O que esperar" before sending: the first response and the goal for this ticket, or the hours alone. */
export function expectation(
  terms: TermsSnapshot | null,
  kind: TicketKind | null | undefined,
  impact: TicketImpact | null | undefined,
  now: Date,
  cal: Calendar,
): { lines: string[]; dated: boolean } {
  if (kind === "new_project")
    return { lines: ["A equipe marca uma conversa para entender o que você precisa e prepara um orçamento."], dated: false };
  if (!terms || outsideSupportClock(kind)) return { lines: [HOURS_LINE], dated: false };
  const priority = suggestPriority(kind, impact, terms.policy.levels);
  const rule = responseRule(terms.policy, priority, impact);
  if (!rule) return { lines: [HOURS_LINE], dated: false };
  const due = addBusinessMinutes(now, rule.firstResponseMinutes, cal);
  const lines = [`Primeira resposta em até ${businessSpanLabel(rule.firstResponseMinutes)}: até ${dueLabel(due, now)}.`];
  // A request for something new is evaluated first: it has no goal to promise.
  if (rule.goalMinutes && kind !== "change")
    lines.push(
      priority === "critical"
        ? `A equipe segue até o sistema voltar a funcionar ou ter um contorno, com meta de ${businessSpanLabel(rule.goalMinutes)}.`
        : `Meta de ${priority === "normal" ? "conclusão" : "correção"}: ${businessSpanLabel(rule.goalMinutes)}.`,
    );
  if (terms.policy.levels && kind === "problem") lines.push("A equipe confirma a prioridade ao ler o seu chamado.");
  return { lines, dated: true };
}

/** For "Ajuste ou algo novo": what happens to the request, by contract. */
export function changeGuidance(terms: TermsSnapshot | null) {
  if (!terms) return "A equipe avalia o pedido e diz se ele entra no que você já tem ou se precisa de orçamento.";
  const p = terms.policy;
  if (p.includesDevelopment && p.improvementBankLimitMinutes && p.hoursBank)
    return `A equipe avalia se é um ajuste incluído no seu suporte ou uma melhoria. Melhoria de até ${hoursText(p.improvementBankLimitMinutes)} sai do seu banco de horas depois que você aprovar a estimativa. Acima disso, você recebe um orçamento aqui no Console.`;
  if (!p.includesDevelopment)
    return "O seu contrato não inclui desenvolvimento. A equipe avalia o pedido e, se fizer sentido, envia um orçamento.";
  return "A equipe avalia o pedido e diz se ele entra no que você já tem ou se precisa de orçamento.";
}

/** Outside business hours: when the team is back and, where there is a deadline, that it starts then. */
export function outOfHoursLine(now: Date, cal: Calendar, dated = false) {
  if (inBusinessHours(now, cal)) return null;
  const back = nextBusinessStart(now, cal);
  const label = dueLabel(back, now).replace(/, \d+h(\d+)?$/, "");
  return `A equipe volta às ${DAY_START / 60}h de ${label}.${dated ? " O prazo começa a contar a partir daí." : ""}`;
}

/** The commitment vs goal line (SUP 6.3), only where the contract has goals. */
export function commitmentLine(terms: TermsSnapshot | null) {
  const hasGoals = !!terms && Object.values(terms.policy.response).some((r) => r?.goalMinutes);
  return hasGoals
    ? "A resposta é um compromisso da Anuntech. A solução tem uma meta, porque depende do problema, dos acessos e de respostas suas e de outros fornecedores."
    : null;
}

const levelNames = {
  critical: "Crítica (sistema parado, sem contorno)",
  high: "Alta (falha com contorno, ou que afeta muita gente)",
  normal: "Normal (demais defeitos, dúvidas e ajustes)",
} as const;

export type TermsFact = { text: string; clause?: string };

/** "Seus prazos" and "O que o seu contrato pede", from one company's conditions. */
export function termsSummary(terms: TermsSnapshot): { promises: TermsFact[]; asks: TermsFact[] } {
  const p = terms.policy;
  const c = p.clauses;
  const promises: TermsFact[] = [];
  if (p.levels) {
    for (const level of ["critical", "high", "normal"] as const) {
      const rule = p.response[level];
      if (!rule) continue;
      promises.push({
        text: `${levelNames[level]}: primeira resposta em até ${businessSpanLabel(rule.firstResponseMinutes)}${rule.goalMinutes ? `; meta de ${businessSpanLabel(rule.goalMinutes)}` : ""}.`,
        clause: c.response,
      });
    }
  } else if (p.response.normal) {
    promises.push({ text: `Primeira resposta em até ${businessSpanLabel(p.response.normal.firstResponseMinutes)}.`, clause: c.response });
    if (p.outageFirstResponseMinutes)
      promises.push({ text: `Com o serviço todo fora do ar, em até ${businessSpanLabel(p.outageFirstResponseMinutes)}.`, clause: c.response });
  }
  if (p.warrantyUntil) promises.push({ text: `Garantia da entrega até ${p.warrantyUntil.split("-").reverse().join("/")}.`, clause: c.warrantyUntil });
  if (p.pausesWhileWaiting)
    promises.push({ text: "O prazo para enquanto a equipe espera uma resposta, um acesso ou um teste seu, e volta a contar quando você responde.", clause: c.pausesWhileWaiting });
  if (p.outOfHours === "not_included") promises.push({ text: "Atendimento fora do horário não está incluído.", clause: c.outOfHours });
  if (p.outOfHours === "if_contracted") promises.push({ text: "Fora do horário, só se estiver nos recursos contratados.", clause: c.outOfHours });
  if (p.hoursBank?.monthlyMinutes)
    promises.push({
      text: `O seu plano inclui ${hoursText(p.hoursBank.monthlyMinutes)} por mês. Horas que sobram não passam para o mês seguinte. Ao chegar a ${p.hoursBank.alertPercent}%, você recebe um aviso. Fora a correção de um defeito crítico, nada passa do banco sem a aprovação de um Administrador da sua empresa aqui no Console.`,
      clause: c.hoursBank,
    });
  if (p.improvementWarrantyDays)
    promises.push({ text: `Cada melhoria tem garantia de ${p.improvementWarrantyDays} dias depois do aceite, sem usar o banco de horas.`, clause: c.improvementWarrantyDays });

  const asks: TermsFact[] = [];
  // Rules of silence wait for the lawyer when the client is a person (CPF).
  const silence = !terms.personClient;
  if (p.clientResponseDays && silence)
    asks.push({ text: `Responda aos pedidos da equipe em até ${p.clientResponseDays} dias úteis.`, clause: c.clientResponseDays });
  if (p.testDays && silence)
    asks.push({
      text: p.tacitAcceptance
        ? `Teste cada entrega em até ${p.testDays} dias úteis. Sem resposta nesse prazo, ou se ela já estiver em uso, ela conta como aceita.`
        : `Teste cada entrega em até ${p.testDays} dias úteis.`,
      clause: c.testDays,
    });
  if (p.hoursBank?.reportContestDays && silence)
    asks.push({ text: `Conteste o relatório de horas em até ${p.hoursBank.reportContestDays} dias úteis. Sem contestação, ele conta como aprovado.`, clause: c.reportContestDays });
  if (p.includesDevelopment && p.hoursBank)
    asks.push({ text: "Falha causada por mudança feita sem avisar a Anuntech é tratada como melhoria e usa o banco de horas.", clause: "SUP 7.2" });
  if (p.suspensionDays)
    asks.push({
      text: p.suspensionNotice
        ? `Pague em dia. Com mais de ${p.suspensionDays} dias de atraso, o serviço pode ser suspenso depois de um aviso.`
        : `Pague em dia. Com mais de ${p.suspensionDays} dias de atraso, o serviço pode ser suspenso até o pagamento.`,
      clause: c.suspension,
    });
  return { promises, asks };
}
