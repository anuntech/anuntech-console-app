import { test } from "node:test";
import assert from "node:assert/strict";
import type { DecisionStep } from "../src/db/schema";
import {
  DECISION_KINDS,
  allDone,
  clampLevel,
  completeStep,
  decisionExpiry,
  decisionKinds,
  refreshSteps,
  resolutionOf,
  tallyDecisions,
} from "../src/lib/decisions/decision-rules";
import { protectLinks, restoreLinks } from "../src/lib/decisions/collection-text";
import { chargeIdsFromWebhook, WEBHOOK_MAX_CHARGES } from "../src/lib/billing/inter-webhook";

const step = (key: string, extra: Partial<DecisionStep> = {}): DecisionStep => ({ key, label: key, kind: "link", href: "/", done: false, ...extra });

test("money, contracts and collections never go past prepare-and-approve", () => {
  for (const kind of decisionKinds) {
    assert.equal(DECISION_KINDS[kind].max, 1, kind);
    assert.ok(DECISION_KINDS[kind].level <= DECISION_KINDS[kind].max, kind);
    assert.equal(clampLevel(kind, 3), 1);
    assert.equal(clampLevel(kind, -2), 0);
  }
});

test("a decision expires after its kind's days", () => {
  const from = new Date("2026-10-29T12:00:00Z");
  assert.equal(decisionExpiry("quote.start", from).toISOString(), "2026-11-05T12:00:00.000Z");
  assert.equal(decisionExpiry("invoice.collect", from).toISOString(), "2026-11-28T12:00:00.000Z");
});

test("steps done on their own screens tick without who or when; clicked ones keep both", () => {
  const at = new Date("2026-10-29T12:00:00Z");
  let steps = [step("project", { kind: "action" }), step("contract"), step("upfront")];
  steps = completeStep(steps, "project", "user-1", at);
  assert.equal(steps[0].doneBy, "user-1");
  // Clicking again changes nothing.
  assert.deepEqual(completeStep(steps, "project", "user-2", new Date()), steps);
  steps = refreshSteps(steps, { project: true, contract: true });
  assert.equal(steps[0].doneBy, "user-1");
  assert.equal(steps[1].done, true);
  assert.equal(steps[1].doneBy, undefined);
  assert.equal(allDone(steps), false);
  steps = refreshSteps(steps, { upfront: true });
  assert.equal(allDone(steps), true);
  assert.equal(resolutionOf(steps), "mixed");
  assert.equal(resolutionOf([step("a", { done: true, doneBy: "u" })]), "queue");
  assert.equal(resolutionOf([step("a", { done: true })]), "elsewhere");
  assert.equal(allDone([]), false);
});

test("the month's numbers: clicks per finished decision and the median time", () => {
  const created = new Date("2026-10-01T00:00:00Z");
  const after = (hours: number) => new Date(created.getTime() + hours * 3_600_000);
  const tally = tallyDecisions([
    { status: "done", resolution: "queue", steps: [step("a", { done: true, doneBy: "u" }), step("b", { done: true, doneBy: "u" })], createdAt: created, decidedAt: after(2) },
    { status: "done", resolution: "elsewhere", steps: [step("a", { done: true })], createdAt: created, decidedAt: after(10) },
    { status: "pending", resolution: null, steps: [step("a")], createdAt: created, decidedAt: null },
    { status: "dismissed", resolution: null, steps: [], createdAt: created, decidedAt: after(1) },
    { status: "expired", resolution: null, steps: [], createdAt: created, decidedAt: after(200) },
  ]);
  assert.deepEqual(tally, { created: 5, pending: 1, queue: 1, elsewhere: 1, mixed: 0, dismissed: 1, expired: 1, touchesPerDecision: 1, medianHours: 6 });
  assert.equal(tallyDecisions([]).medianHours, null);
});

test("payment links never reach the model and come back in place", () => {
  const message = "Olá.\n\nVocê pode pagar por aqui:\nFatura 1: https://console.anuntech.com/pagar/abc\nFatura 2: https://console.anuntech.com/pagar/def\n\nObrigado.";
  const { text, links } = protectLinks(message);
  assert.ok(!text.includes("https://"));
  assert.equal(links.length, 2);
  assert.equal(text.split("[[LINKS]]").length, 2);
  const answer = "Oi, tudo bem?\n\nPara pagar:\n[[LINKS]]\n\nQualquer coisa, me chame.";
  assert.equal(restoreLinks(answer, links), "Oi, tudo bem?\n\nPara pagar:\nFatura 1: https://console.anuntech.com/pagar/abc\nFatura 2: https://console.anuntech.com/pagar/def\n\nQualquer coisa, me chame.");
  // Lost the marker, wrote it twice or invented a link: the base text stays.
  assert.equal(restoreLinks("Oi, pague logo.", links), null);
  assert.equal(restoreLinks("[[LINKS]]\n[[LINKS]]", links), null);
  assert.equal(restoreLinks("Pague em https://outro.site\n[[LINKS]]", links), null);
  assert.equal(restoreLinks("   ", links), null);
  // Without links nothing changes, and a marker out of nowhere is refused.
  assert.deepEqual(protectLinks("Sem link."), { text: "Sem link.", links: [] });
  assert.equal(restoreLinks("Texto novo.", []), "Texto novo.");
  assert.equal(restoreLinks("Texto [[LINKS]]", []), null);
});

test("the Inter webhook only yields well-formed charge ids, never a status", () => {
  const id = "3f8a2c1e-9b7d-4e6f-a5c4-1d2e3f4a5b6c";
  assert.deepEqual(chargeIdsFromWebhook([{ codigoSolicitacao: id, situacao: "RECEBIDO" }]), [id]);
  assert.deepEqual(chargeIdsFromWebhook({ codigoSolicitacao: id.toUpperCase() }), [id.toUpperCase(), id]);
  assert.deepEqual(chargeIdsFromWebhook([{ codigoSolicitacao: "1; drop table" }, { seuNumero: "x" }, null, 7]), []);
  assert.deepEqual(chargeIdsFromWebhook("texto"), []);
  const many = Array.from({ length: 200 }, (_, i) => ({ codigoSolicitacao: `3f8a2c1e-9b7d-4e6f-a5c4-${String(i).padStart(12, "0")}` }));
  assert.ok(chargeIdsFromWebhook(many).length <= WEBHOOK_MAX_CHARGES * 2);
});
