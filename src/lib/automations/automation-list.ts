/*
 * The automatic steps the Console takes on its own, each with a switch in
 * Configurações → Automações (on unless switched off). Pure: the settings
 * page and the routines share it. Kauan asked for every automation on
 * 08/10/2026, client notices included; the switches let him turn any off.
 */

export const AUTOMATIONS = {
  hoursAlert: {
    group: "Cliente",
    label: "Aviso de 80% do banco de horas",
    description: "Quando as horas do mês passam do limite de aviso das condições, os Administradores do cliente recebem um e-mail, uma vez por mês.",
  },
  hoursReport: {
    group: "Cliente",
    label: "Relatório do banco de horas",
    description: "No 2º dia útil do mês, os Administradores recebem o relatório do mês anterior. Começa o prazo de contestação.",
  },
  quoteReminder: {
    group: "Cliente",
    label: "Lembrete de orçamento perto de vencer",
    description: "3 dias antes da validade, os Administradores recebem um lembrete do orçamento ainda sem resposta. Uma vez por envio.",
  },
  contractReminder: {
    group: "Cliente",
    label: "Lembrete de contrato sem assinatura",
    description: "7 dias depois do envio, quem assina pelo cliente recebe um lembrete se ainda não assinou. Uma vez por versão.",
  },
  contractSigned: {
    group: "Cliente",
    label: "Contrato assinado pelas duas partes",
    description: "Os Administradores recebem o link do PDF final e os próximos passos, uma vez por contrato.",
  },
  reviewNotice: {
    group: "Cliente",
    label: "Entregas para revisar",
    description: "Uma vez por dia, quem aprova as entregas recebe a lista do que entrou em Revisão, com o prazo de teste quando as condições têm.",
  },
  waitingReminder: {
    group: "Cliente",
    label: "Lembrete de chamado esperando o cliente",
    description: "Na metade do prazo que as condições dão ao cliente (ou depois de 3 dias úteis), o pedido do que falta é enviado de novo, uma vez.",
  },
  weeklySummary: {
    group: "Cliente",
    label: "Resumo semanal aos Administradores",
    description: "Toda segunda, um resumo por empresa: chamados, o que espera o cliente, entregas em Revisão, banco de horas e próxima fatura. Semana sem movimento não manda nada.",
  },
  ticketTriage: {
    group: "Equipe",
    label: "Triagem do Jev nos chamados novos",
    description: "O Jev lê o assunto e a descrição pelo AI Gateway e sugere à equipe uma prioridade maior quando o texto parece mais grave. Nada muda sozinho.",
  },
} as const;
export type AutomationKey = keyof typeof AUTOMATIONS;
export const automationKeys = Object.keys(AUTOMATIONS) as AutomationKey[];

/** A missing key means on. */
export const automationState = (stored: Record<string, boolean> | null | undefined) =>
  Object.fromEntries(automationKeys.map((key) => [key, stored?.[key] !== false])) as Record<AutomationKey, boolean>;
