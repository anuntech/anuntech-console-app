import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD_LIMIT, quoteBoardTasks, quoteCharge, quoteContractValues, type HandoffQuote } from "../src/lib/quotes/quote-handoff";
import { monthlyDueOnOrAfter, nextTerm } from "../src/lib/billing/recurrence";
import { presetForTemplate } from "../src/lib/service-terms/presets";
import { opsDigestText } from "../src/lib/notifications/ops-digest-text";

const quote: HandoffQuote = {
  year: 2026,
  seq: 7,
  title: "Sistema de OS",
  publishedAt: new Date("2026-10-01T15:00:00Z"),
  createdAt: new Date("2026-09-30T15:00:00Z"),
  content: {
    summary: "Controle de ordens de serviço.",
    stack: ["Next.js", "Postgres"],
    hourlyRateCents: 10000,
    discountCents: 0,
    upfrontPercent: 50,
    notes: "",
    phases: [
      { name: "Descoberta", description: "Entender o fluxo.", hoursMin: 8, hoursMax: 10, weeks: 1, tasks: [{ title: "Entrevistas", description: "Com a equipe." }] },
      { name: "Construção", description: "", hoursMin: 30, hoursMax: 40, weeks: 3, tasks: [{ title: "Cadastro de OS", description: "" }, { title: "Relatórios", description: "Mensais." }] },
    ],
  },
};

test("contract fields are matched by meaning, only the ones asked and filled", () => {
  const values = quoteContractValues(quote, ["numero_proposta", "escopo_funcional", "entregaveis", "tecnologias", "prazo_de_entrega", "valor", "valor_total", "parcela_de_entrada", "horas_mensais", "prazo_de_resposta", "outra_coisa"]);
  assert.equal(values.numero_proposta, "2026-007");
  assert.match(values.escopo_funcional, /^Fase 1, Descoberta: Entender o fluxo\.\nP1-01 Entrevistas: Com a equipe\.\nFase 2, Construção\.\nP2-01 Cadastro de OS\nP2-02 Relatórios: Mensais\.$/);
  assert.equal(values.entregaveis, "P1-01 Entrevistas\nP2-01 Cadastro de OS\nP2-02 Relatórios");
  assert.equal(values.tecnologias, "Next.js, Postgres");
  assert.equal(values.prazo_de_entrega, "4 semanas");
  assert.match(values.valor_total, /R\$\s5\.000,00/);
  // The bare {{valor}} is the item's price per period in the Console's variables; the total never fills it.
  assert.equal(values.valor, undefined);
  assert.match(values.parcela_de_entrada, /R\$\s2\.500,00 \(50% do total\)/);
  // Support templates speak of hours and deadlines too; the proposal does not answer them.
  assert.equal(values.horas_mensais, undefined);
  assert.equal(values.prazo_de_resposta, undefined);
  assert.equal(values.outra_coisa, undefined);
});

test("no timeline when a phase has no weeks", () => {
  const values = quoteContractValues({ ...quote, content: { ...quote.content, phases: [{ ...quote.content.phases[0], weeks: null }] } }, ["prazo"]);
  assert.equal(values.prazo, undefined);
});

test("entrada and saldo come out with the proposal's amounts and a suggested date", () => {
  const upfront = quoteCharge(quote, "upfront", "2026-10-08");
  assert.equal(upfront.amountCents, 250000);
  assert.equal(upfront.dueDate, "2026-10-15");
  assert.equal(upfront.description, "Entrada do orçamento 2026-007, Sistema de OS");
  const balance = quoteCharge(quote, "balance", "2026-10-08");
  assert.equal(balance.amountCents, 250000);
  assert.equal(balance.dueDate, "2026-11-05");
});

