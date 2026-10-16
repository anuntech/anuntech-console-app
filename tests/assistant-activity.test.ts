import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_LABELS, activityBusy, assistantActivity, type ActivityInput } from "../src/lib/assistant/activity";
import { AI_ORB_STATES } from "../src/components/ui/ai-orb-states";

const rest: ActivityInput = {
  busy: false,
  phase: null,
  confirming: false,
  pending: false,
  settled: null,
  dictation: "idle",
};

test("a turn shows each phase the server reports", () => {
  assert.equal(assistantActivity({ ...rest, busy: true }), "thinking");
  assert.equal(assistantActivity({ ...rest, busy: true, phase: "tools" }), "tool-call");
  assert.equal(assistantActivity({ ...rest, busy: true, phase: "reading" }), "tool-result");
  assert.equal(assistantActivity({ ...rest, busy: true, phase: "answer" }), "streaming");
});

test("the work shows over the microphone, and the microphone over the rest", () => {
  // Dictating a follow-up while a turn runs: the dock still says the assistant is working.
  assert.equal(assistantActivity({ ...rest, busy: true, phase: "tools", dictation: "recording" }), "tool-call");
  assert.equal(activityBusy(assistantActivity({ ...rest, busy: true, dictation: "recording" })), true);
  assert.equal(assistantActivity({ ...rest, dictation: "starting" }), "listening");
  assert.equal(assistantActivity({ ...rest, dictation: "recording", pending: true, settled: "done" }), "listening");
  assert.equal(assistantActivity({ ...rest, dictation: "transcribing" }), "thinking");
  // A failed recording says so in the composer; the orb goes back to what the assistant is doing.
  assert.equal(assistantActivity({ ...rest, dictation: "error" }), "idle");
});

test("after a turn: an error first, then a card waiting, then the plain end", () => {
  assert.equal(assistantActivity({ ...rest, settled: "error", pending: true }), "error");
  assert.equal(assistantActivity({ ...rest, settled: "done", pending: true }), "waiting-approval");
  assert.equal(assistantActivity({ ...rest, settled: "done" }), "done");
  assert.equal(assistantActivity({ ...rest, pending: true }), "waiting-approval");
});

test("a confirmed card being carried out counts as work", () => {
  assert.equal(assistantActivity({ ...rest, confirming: true, pending: true }), "tool-call");
  assert.equal(activityBusy("tool-call"), true);
});

test("at rest the assistant is idle, and waiting on the person is not work", () => {
  assert.equal(assistantActivity(rest), "idle");
  assert.equal(activityBusy("idle"), false);
  assert.equal(activityBusy("waiting-approval"), false);
  assert.equal(activityBusy("listening"), false);
});

test("every activity is a state the orb draws, with words for the dock", () => {
  for (const [activity, label] of Object.entries(ACTIVITY_LABELS)) {
    assert.ok((AI_ORB_STATES as readonly string[]).includes(activity), activity);
    assert.ok(label.startsWith("Assistente") || label.startsWith("O assistente"), label);
  }
});
