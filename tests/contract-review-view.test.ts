import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewBlocks, reviewRounds } from "../src/lib/contracts/contract-review-view";
import { contractBlocks, requestable } from "../src/lib/contracts/contract-text";

const v1 = [
  "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
  "CONTRATANTE: Empresa A, CNPJ 00.000.000/0001-00.",
  "CLÁUSULA 1 — OBJETO\n1.1 Desenvolvimento do portal.\n1.2 Suporte por 30 dias.",
  "CLÁUSULA 2 — PAGAMENTO\n2.1 Pagamento em 30 dias.",
].join("\n\n");
const v2 = v1.replace("2.1 Pagamento em 30 dias.", "2.1 Pagamento em 15 dias.").replace("\n1.2 Suporte por 30 dias.", "");

test("each block keeps the index a request names, and only clauses, parties and paragraphs are requestable", () => {
  const blocks = reviewBlocks(v1, null);
  const parsed = contractBlocks(v1);
  assert.equal(blocks.length, parsed.length);
  blocks.forEach((block, i) => {
    assert.equal(block.index, i);
    assert.equal(block.text, parsed[i].text);
    assert.equal(block.requestable, requestable(parsed[i]));
    assert.equal(block.change, "same");
  });
  assert.deepEqual(
    blocks.filter((b) => b.requestable).map((b) => b.number ?? b.label),
    ["CONTRATANTE", "1.1", "1.2", "2.1"],
  );
});

test("against the previous version, rewritten blocks are added and dropped ones stay as removed, without an index", () => {
  const blocks = reviewBlocks(v2, v1);
  const added = blocks.filter((b) => b.change === "added");
  const removed = blocks.filter((b) => b.change === "removed");
  assert.deepEqual(added.map((b) => b.text), ["Pagamento em 15 dias."]);
  assert.ok(removed.some((b) => b.text === "Suporte por 30 dias." && b.index === null && !b.requestable));
  // Indices still point at the new text's blocks, in order.
  const indexed = blocks.filter((b) => b.index !== null).map((b) => b.index);
  assert.deepEqual(indexed, contractBlocks(v2).map((_, i) => i));
});

test("the round in front of the client keeps its drafts; earlier rounds come newest first, without drafts", () => {
  const requests = [
    { id: "a", version: 1, status: "accepted", blockIndex: 3 },
    { id: "b", version: 1, status: "declined", blockIndex: 1 },
    { id: "c", version: 1, status: "draft", blockIndex: 2 },
    { id: "d", version: 2, status: "pending", blockIndex: 4 },
    { id: "e", version: 3, status: "draft", blockIndex: 1 },
    { id: "f", version: 3, status: "draft", blockIndex: 2 },
  ];
  const rounds = reviewRounds(requests, 3);
  assert.deepEqual(rounds.current.map((r) => r.id), ["e", "f"]);
  assert.equal(rounds.drafts, 2);
  assert.deepEqual(
    rounds.history.map((round) => [round.version, round.requests.map((r) => r.id)]),
    [
      [2, ["d"]],
      [1, ["b", "a"]],
    ],
  );
});
