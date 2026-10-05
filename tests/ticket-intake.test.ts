import assert from "node:assert/strict";
import test from "node:test";
import {
  outsideSupportClock,
  suggestPriority,
  ticketKindLabels,
  ticketKinds,
  ticketKindSlugs,
} from "../src/lib/tickets/ticket-intake";

test("the Console suggests a priority only for problems, from the impact", () => {
  assert.equal(suggestPriority("problem", "down", true), "critical");
  assert.equal(suggestPriority("problem", "down", false), "high");
  assert.equal(suggestPriority("problem", "workaround", true), "high");
  assert.equal(suggestPriority("problem", "other", true), "normal");
  assert.equal(suggestPriority("question", "down", true), "normal");
  assert.equal(suggestPriority(null, null), "normal");
});

test("every kind has a label and a slug, and only a new project skips the clock", () => {
  for (const kind of ticketKinds) assert.ok(ticketKindLabels[kind]);
  assert.deepEqual(new Set(Object.values(ticketKindSlugs)), new Set(ticketKinds));
  assert.ok(outsideSupportClock("new_project"));
  assert.equal(outsideSupportClock("problem"), false);
});
