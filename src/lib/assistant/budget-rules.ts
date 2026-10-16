/*
 * Pure rules for the assistant's daily budget: who pays for a turn, how much
 * each payer may spend in a day (São Paulo calendar day) and what the person
 * reads when it runs out. Storage is in assistant-budget.ts.
 */

/** Model tokens one client person may spend per day. */
export const DAILY_TOKENS_PER_PERSON = 400_000;
/** Model tokens one person of the team may spend per day; the team has no company budget. */
export const DAILY_TOKENS_PER_TEAM_MEMBER = 2_000_000;
/** Model tokens all of a company's people may spend per day, together. */
export const DAILY_TOKENS_PER_COMPANY = 1_000_000;
/** Messages all of a company's people may send per day, together. */
export const DAILY_MESSAGES_PER_COMPANY = 300;

export type BudgetSubject = {
  kind: "person" | "company";
  id: string;
  /** The company's name, for the refusal; empty for the person. */
  name: string;
  tokenCap: number;
  /** Only companies have a message cap; the person has the hourly one. */
  messageCap: number | null;
};
export type Usage = { kind: string; subjectId: string; tokens: number; messages: number };

type Payer = { user: { id: string }; realAdmin: boolean; grants: { company: { id: string; name: string } }[] };

const BACK = "Ele volta a responder à meia-noite, horário de Brasília.";
/** The answer when the budget ran out mid-turn and the model had nothing to say. */
export const BUDGET_ENDED = `O limite do assistente de hoje acabou no meio desta resposta. ${BACK}`;
/** Told to the model for the last round once the budget ran out mid-turn. */
export const BUDGET_CLOSING_NOTE = `O limite de uso do assistente de hoje acabou durante esta resposta. Responda agora em texto, com o que as ferramentas já devolveram, sem chamar ferramentas, e diga em uma frase que o assistente volta a responder à meia-noite, horário de Brasília.`;

/**
 * Who pays for a turn. The person always. A client also pays from every
 * company it has access to, since one turn reads across all of them. The team
 * pays per person only, also while assisting a company, so support never
 * spends a client's day.
 */
export function budgetSubjects(actor: Payer): BudgetSubject[] {
  const person: BudgetSubject = {
    kind: "person",
    id: actor.user.id,
    name: "",
    tokenCap: actor.realAdmin ? DAILY_TOKENS_PER_TEAM_MEMBER : DAILY_TOKENS_PER_PERSON,
    messageCap: null,
  };
  if (actor.realAdmin) return [person];
  const companies = [...new Map(actor.grants.map((g) => [g.company.id, g.company])).values()];
  return [
    person,
    ...companies.map((c): BudgetSubject => ({
      kind: "company",
      id: c.id,
      name: c.name,
      tokenCap: DAILY_TOKENS_PER_COMPANY,
      messageCap: DAILY_MESSAGES_PER_COMPANY,
    })),
  ];
}

const find = <T extends Pick<Usage, "kind" | "subjectId">>(usage: T[], s: BudgetSubject) =>
  usage.find((u) => u.kind === s.kind && u.subjectId === s.id);

/**
 * What the person reads when today's budget refuses the message, or null.
 * `usage` already counts this message, so a company refuses past its cap.
 */
export function budgetRefusal(subjects: BudgetSubject[], usage: Usage[]): string | null {
  for (const s of subjects) {
    const day = find(usage, s);
    if (!day) continue;
    if (day.tokens >= s.tokenCap)
      return s.kind === "person"
        ? `Você usou todo o limite do assistente de hoje. ${BACK}`
        : `A empresa ${s.name} usou todo o limite do assistente de hoje. ${BACK}`;
    if (s.messageCap !== null && day.messages > s.messageCap)
      return `A empresa ${s.name} chegou a ${s.messageCap} mensagens no assistente hoje, o limite do dia. ${BACK}`;
  }
  return null;
}

/** True once any payer of the turn reached its token budget. */
export function overBudget(subjects: BudgetSubject[], usage: Pick<Usage, "kind" | "subjectId" | "tokens">[]): boolean {
  return subjects.some((s) => (find(usage, s)?.tokens ?? 0) >= s.tokenCap);
}
