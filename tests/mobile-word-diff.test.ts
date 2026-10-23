import assert from "node:assert/strict";
import test from "node:test";
import { diffWords as webDiff } from "../src/lib/contracts/contract-text";
import { diffSummary, diffWords } from "../mobile/src/lib/word-diff";

const cases: [string, string][] = [
  ["Pagamento em 30 dias.", "Pagamento em 15 dias após a entrega."],
  ["", "Texto novo."],
  ["Texto antigo.", ""],
  ["Igual.", "Igual."],
  ["A  multa é de 10%\ndo valor.", "A multa é de 2%\ndo valor mensal."],
  ["um dois três quatro", "zero um três quatro cinco"],
];

test("the app's word diff is the web's, part by part", () => {
  for (const [before, after] of cases) assert.deepEqual(diffWords(before, after), webDiff(before, after));
});

test("a diff keeps the proposed text when read without what it drops", () => {
  for (const [before, after] of cases) {
    const parts = diffWords(before, after);
    assert.equal(parts.filter((p) => p.change !== "removed").map((p) => p.text).join("").trim(), after.trim());
    // Kept words take the proposed spacing, so the original reads back word for word.
    const words = (text: string) => text.split(/\s+/).filter(Boolean);
    assert.deepEqual(words(parts.filter((p) => p.change !== "added").map((p) => p.text).join("")), words(before));
  }
});

test("a screen reader hears what is removed and what is added", () => {
  assert.equal(
    diffSummary(diffWords("Pagamento em 30 dias.", "Pagamento em 15 dias após a entrega.")),
    "remove “30 dias.”, inclui “15 dias após a entrega.”",
  );
  assert.equal(diffSummary(diffWords("Igual.", "Igual.")), "");
});
