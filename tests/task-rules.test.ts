import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedStatuses,
  assigneeIdsOf,
  canDeleteTask,
  canRemoveFile,
  parseEstimate,
  parseLabels,
  statusRefusal,
  statusSideEffects,
} from "../src/lib/projects/task-rules";

const task = (status: "backlog" | "todo" | "in_progress" | "review" | "done", requested = false) => ({ status, requested });

test("the client never concludes, never puts in Revisão and never takes a card out of Revisão or Concluído", () => {
  assert.match(statusRefusal(false, task("in_progress"), "done")!, /Só a equipe conclui/);
  assert.match(statusRefusal(false, task("review"), "done")!, /use Aprovar/);
  assert.match(statusRefusal(false, task("todo"), "review")!, /Só a equipe coloca/);
  assert.match(statusRefusal(false, task("review"), "todo")!, /use Revisar/);
  assert.match(statusRefusal(false, task("done"), "todo")!, /está concluída/);
  assert.match(statusRefusal(false, task("backlog", true), "todo")!, /fica no Backlog/);
  assert.equal(statusRefusal(false, task("todo"), "in_progress"), null);
  assert.equal(statusRefusal(false, task("backlog"), "todo"), null);
  assert.equal(statusRefusal(false, task("review"), "review"), null);
  assert.equal(statusRefusal(true, task("todo"), "done"), null);
});

test("the column picker offers exactly what the rules allow, the current column included", () => {
  assert.deepEqual(allowedStatuses(false, task("todo")), ["backlog", "todo", "in_progress"]);
  assert.deepEqual(allowedStatuses(false, task("backlog", true)), ["backlog"]);
  assert.deepEqual(allowedStatuses(false, task("review")), ["review"]);
  assert.deepEqual(allowedStatuses(false, task("done")), ["done"]);
  assert.deepEqual(allowedStatuses(true, task("done")), ["backlog", "todo", "in_progress", "review", "done"]);
});

test("moving starts the test window, clears an approval and takes the team's request into the work", () => {
  assert.deepEqual(statusSideEffects(false, task("todo"), "todo"), {});
  const review = statusSideEffects(true, task("in_progress"), "review");
  assert.ok(review.reviewSince instanceof Date);
  assert.equal(review.approvedAt, null);
  assert.equal(statusSideEffects(true, task("backlog", true), "todo").requested, false);
  assert.equal("requested" in statusSideEffects(false, task("todo", true), "in_progress"), false);
  assert.equal("approvedAt" in statusSideEffects(true, task("review"), "done"), false);
});

test("files go with whoever added them, the task's creator or staff; tasks with their creator or staff", () => {
  const me = { admin: false, user: { id: "u1" } };
  assert.ok(canRemoveFile(me, { authorId: "u1" }, { createdBy: "u2" }));
  assert.ok(canRemoveFile(me, { authorId: "u2" }, { createdBy: "u1" }));
  assert.ok(!canRemoveFile(me, { authorId: "u2" }, { createdBy: "u3" }));
  assert.ok(canRemoveFile({ admin: true, user: { id: "x" } }, { authorId: "u2" }, { createdBy: "u3" }));
  assert.ok(canDeleteTask(me, { createdBy: "u1" }));
  assert.ok(!canDeleteTask(me, { createdBy: "u2" }));
});

test("labels, estimates and people are read as the sheet types them", () => {
  assert.deepEqual(parseLabels([" Site ", "site", "", "Novo   layout"]), ["Site", "Novo layout"]);
  assert.throws(() => parseLabels(["x".repeat(25)]), /24 caracteres/);
  assert.throws(() => parseLabels(Array.from({ length: 9 }, (_, i) => `e${i}`)), /até 8 etiquetas/);
  assert.equal(parseEstimate(""), null);
  assert.equal(parseEstimate("1,5"), 90);
  assert.throws(() => parseEstimate("abc"), /em horas/);
  assert.deepEqual(assigneeIdsOf(["a", " a ", "", "b"]), ["a", "b"]);
  assert.throws(() => assigneeIdsOf(Array.from({ length: 11 }, (_, i) => `p${i}`)), /Até 10 pessoas/);
});
