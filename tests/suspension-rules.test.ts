import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUSPENSION_KINDS,
  earliestSuspensionDate,
  liftSteps,
  stepsDone,
  suspendSteps,
  suspensionKindOf,
  suspensionRefusal,
  suspensionStage,
  type SuspensionCheck,
} from "../src/lib/suspensions/suspension-rules";
import { suspensionView } from "../src/lib/suspensions/suspension-view";
import { auditLabels, engagementLabels } from "../src/lib/format";
import { automationKeys, automationState } from "../src/lib/automations/automation-list";

const policy = { days: 15, notice: true, clause: "SYN 5.4" };
const base: SuspensionCheck = {
  reason: "overdue",
  date: "2026-10-25",
  today: "2026-10-20",
  policy,
  oldestDueDate: "2026-09-30",
  note: "",
  noticedOn: "2026-10-20",
};

test("the earliest day is more than the clause's days past the oldest due date", () => {
  assert.equal(earliestSuspensionDate("2026-09-30", policy), "2026-10-16");
  assert.equal(earliestSuspensionDate("2026-09-30", null), null);
});

test("late payment with a published clause and a notice before the date is allowed", () => {
  assert.equal(suspensionRefusal(base), null);
});

test("nothing overdue: no suspension for late payment", () => {
  assert.equal(suspensionRefusal({ ...base, oldestDueDate: null }), "Esta empresa não tem fatura vencida.");
});

test("before the clause's days have passed it is refused, naming the first possible day", () => {
  const refusal = suspensionRefusal({ ...base, oldestDueDate: "2026-10-15", date: "2026-10-25" });
  assert.match(refusal ?? "", /31\/10\/2026/);
});

test("with notice required, never on the day of the notice nor without one", () => {
  assert.match(suspensionRefusal({ ...base, date: "2026-10-20" }) ?? "", /depois do dia do aviso/);
  assert.match(suspensionRefusal({ ...base, noticedOn: null }) ?? "", /aviso antes/);
  // Without notice in the clause, the same day is fine.
  assert.equal(suspensionRefusal({ ...base, date: "2026-10-20", noticedOn: null, policy: { ...policy, notice: false } }), null);
});

test("without a published clause, or for another reason, the team writes why", () => {
  assert.match(suspensionRefusal({ ...base, policy: null }) ?? "", /Sem cláusula/);
  assert.equal(suspensionRefusal({ ...base, policy: null, note: "Três boletos vencidos, sem resposta." }), null);
  assert.match(suspensionRefusal({ ...base, reason: "terms" }) ?? "", /Explique/);
  // A breach of the terms needs no overdue invoice.
  assert.equal(suspensionRefusal({ ...base, reason: "terms", oldestDueDate: null, note: "Disparo de spam pela caixa comercial." }), null);
});

test("dates in the past or too far ahead are refused", () => {
  assert.match(suspensionRefusal({ ...base, date: "2026-10-19" }) ?? "", /passado/);
  assert.match(suspensionRefusal({ ...base, date: "2026-12-20" }) ?? "", /60 dias/);
});

test("stages follow the dates", () => {
  assert.equal(suspensionStage({ suspendedAt: null, settledAt: null, liftedAt: null }), "scheduled");
  assert.equal(suspensionStage({ suspendedAt: new Date(), settledAt: null, liftedAt: null }), "suspended");
  assert.equal(suspensionStage({ suspendedAt: new Date(), settledAt: new Date(), liftedAt: null }), "settled");
  assert.equal(suspensionStage({ suspendedAt: new Date(), settledAt: null, liftedAt: new Date() }), "lifted");
});

test("every kind has blocking and unblocking steps with unique keys; nothing deletes data", () => {
  const keys = new Set<string>();
  for (const kind of SUSPENSION_KINDS) {
    assert.ok(suspendSteps[kind].length && liftSteps[kind].length, kind);
    for (const step of [...suspendSteps[kind], ...liftSteps[kind]]) {
      assert.ok(!keys.has(step.key), step.key);
      keys.add(step.key);
      assert.doesNotMatch(step.label, /apag|exclu/i, step.label);
    }
  }
  assert.equal(suspensionKindOf("vm"), "vm");
  assert.equal(suspensionKindOf(null), "manual");
  assert.equal(suspensionKindOf("other"), "manual");
  assert.equal(stepsDone({ "vm-snapshot": { at: "", by: "" } }, suspendSteps.vm), 1);
});

test("a client never gets the team's view of a suspension", () => {
  const row = { id: "s", reason: "overdue" as const, scheduledFor: "2026-10-25", noticeSentAt: null, suspendedAt: null, settledAt: null, liftedAt: null, note: "interno", steps: {} };
  assert.equal(suspensionView(row, "vm", false), undefined);
  assert.equal(suspensionView(row, "vm", true)?.note, "interno");
  assert.equal(suspensionView(row, "vm", true)?.stage, "scheduled");
});

test("labels and the switch exist", () => {
  assert.equal(engagementLabels.suspended, "Suspenso");
  for (const action of ["scheduled", "suspended", "cancelled", "settled", "lifted", "notice_recorded", "step"])
    assert.ok(auditLabels[`suspension.${action}`], action);
  assert.ok(automationKeys.includes("suspensionSettle"));
  assert.equal(automationState({}).suspensionSettle, true);
});
