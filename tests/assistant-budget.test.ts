import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetRefusal,
  budgetSubjects,
  DAILY_MESSAGES_PER_COMPANY,
  DAILY_TOKENS_PER_COMPANY,
  DAILY_TOKENS_PER_PERSON,
  DAILY_TOKENS_PER_TEAM_MEMBER,
  overBudget,
} from "../src/lib/assistant/budget-rules";

const company = (id: string, name: string) => ({ company: { id, name } });
const client = { user: { id: "u1" }, realAdmin: false, grants: [company("a", "Alfa"), company("b", "Beta"), company("a", "Alfa")] };
const team = { user: { id: "t1" }, realAdmin: true, grants: [company("a", "Alfa")] };

test("a client pays from its own day and from every company it has access to, once each", () => {
  assert.deepEqual(
    budgetSubjects(client).map((s) => [s.kind, s.id, s.tokenCap, s.messageCap]),
    [
      ["person", "u1", DAILY_TOKENS_PER_PERSON, null],
      ["company", "a", DAILY_TOKENS_PER_COMPANY, DAILY_MESSAGES_PER_COMPANY],
      ["company", "b", DAILY_TOKENS_PER_COMPANY, DAILY_MESSAGES_PER_COMPANY],
    ],
  );
});

test("the team pays per person only, also while assisting a company", () => {
  assert.deepEqual(
    budgetSubjects(team).map((s) => [s.kind, s.id, s.tokenCap]),
    [["person", "t1", DAILY_TOKENS_PER_TEAM_MEMBER]],
  );
});

test("the message is refused once a payer is out of tokens or a company is past its messages", () => {
  const subjects = budgetSubjects(client);
  const day = (kind: string, subjectId: string, tokens: number, messages = 1) => ({ kind, subjectId, tokens, messages });
  assert.equal(budgetRefusal(subjects, [day("person", "u1", DAILY_TOKENS_PER_PERSON - 1), day("company", "a", 0), day("company", "b", 0)]), null);
  assert.match(budgetRefusal(subjects, [day("person", "u1", DAILY_TOKENS_PER_PERSON)]) ?? "", /^Você usou todo o limite do assistente de hoje\. .*meia-noite/);
  assert.match(budgetRefusal(subjects, [day("person", "u1", 10), day("company", "b", DAILY_TOKENS_PER_COMPANY)]) ?? "", /^A empresa Beta usou todo o limite/);
  // The usage already counts this message: the cap itself still goes, one more does not.
  assert.equal(budgetRefusal(subjects, [day("company", "a", 0, DAILY_MESSAGES_PER_COMPANY)]), null);
  assert.match(budgetRefusal(subjects, [day("company", "a", 0, DAILY_MESSAGES_PER_COMPANY + 1)]) ?? "", new RegExp(`^A empresa Alfa chegou a ${DAILY_MESSAGES_PER_COMPANY} mensagens`));
  // The team has no message cap.
  assert.equal(budgetRefusal(budgetSubjects(team), [day("person", "t1", DAILY_TOKENS_PER_PERSON, 10_000)]), null);
});

test("a turn wraps up once any payer reaches its budget", () => {
  const subjects = budgetSubjects(client);
  assert.equal(overBudget(subjects, [{ kind: "person", subjectId: "u1", tokens: 5 }, { kind: "company", subjectId: "a", tokens: 5 }]), false);
  assert.equal(overBudget(subjects, [{ kind: "company", subjectId: "b", tokens: DAILY_TOKENS_PER_COMPANY }]), true);
  assert.equal(overBudget(subjects, [{ kind: "company", subjectId: "z", tokens: DAILY_TOKENS_PER_COMPANY * 2 }]), false);
});
