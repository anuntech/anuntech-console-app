import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITY_ACTIONS, activityFilters, activityText } from "../src/lib/projects/activity-model";
import { auditLabels } from "../src/lib/format";

test("each board event reads as one sentence, in the board's words", () => {
  assert.deepEqual(activityText({ action: "task.moved", details: { from: "todo", to: "review" } }), { text: "moveu de A fazer para Revisão", kind: "moves" });
  assert.equal(activityText({ action: "task.approved", details: null }).text, "aprovou a entrega");
  assert.equal(activityText({ action: "task.review_failed", details: null }).kind, "reviews");
  assert.equal(activityText({ action: "task.updated", details: { removedFile: "logo.png" } }).text, "removeu o anexo logo.png");
  assert.equal(activityText({ action: "task.commented", details: { files: 2 } }).text, "comentou, com 2 anexos");
  assert.equal(activityText({ action: "engagement.status_changed", details: { status: "paused" } }).text, "mudou a situação do projeto para pausado");
});

test("every action listed has its own sentence and an audit label, and every filter has events", () => {
  for (const action of ACTIVITY_ACTIONS) {
    assert.notEqual(activityText({ action, details: {} }).text, "fez uma alteração", action);
    assert.ok(auditLabels[action], action);
  }
  const kinds = new Set(ACTIVITY_ACTIONS.map((action) => activityText({ action, details: {} }).kind));
  for (const filter of activityFilters) if (filter.key !== "all") assert.ok(kinds.has(filter.key), filter.key);
});
