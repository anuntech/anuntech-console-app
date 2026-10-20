import { test } from "node:test";
import assert from "node:assert/strict";
import { moneyHiddenFrom } from "../src/lib/money-visibility";

test("overview values start hidden and show only when the viewer chose to", () => {
  assert.equal(moneyHiddenFrom(undefined), true);
  assert.equal(moneyHiddenFrom("hidden"), true);
  assert.equal(moneyHiddenFrom("anything"), true);
  assert.equal(moneyHiddenFrom("shown"), false);
});