test("the first board starts with the two fixed steps and keeps the task codes", () => {
  const cards = quoteBoardTasks(quote.content);
  assert.deepEqual(cards.map((c) => c.title), ["Acessos", "Reunião de início", "P1-01 Entrevistas", "P2-01 Cadastro de OS", "P2-02 Relatórios"]);
  assert.deepEqual(cards[3].labels, ["Construção"]);
  const big = { ...quote.content, phases: [{ ...quote.content.phases[0], tasks: Array.from({ length: 400 }, (_, i) => ({ title: `T${i}`, description: "" })) }] };
  assert.equal(quoteBoardTasks(big).length, BOARD_LIMIT);
});

test("a monthly due date lands on the day, or the month's last day, on or after a date", () => {
  assert.equal(monthlyDueOnOrAfter(10, "2026-10-08"), "2026-10-10");
  assert.equal(monthlyDueOnOrAfter(5, "2026-10-08"), "2026-11-05");
  assert.equal(monthlyDueOnOrAfter(31, "2026-11-02"), "2026-11-30");
  assert.equal(monthlyDueOnOrAfter(15, "2026-12-20"), "2027-01-15");
});

test("each contract template finds its ficha by name", () => {
  assert.equal(presetForTemplate("Licença de uso do Synova"), "synova");
  assert.equal(presetForTemplate("Suporte técnico e sustentação de sistemas"), "support");
  assert.equal(presetForTemplate("Licença de uso de software (SaaS)"), "saas");
  assert.equal(presetForTemplate("Infraestrutura em nuvem"), "infra");
  assert.equal(presetForTemplate("E-mail corporativo"), "email");
  assert.equal(presetForTemplate("Serviço técnico com escopo fechado"), "service");
  assert.equal(presetForTemplate("Desenvolvimento de software personalizado"), null);
  assert.equal(presetForTemplate(null), null);
});

test("the digest lists sales follow-up and links the prepared renewal", () => {
  const { subject, text } = opsDigestText({
    today: "2026-10-08",
    issued24h: 0,
    paid24h: 0,
    paused: [],
    noticeProblems: [],
    overdue: [],
    contracts: [{ id: "c1", company: "ACME", title: "Licença", label: "vence em 10 dias" }],
    followUp: [{ key: "awaiting-anuntech", title: "Assinados pelo cliente, falta a Anuntech", items: [{ line: "ACME · Licença", href: "/contratos/c2" }] }],
    url: "https://console.example",
  });
  assert.match(subject, /2 pontos/);
  assert.match(text, /prorrogação pronta: https:\/\/console\.example\/contratos\/novo\?parentId=c1&prorrogar=1/);
  assert.match(text, /Assinados pelo cliente, falta a Anuntech \(1\):\n- ACME · Licença · https:\/\/console\.example\/contratos\/c2/);
});

test("a renewal of whole months keeps whole months, leap years and short months included", () => {
  assert.deepEqual(nextTerm("2027-01-01", "2027-12-31"), { startsAt: "2028-01-01", endsAt: "2028-12-31" });
  assert.deepEqual(nextTerm("2026-10-08", "2027-10-07"), { startsAt: "2027-10-08", endsAt: "2028-10-07" });
  assert.deepEqual(nextTerm("2026-02-01", "2026-02-28"), { startsAt: "2026-03-01", endsAt: "2026-03-31" });
  assert.deepEqual(nextTerm("2026-01-31", "2026-02-27"), { startsAt: "2026-02-28", endsAt: "2026-03-27" });
  assert.deepEqual(nextTerm(null, "2026-10-31"), { startsAt: "2026-11-01", endsAt: "2027-10-31" });
  // Not whole months: the same number of days.
  assert.deepEqual(nextTerm("2026-10-01", "2026-10-20"), { startsAt: "2026-10-21", endsAt: "2026-11-17" });
});

test("automations are on unless switched off", async () => {
  const { automationState, automationKeys } = await import("../src/lib/automations/automation-list");
  const state = automationState({ weeklySummary: false });
  assert.equal(state.weeklySummary, false);
  assert.equal(state.hoursAlert, true);
  assert.equal(Object.keys(automationState(null)).length, automationKeys.length);
});
