import assert from "node:assert/strict";
import test from "node:test";
import { batchOf, mergeActions, offersBatch } from "../src/lib/assistant/proposal-batch";

const card = (id: string, status = "pending", tainted = false, path: string | null = null) => ({ id, status, tainted, path });

test("one click confirms the plain pending cards, in order; the ones that need their own look stay", () => {
  const cards = [card("a"), card("b", "done"), card("c", "pending", true), card("d", "pending", false, "/financeiro/nova"), card("e"), card("f", "failed")];
  assert.deepEqual(batchOf(cards, "confirmar").map((c) => c.id), ["a", "e"]);
  // Discarding is safe for every pending card.
  assert.deepEqual(batchOf(cards, "descartar").map((c) => c.id), ["a", "c", "d", "e"]);
});

test("the buttons for all show with two or more cards one click would confirm, and stay while they run", () => {
  assert.equal(offersBatch([card("a")]), false);
  assert.equal(offersBatch([card("a"), card("b", "pending", true)]), false);
  assert.equal(offersBatch([card("a"), card("b")]), true);
  assert.equal(offersBatch([card("a", "busy"), card("b", "busy")]), true);
  assert.equal(offersBatch([card("a", "done"), card("b", "done")]), false);
});

test("eleven confirmed cards refresh the page once", () => {
  const refresh = { type: "refresh" as const };
  const go = { type: "navigate" as const, href: "/projetos" };
  assert.deepEqual(mergeActions([refresh, refresh, go, refresh, go]), [refresh, go]);
});
